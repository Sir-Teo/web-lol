"""Stage Ahri Recall's unchanged masters and unflattened ordered source audio graph."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess

READING = 'c3152a7031db137fc1c6a787d646771b15cc0e7beccdea79aeb431471522965b'
POLICY = ['eMode', 'eRandomMode', 'wAvoidRepeatCount', 'bResetPlayListAtEachPlay', 'bIsGlobal',
          'bIsContinuous', '_bIsUsingWeight', 'u16MaxNumInstance', 'bKillNewest', 'sLoopCount',
          'sLoopModMin', 'sLoopModMax', 'eTransitionMode', 'eVirtualQueueBehavior', 'eBelowThresholdBehavior']


def require(ok, message):
    if not ok:
        raise ValueError(message)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def build():
    raw = Path('docs/reference/ahri-recall-audio-properties.json').read_bytes()
    require(sha(raw) == READING, 'Frozen recall property reading differs')
    reading = json.loads(raw)
    nodes = {n['id']: n for n in reading['nodes']}
    masters = {m['id']: m for m in reading['media']}

    def parameter(identity, suffix):
        rows = [p for p in nodes[identity]['parameters'] if p[0].endswith('/' + suffix)]
        require(len(rows) == 1, 'Missing/ambiguous source parameter: ' + suffix)
        return rows[0][2]

    def properties(identity):
        result, ranges = {}, {}
        rows = nodes[identity]['parameters']
        for path, kind, value, label in rows:
            if not path.endswith('/pID'):
                continue
            name = label.split('[')[-1].removesuffix(']')
            prefix = path[:-3]
            fields = {r[0].split('/')[-1]: float(r[2]) for r in rows
                      if r[0].startswith(prefix) and r[0] != path}
            if 'RANGED_MODIFIERS' in path:
                require(name not in ranges and set(fields) == {'min', 'max'}, 'Changed random modifier')
                ranges[name] = [fields['min'], fields['max']]
            else:
                require(name not in result and set(fields) == {'pValue'}, 'Changed property bundle')
                result[name] = fields['pValue']
        require(set(result) <= {'Pitch', 'MakeUpGain', 'Priority', 'AttenuationID'} and
                set(ranges) <= {'Pitch'}, 'Unsupported source property')
        require(all(math.isfinite(v) for v in result.values()) and
                all(math.isfinite(v) for pair in ranges.values() for v in pair), 'Non-finite source property')
        return dict(properties=result, ranges=ranges)

    containers, sounds, mixers, outputs = [], [], [], {}
    for identity, node in sorted(nodes.items()):
        if node['type'] not in ['CAkRanSeqCntr', 'CAkSound', 'CAkActorMixer']:
            continue
        require(int(parameter(identity, 'uNumCurves')) == 0, 'Unexpected local RTPC')
        item = dict(id=identity, parentId=int(parameter(identity, 'DirectParentID')),
                    busId=int(parameter(identity, 'OverrideBusId')), **properties(identity))
        if node['type'] == 'CAkActorMixer':
            mixers.append(item)
        elif node['type'] == 'CAkRanSeqCntr':
            policy = {name: int(parameter(identity, name)) for name in POLICY}
            require(policy['bIsGlobal'] == 1 and policy['bKillNewest'] == 0 and
                    policy['u16MaxNumInstance'] == 0 and policy['eMode'] == 0,
                    'Unsupported recall container scope')
            require((policy['sLoopCount'], policy['bIsContinuous'], policy['eTransitionMode']) == (1, 0, 0), 'Changed recall finite-step policy')
            transition = {name: float(parameter(identity, name)) for name in
                          ['fTransitionTime', 'fTransitionTimeModMin', 'fTransitionTimeModMax']}
            require(all(math.isfinite(v) for v in transition.values()), 'Non-finite recall transition')
            count = int(parameter(identity, 'ulPlayListItem'))
            playlist = [dict(id=int(parameter(identity, f'AkPlaylistItem:{i}/ulPlayID')),
                             weight=int(parameter(identity, f'AkPlaylistItem:{i}/weight'))) for i in range(count)]
            item.update(policy=policy, transition=transition, playlist=playlist)
            containers.append(item)
        else:
            media_id = int(parameter(identity, 'sourceID'))
            master = masters[media_id]
            require(master['channels'] == 1 and master['sampleRate'] == 44100 and
                    master['decoderMetadata']['loopingInfo'] is None, 'Unsupported source master format/loop')
            wave = Path(f'.cache/ahri-audio-decoded-v1/{media_id}.wav').read_bytes()
            require(len(wave) == master['wavBytes'] and sha(wave) == master['wavSha256'], 'Changed recall float master')
            url = f'assets/audio/ahri-recall/{media_id}.wav'
            require('public/' + url not in outputs or outputs['public/' + url] == wave, 'Conflicting shared recall master')
            outputs['public/' + url] = wave
            item['clip'] = dict(id=media_id, url=url, sha256=master['wavSha256'],
                                pcmSha256=master['pcmSha256'], frames=master['frames'],
                                sampleRate=44100, channels=1, durationSeconds=master['durationSeconds'], peak=master['peak'])
            sounds.append(item)
    events = []
    roles = ['recall']
    for role, event in zip(roles, reading['events'], strict=True):
        actions = []
        for action in event['actions']:
            identity = action['id']
            # Action TransitionTime is valid here; ordinary node properties are kept separate above.
            rows = nodes[identity]['parameters']
            props = {}
            for path, kind, value, label in rows:
                if path.endswith('/pID') and 'RANGED_MODIFIERS' not in path:
                    name = label.split('[')[-1].removesuffix(']')
                    vals = [r[2] for r in rows if r[0] == path[:-3] + 'pValue']
                    require(name == 'TransitionTime' and len(vals) == 1, 'Unexpected action property')
                    props[name] = float(vals[0])
            actions.append(dict(id=identity, type=action['type'], target=action['target'], properties=props,
                                fadeCurve=int(parameter(identity, 'eFadeCurve')),
                                actionType=int(parameter(identity, 'ulActionType'))))
        events.append(dict(role=role, id=event['id'], declaredName=event['declaredName'], actions=actions))
    require(len(containers) == 1 and len(sounds) == 1 and len(mixers) == 1, 'Changed recall node closure')
    attenuation = [dict(distance=float(parameter(687014649, f'AkRTPCGraphPoint:{i}/From')),
                        storedValue=float(parameter(687014649, f'AkRTPCGraphPoint:{i}/To')),
                        interpolation=int(parameter(687014649, f'AkRTPCGraphPoint:{i}/Interp'))) for i in range(3)]
    source = dict(readingSha256=READING, events=events, containers=containers, sounds=sounds,
                  mixers=mixers, attenuation=attenuation, unresolvedGlobalBus=2232828494)
    target = 'src/content/ahri-recall-audio.ts'
    text = ('// Generated unflattened source graph. Finite Recall source graph. Zero instance declarations stay raw; native dispatch/inheritance remain unverified.\n'
            'export const AHRI_RECALL_AUDIO = ' + json.dumps(source, indent=2) + ' as const;\n')
    outputs[target] = subprocess.check_output(['node_modules/.bin/prettier', '--stdin-filepath', target], input=text.encode())
    target_timing = 'src/content/ahri-recall-audio-timing.ts'
    ticks = math.ceil(max(m['durationSeconds'] for m in masters.values()) * 60)
    timing = '// Finite local master bound; no source Stop callback is declared.\nexport const AHRI_RECALL_AUDIO_TICKS = ' + str(ticks) + ' as const;\n'
    outputs[target_timing] = subprocess.check_output(['node_modules/.bin/prettier', '--stdin-filepath', target_timing], input=timing.encode())
    require(len(outputs) == 3, 'Changed Recall publication closure')
    return outputs


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    outputs = build()
    for name, raw in outputs.items():
        path = Path(name)
        require(not any(p.is_symlink() for p in [path, *path.parents]), 'Output path cannot contain symlinks')
        require(not path.exists() or path.read_bytes() == raw, 'Existing recall source output differs: ' + name)
        require(not args.check or path.exists(), 'Missing recall source output: ' + name)
    if not args.check:
        for name, raw in outputs.items():
            path = Path(name)
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.exists():
                with path.open('xb') as stream:
                    stream.write(raw)
    print(json.dumps(dict(status='passed', files=len(outputs), bytes=sum(map(len, outputs.values())))))
