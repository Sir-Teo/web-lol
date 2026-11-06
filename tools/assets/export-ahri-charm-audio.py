"""Stage Charm's three source play profiles, stop fade and nine unchanged masters."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def require(ok, message):
    if not ok:
        raise ValueError(message)


def build():
    graph_path = Path('docs/reference/ahri-audio-graph.json')
    decoded_path = Path('docs/reference/ahri-audio-decoded.json')
    require(sha(graph_path.read_bytes()) == '489b0ab33120dc347a8d8a6cbf5f70dc6818a81c7dbab85f540b1e70efa1ecf0' and
            sha(decoded_path.read_bytes()) == 'b265f964b941c3800dbfb1b7826a90743e4b9cdbcd35368df1876465b88e158e',
            'Frozen Ahri graph/masters differ')
    graph, decoded = json.loads(graph_path.read_bytes()), json.loads(decoded_path.read_bytes())
    nodes = {n['id']: n for n in graph['nodes']}
    events = {e['declaredName']: e for e in graph['events']}
    masters = {m['id']: m for m in decoded['media']}

    def parameter(identity, suffix):
        rows = [p for p in nodes[identity]['parameters'] if p[0].endswith('/' + suffix)]
        require(len(rows) == 1, 'Missing/ambiguous parameter: ' + suffix)
        return rows[0][2]

    def properties(identity):
        fields = nodes[identity]['parameters']
        result = {}
        for path, kind, value, label in fields:
            if 'RANGED_MODIFIERS' in path and path.endswith('/cProps'):
                require(value == '0', 'Unexpected random property modifier')
            if path.endswith('/pID') and 'RANGED_MODIFIERS' not in path:
                key = label.split('[')[-1].removesuffix(']')
                matches = [p for p in fields if p[0] == path[:-3] + 'pValue']
                require(key not in result and len(matches) == 1, 'Ambiguous property bundle')
                result[key] = float(matches[0][2])
        return result

    require(properties(233409006) == {} and int(parameter(233409006, 'DirectParentID')) == 353175404,
            'Changed local spell mixer chain')
    require(properties(353175404) == {'Priority': 60, 'AttenuationID': 339248780} and
            int(parameter(353175404, 'DirectParentID')) == 0 and
            int(parameter(353175404, 'OverrideBusId')) == 1259461568, 'Changed local spell root/bus')
    for identity in [233409006, 353175404]:
        require(int(parameter(identity, 'uNumCurves')) == 0, 'Unexpected local RTPC')
    roles = [('cast', 'Play_sfx_Ahri_AhriE_OnCast', 450061738, -8.5, 2),
             ('flight', 'Play_sfx_Ahri_AhriEMissile_OnMissileLaunch', 640846733, -9.600000381469727, 4),
             ('hit', 'Play_sfx_Ahri_AhriEMissile_hit', 662306981, -7, 2)]
    profiles, outputs = [], {}
    policy_keys = ['eMode', 'eRandomMode', 'wAvoidRepeatCount', 'bResetPlayListAtEachPlay', 'bIsGlobal',
                   'bIsContinuous', '_bIsUsingWeight', 'u16MaxNumInstance', 'bKillNewest', 'sLoopCount',
                   'sLoopModMin', 'sLoopModMax', 'eTransitionMode', 'eVirtualQueueBehavior', 'eBelowThresholdBehavior']
    for phase, label, container, gain, cap in roles:
        event = events[label]
        require(len(event['actions']) == 1, 'Unexpected play action count')
        action = event['actions'][0]
        require(action['type'] == 'CAkActionPlay' and action['target'] == container and
                int(parameter(container, 'DirectParentID')) == 233409006, 'Changed play target')
        ap = properties(action['id'])
        require(ap == ({'TransitionTime': 50} if phase == 'flight' else {}) and
                int(parameter(action['id'], 'eFadeCurve')) == 4, 'Changed play transition')
        require(properties(container) == {'MakeUpGain': gain, 'Priority': 60}, 'Changed container gain')
        policy = {key: int(parameter(container, key)) for key in policy_keys}
        require(policy['u16MaxNumInstance'] == cap and policy['bKillNewest'] == 0 and
                policy['sLoopCount'] == 1 and policy['bIsContinuous'] == 0 and
                policy['bIsGlobal'] == 1 and policy['wAvoidRepeatCount'] == 0,
                'Unsupported finite/global container policy')
        require(int(parameter(container, 'uNumCurves')) == 0 and
                int(parameter(container, 'ulPlayListItem')) == 3, 'Changed playlist/local RTPC')
        variants = []
        for index in range(3):
            sound = int(parameter(container, f'AkPlaylistItem:{index}/ulPlayID'))
            require(int(parameter(container, f'AkPlaylistItem:{index}/weight')) == 50000 and
                    int(parameter(sound, 'DirectParentID')) == container and
                    properties(sound) == {'Priority': 60} and int(parameter(sound, 'uNumCurves')) == 0,
                    'Changed sound/playlist property')
            identity = int(parameter(sound, 'sourceID'))
            master = masters[identity]
            require(master['channels'] == 1 and master['sampleRate'] == 44100 and
                    master['decoderMetadata']['loopingInfo'] is None, 'Unexpected master format/loop')
            raw = Path(f'.cache/ahri-audio-decoded-v1/{identity}.wav').read_bytes()
            require(sha(raw) == master['wavSha256'] and len(raw) == master['wavBytes'], 'Changed float master')
            url = f'assets/audio/ahri-charm/{identity}.wav'
            outputs['public/' + url] = raw
            variants.append(dict(id=identity, soundId=sound, url=url, sha256=master['wavSha256'],
                                 pcmSha256=master['pcmSha256'], frames=master['frames'], sampleRate=44100,
                                 channels=1, durationSeconds=master['durationSeconds'], peak=master['peak']))
        profiles.append(dict(phase=phase, eventId=event['id'], declaredName=label, actionId=action['id'],
                             containerId=container, gainDb=gain, pitchCents=0,
                             transitionSeconds=ap.get('TransitionTime', 0) / 1000,
                             maxVoices=cap, sourcePolicy=policy, variants=variants))
    stop = events['Stop_sfx_Ahri_AhriEMissile_OnMissileLaunch']
    require(len(stop['actions']) == 1 and stop['actions'][0]['type'] == 'CAkActionStop' and
            stop['actions'][0]['target'] == 640846733, 'Changed missile stop target')
    stop_id = stop['actions'][0]['id']
    require(properties(stop_id) == {'TransitionTime': 1550} and int(parameter(stop_id, 'eFadeCurve')) == 6,
            'Changed missile stop transition')
    require(int(parameter(339248780, 'eScaling')) == 2 and int(parameter(339248780, 'ulSize')) == 6,
            'Changed source attenuation')
    attenuation = [dict(distance=float(parameter(339248780, f'AkRTPCGraphPoint:{i}/From')),
                        storedValue=float(parameter(339248780, f'AkRTPCGraphPoint:{i}/To')),
                        interpolation=int(parameter(339248780, f'AkRTPCGraphPoint:{i}/Interp'))) for i in range(6)]
    target = 'src/content/ahri-charm-audio.ts'
    source = ('// Generated source profiles. Native dispatch/shuffle/global bus/listener calibration remain open.\n'
              'export const AHRI_CHARM_AUDIO = ' + json.dumps(profiles, indent=2) + ' as const;\n'
              'export const AHRI_CHARM_STOP = ' + json.dumps(dict(eventId=stop['id'], actionId=stop_id,
               containerId=640846733, fadeSeconds=1.55, fadeCurve=6), indent=2) + ' as const;\n'
              'export const AHRI_CHARM_ATTENUATION = ' + json.dumps(attenuation, indent=2) + ' as const;\n'
              'export const AHRI_CHARM_UNRESOLVED_BUS = 1259461568;\n')
    outputs[target] = subprocess.check_output(['node_modules/.bin/prettier', '--stdin-filepath', target], input=source.encode())
    tails = {p['phase']: math.ceil(max(v['durationSeconds'] for v in p['variants']) * 60) for p in profiles}
    outputs['src/content/ahri-charm-audio-timing.ts'] = (
        '// Generated finite source spans; flight stop fade remains separate.\n' +
        ''.join(f'export const AHRI_CHARM_{phase.upper()}_TICKS = {ticks};\n' for phase, ticks in tails.items()) +
        'export const AHRI_CHARM_STOP_FADE_TICKS = 93;\n').encode()
    require(len(outputs) == 11, 'Changed source publication closure')
    return outputs


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    outputs = build()
    for name, raw in outputs.items():
        path = Path(name)
        require(not path.is_symlink(), 'Output cannot be a symlink')
        require(not path.exists() or path.read_bytes() == raw, 'Existing source output differs: ' + name)
        require(not args.check or path.exists(), 'Missing source output: ' + name)
    if not args.check:
        for name, raw in outputs.items():
            path = Path(name)
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.exists():
                with path.open('xb') as stream:
                    stream.write(raw)
    print(json.dumps(dict(status='passed', files=len(outputs), bytes=sum(map(len, outputs.values())))))
