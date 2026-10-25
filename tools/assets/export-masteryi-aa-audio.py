"""Export current ordinary/critical source cues; preserve ranges and binding caveats."""
from pathlib import Path
import argparse
import json
import math
import runpy
import subprocess
from masteryi_audio_decode import DECODED, DECODED_SHA256, GRAPH, GRAPH_SHA256, MASTER_ROOT, check_masters
from masteryi_audio_graph import event_hash, write_outputs
from masteryi_audio_source import checked_bytes

source = runpy.run_path(str(Path(__file__).with_name('export-masteryi-declarations.py')))
require = source['require']


def generate():
    pin, _ = source['load']()
    graph = json.loads(checked_bytes(GRAPH, GRAPH_SHA256))
    decoded = check_masters()
    checked_bytes(DECODED, DECODED_SHA256)
    nodes = {n['id']: n for n in graph['nodes']}
    masters = {m['id']: m for m in decoded['media']}

    def parameter(identity, ending):
        values = [p[2] for p in nodes[identity]['parameters'] if p[0].endswith('/' + ending)]
        require(len(values) == 1, f'Ambiguous/missing source parameter {identity}:{ending}')
        return values[0]

    def properties(identity, ranged=False):
        fields = nodes[identity]['parameters']; result = {}
        for p in fields:
            if not p[0].endswith('/pID') or ('RANGED_MODIFIERS' in p[0]) != ranged: continue
            require(p[3] is not None and '[' in p[3], 'Unresolved property ID')
            name = p[3].split('[')[-1].removesuffix(']')
            require(name not in result, 'Repeated source property')
            prefix = p[0][:-3]
            def value(suffix):
                rows = [f[2] for f in fields if f[0] == prefix + suffix]
                require(len(rows) == 1, 'Missing source property value')
                return float(rows[0])
            result[name] = [value('min'), value('max')] if ranged else value('pValue')
        return result

    def ancestors(identity):
        result = []; seen = set()
        while identity in nodes:
            require(identity not in seen, 'Cyclic source parent hierarchy')
            seen.add(identity); result.append(identity)
            rows = [p[2] for p in nodes[identity]['parameters'] if p[0].endswith('/DirectParentID')]
            identity = int(rows[0]) if rows else 0
        return result

    materials = {name: event_hash(name) for name in ['Flesh', 'Metal', 'Stone', 'Wood']}
    profiles = []; bindings = []; outputs = {}; used = set()
    for kind, spell_name in [('attack1', 'MasterYiBasicAttack'), ('crit', 'MasterYiCritAttack')]:
        spell = pin['records']['Characters/MasterYi/Spells/' + spell_name]['mSpell']
        require(spell.get('mApplyMaterialOnHitSound') is True, 'Material application flag changed')
        for phase, slot in [('cast', '12'), ('hit', '13')]:
            raw = spell['SpellEventToAudioEventSuffix'][slot]
            names = [s.strip() for s in raw.splitlines() if s.strip()]
            require(len(names) == 1, 'Expected one suffix entry')
            name = names[0]; resolution = 'declared'
            if kind == 'crit' and phase == 'hit':
                require(name == 'sfx_MasterYi_MasterYiCritAttack_OnHit', 'Critical suffix changed')
                name = 'Play_' + name; resolution = 'local-Play-prefix'
            event = next(e for e in graph['events'] if e['name'] == name)
            require(len(event['actions']) == 1, 'Primary event action count changed')
            binding = {'kind': kind, 'phase': phase, 'spell': spell_name, 'slot': slot, 'rawSuffix': raw, 'eventName': name, 'resolution': resolution}
            bindings.append(binding)
            for action_index, action in enumerate(event['actions']):
                action_props = properties(action['id'])
                require(action['type'] == 'CAkActionPlay' and set(action_props).issubset({'DelayTime'}) and properties(action['id'], True) == {}, 'Unhandled primary action modifiers')
                delay = action_props.get('DelayTime', 0) / 1000
                require(delay == (0.05 if phase == 'cast' and kind == 'attack1' else 0.2 if phase == 'cast' else 0), 'Primary action delay changed')
                require(int(parameter(action['id'], 'eFadeCurve')) == 4, 'Primary fade curve changed')
                target = action['target']; switch = nodes[target]['type'] == 'CAkSwitchCntr'
                targets = {None: target}
                if switch:
                    require(phase == 'hit' and int(parameter(target, 'ulGroupID')) == 1559186049 and int(parameter(target, 'ulDefaultSwitch')) == materials['Flesh'], 'Material switch changed')
                    require(int(parameter(target, 'ulNumSwitchGroups')) == 4 and int(parameter(target, 'u16MaxNumInstance')) == 0, 'Switch package/limit changed')
                    targets = {}
                    for i in range(4):
                        value = int(parameter(target, f'CAkSwitchPackage:{i}/ulSwitchID'))
                        label = next(k for k, v in materials.items() if v == value)
                        require(int(parameter(target, f'CAkSwitchPackage:{i}/ulNumItems')) == 1, 'Switch branch acquired multiple targets')
                        targets[label] = int(parameter(target, f'CAkSwitchPackage:{i}/NodeList/NodeID'))
                for material, container in targets.items():
                    require(nodes[container]['type'] == 'CAkRanSeqCntr', 'Unsupported primary container')
                    policy = {k: int(parameter(container, k)) for k in ['eMode', 'eRandomMode', 'wAvoidRepeatCount', 'bResetPlayListAtEachPlay', 'bIsGlobal', 'bIsContinuous', '_bIsUsingWeight', 'u16MaxNumInstance', 'bKillNewest', 'sLoopCount', 'sLoopModMin', 'sLoopModMax', 'eTransitionMode']}
                    require(policy == dict(eMode=0, eRandomMode=1, wAvoidRepeatCount=0, bResetPlayListAtEachPlay=1, bIsGlobal=1, bIsContinuous=0, _bIsUsingWeight=0, u16MaxNumInstance=4 if switch else 2, bKillNewest=0, sLoopCount=1, sLoopModMin=0, sLoopModMax=0, eTransitionMode=0), 'Primary source playback policy changed')
                    chain = ancestors(container); gain = 0; pitch = 0; ranges = []
                    for identity in chain:
                        props = properties(identity); modifiers = properties(identity, True)
                        require(set(props).issubset({'MakeUpGain', 'Pitch', 'Priority', 'AttenuationID'}), 'Unhandled inherited property')
                        require(set(modifiers).issubset({'Pitch'}), 'Unhandled ranged property')
                        gain += props.get('MakeUpGain', 0); pitch += props.get('Pitch', 0)
                        for prop, limits in modifiers.items(): ranges.append({'nodeId': identity, 'property': prop, 'minimum': limits[0], 'maximum': limits[1]})
                    variants = []
                    for i in range(int(parameter(container, 'ulPlayListItem'))):
                        sound = int(parameter(container, f'AkPlaylistItem:{i}/ulPlayID'))
                        require(int(parameter(container, f'AkPlaylistItem:{i}/weight')) == 50000 and int(parameter(sound, 'DirectParentID')) == container, 'Primary playlist changed')
                        props = properties(sound)
                        require(set(props).issubset({'MakeUpGain', 'Priority'}) and props.get('Priority', 56) == 56 and properties(sound, True) == {}, 'Unhandled primary sound properties')
                        identity = int(parameter(sound, 'sourceID')); master = masters[identity]
                        require(master['sampleRate'] == 44100 and master['channels'] == 1 and master['decoderMetadata']['loopingInfo'] is None, 'Primary master format/loop changed')
                        path = Path(f'public/assets/audio/masteryi-aa-{identity}.wav')
                        outputs[path] = checked_bytes(MASTER_ROOT / f'{identity}.wav', master['wavSha256'], master['wavBytes'])
                        used.add(identity)
                        variants.append({'id': identity, 'soundId': sound, 'url': str(path).removeprefix('public/'), 'sha256': master['wavSha256'], 'pcmSha256': master['pcmSha256'], 'frames': master['frames'], 'sampleRate': 44100, 'channels': 1, 'durationSeconds': master['durationSeconds'], 'gainDb': props.get('MakeUpGain', 0), 'peak': master['peak']})
                    profiles.append({'kind': kind, 'phase': phase, 'actionIndex': action_index, 'eventId': event['id'], 'actionId': action['id'], 'targetId': target, 'containerId': container, 'material': material, 'gainDb': gain, 'pitchCents': pitch, 'delaySeconds': delay, 'pitchModifiers': ranges, 'policy': policy, 'variants': variants})
    require(len(profiles) == 10 and len(used) == 24, 'Primary profile/media coverage changed')
    require(properties(831186104) == {'Priority': 56, 'AttenuationID': 134343538}, 'Primary mixer changed')
    require(int(parameter(831186104, 'OverrideBusId')) == 211064428, 'Primary bus changed')
    attenuation = {'id': 134343538, 'scaling': int(parameter(134343538, 'eScaling')), 'unresolvedOutputBusId': 211064428, 'priority': 56,
        'points': [{'distance': float(parameter(134343538, f'AkRTPCGraphPoint:{i}/From')), 'storedValue': float(parameter(134343538, f'AkRTPCGraphPoint:{i}/To')), 'interpolation': int(parameter(134343538, f'AkRTPCGraphPoint:{i}/Interp'))} for i in range(3)]}
    require(attenuation['scaling'] == 2, 'Primary attenuation scaling changed')
    out = Path('src/content/masteryi-aa-audio.ts')
    raw = '// Generated source profiles. Dispatch, prefix resolution, indexed pitch/variant and bus mix are explicit local policies.\nexport const MASTER_YI_AA_AUDIO = ' + json.dumps(profiles, indent=2) + ' as const;\nexport const MASTER_YI_AA_ATTENUATION = ' + json.dumps(attenuation, indent=2) + ' as const;\n'
    outputs[out] = subprocess.check_output(['npx', 'prettier', '--stdin-filepath', str(out)], input=raw.encode())
    tails = {phase: math.ceil(max(p['delaySeconds'] + v['durationSeconds'] / 2 ** ((p['pitchCents'] + sum(m['minimum'] for m in p['pitchModifiers'])) / 1200) for p in profiles if p['phase'] == phase for v in p['variants']) * 60) for phase in ['cast', 'hit']}
    outputs[Path('src/content/masteryi-aa-audio-timing.ts')] = ('// Finite source tails include slowest authored pitch-range endpoint.\nexport const MASTER_YI_AA_CAST_TICKS = ' + str(tails['cast']) + ';\nexport const MASTER_YI_AA_HIT_TICKS = ' + str(tails['hit']) + ';\n').encode()
    reading = {'sourceGraphSha256': GRAPH_SHA256, 'decodedRecordSha256': DECODED_SHA256, 'bindings': bindings, 'selectedProfiles': len(profiles), 'media': len(used), 'wavBytes': sum(masters[i]['wavBytes'] for i in used), 'tails': tails, 'sourcePitchRanges': {'attack1': [-100, 100], 'crit': [-200, 200]}, 'sourceActionDelaysSeconds': {'attack1-cast': 0.05, 'crit-cast': 0.2, 'hit': 0}, 'limits': ['Ordinary Attack1/current critical body policy only. Attack2 and Double Strike composite dispatch remain separate.', 'The raw critical hit suffix omits Play_; prefix resolution is explicitly local, not a repaired source field.', 'Indexed pitch/variant choices and unresolved global bus mix are not native RNG/mix calibration.']}
    outputs[Path('docs/reference/masteryi/aa-audio-reading.json')] = (json.dumps(reading, indent=2) + '\n').encode()
    return list(outputs.items()), reading


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--check', action='store_true'); args = parser.parse_args()
    outputs, reading = generate(); write_outputs(outputs, args.check)
    print(json.dumps({k: reading[k] for k in ['selectedProfiles', 'media', 'wavBytes', 'tails']}))
