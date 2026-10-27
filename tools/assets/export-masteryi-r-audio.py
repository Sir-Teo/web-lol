"""Project explicit Highlander activation/deactivation cues from frozen sources."""
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
    character, _ = source['load']()
    graph = json.loads(checked_bytes(GRAPH, GRAPH_SHA256)); decoded = check_masters()
    checked_bytes(DECODED, DECODED_SHA256)
    nodes = {n['id']: n for n in graph['nodes']}; masters = {m['id']: m for m in decoded['media']}
    def parameter(identity, ending):
        rows = [p[2] for p in nodes[identity]['parameters'] if p[0].endswith('/' + ending)]
        require(len(rows) == 1, 'Missing/ambiguous source parameter: ' + ending)
        return rows[0]
    def properties(identity):
        fields = nodes[identity]['parameters']; props = {}
        for field in fields:
            if not field[0].endswith('/pID'): continue
            require('RANGED_MODIFIERS' not in field[0], 'Unsupported Highlander property range')
            require(field[3] is not None and '[' in field[3], 'Unresolved Highlander property')
            name = field[3].split('[')[-1].removesuffix(']')
            prefix = field[0][:-3]
            values = [p[2] for p in fields if p[0] == prefix + 'pValue']
            require(name not in props and len(values) == 1, 'Repeated/missing Highlander property')
            props[name] = float(values[0])
        return props
    spell = character['records']['Characters/MasterYi/Spells/HighlanderAbility/Highlander']['mSpell']
    profiles = []; bindings = []; outputs = {}; tails = {}
    for phase, slot, container, sound, media, gain in [
        ('activate', '18', 9116, 893477969, 873615538, -10),
        ('deactivate', '19', 9117, 452355718, 449771614, -14),
    ]:
        raw = spell['SpellEventToAudioEventSuffix'][slot]
        names = [s.strip() for s in raw.splitlines() if s.strip()]
        require(len(names) == 1, 'Unexpected Highlander suffix count')
        name = names[0]
        require(name == 'Play_sfx_MasterYi_Highlander_OnBuff' + ('Activate' if phase == 'activate' else 'Deactivate'), 'Highlander binding changed')
        event = next(e for e in graph['events'] if e['name'] == name)
        require(event['id'] == event_hash(name) and len(event['actions']) == 1, 'Highlander event changed')
        action = event['actions'][0]
        require(action['type'] == 'CAkActionPlay' and action['target'] == container and action['affectedMediaIds'] == [media], 'Highlander action changed')
        require(properties(action['id']) == {} and int(parameter(action['id'], 'eFadeCurve')) == 4, 'Highlander action gained modifiers')
        require(nodes[container]['type'] == 'CAkRanSeqCntr' and properties(container) == {'MakeUpGain': gain}, 'Highlander container changed')
        policy = {k: int(parameter(container, k)) for k in ['eMode', 'eRandomMode', 'wAvoidRepeatCount', 'bResetPlayListAtEachPlay', 'bIsGlobal', 'bIsContinuous', '_bIsUsingWeight', 'u16MaxNumInstance', 'bKillNewest', 'sLoopCount', 'sLoopModMin', 'sLoopModMax', 'eTransitionMode']}
        require(policy == dict(eMode=0, eRandomMode=1, wAvoidRepeatCount=0, bResetPlayListAtEachPlay=1, bIsGlobal=1, bIsContinuous=0, _bIsUsingWeight=0, u16MaxNumInstance=4, bKillNewest=0, sLoopCount=1, sLoopModMin=0, sLoopModMax=0, eTransitionMode=0), 'Highlander finite playback policy changed')
        require(int(parameter(container, 'ulPlayListItem')) == 1 and int(parameter(container, 'AkPlaylistItem:0/ulPlayID')) == sound and int(parameter(container, 'AkPlaylistItem:0/weight')) == 50000, 'Highlander playlist changed')
        require(int(parameter(container, 'DirectParentID')) == 9114 and int(parameter(9114, 'DirectParentID')) == 1056413114 and int(parameter(1056413114, 'DirectParentID')) == 0, 'Highlander parent hierarchy changed')
        require(properties(9114) == {} and properties(1056413114) == {'Priority': 60, 'AttenuationID': 339248780}, 'Highlander inherited properties changed')
        require(int(parameter(1056413114, 'OverrideBusId')) == 1259461568, 'Highlander bus changed')
        require(nodes[sound]['type'] == 'CAkSound' and int(parameter(sound, 'DirectParentID')) == container and int(parameter(sound, 'sourceID')) == media and properties(sound) == {}, 'Highlander sound changed')
        require(all(int(parameter(i, 'OverrideBusId')) == 0 for i in [container, sound, 9114]), 'Unexpected child bus override')
        require(all(int(parameter(i, 'u16MaxNumInstance')) == 0 for i in [sound, 9114, 1056413114]), 'Unexpected inherited voice limit')
        master = masters[media]
        require(master['sampleRate'] == 44100 and master['channels'] == 1 and master['decoderMetadata']['loopingInfo'] is None, 'Highlander master format/loop changed')
        path = Path(f'public/assets/audio/masteryi-r-{media}.wav')
        outputs[path] = checked_bytes(MASTER_ROOT / f'{media}.wav', master['wavSha256'], master['wavBytes'])
        clip = {'id': media, 'soundId': sound, 'url': str(path).removeprefix('public/'), 'sha256': master['wavSha256'], 'pcmSha256': master['pcmSha256'], 'frames': master['frames'], 'sampleRate': 44100, 'channels': 1, 'durationSeconds': master['durationSeconds'], 'gainDb': 0, 'peak': master['peak']}
        profiles.append({'kind': phase, 'eventId': event['id'], 'actionId': action['id'], 'containerId': container, 'gainDb': gain, 'pitchCents': 0, 'delaySeconds': 0, 'policy': policy, 'variants': [clip]})
        bindings.append({'kind': phase, 'slot': slot, 'rawSuffix': raw, 'eventName': name, 'resolution': 'declared', 'ancestorIds': [container, 9114, 1056413114]})
        tails[phase] = math.ceil(master['durationSeconds'] * 60)
    require(len([p for p in nodes[339248780]['parameters'] if p[0].endswith('/From')]) == 6, 'Highlander attenuation point count changed')
    attenuation = {'id': 339248780, 'scaling': int(parameter(339248780, 'eScaling')), 'unresolvedOutputBusId': 1259461568, 'priority': 60, 'points': [{'distance': float(parameter(339248780, f'AkRTPCGraphPoint:{i}/From')), 'storedValue': float(parameter(339248780, f'AkRTPCGraphPoint:{i}/To')), 'interpolation': int(parameter(339248780, f'AkRTPCGraphPoint:{i}/Interp'))} for i in range(6)]}
    require(attenuation['scaling'] == 2, 'Highlander attenuation scaling changed')
    out = Path('src/content/masteryi-r-audio.ts')
    raw = '// Frozen Highlander cues. Lifecycle dispatch, queue-time admission and bus mix are local adapters.\nexport const MASTER_YI_R_AUDIO = ' + json.dumps(profiles, indent=2) + ' as const;\nexport const MASTER_YI_R_ATTENUATION = ' + json.dumps(attenuation, indent=2) + ' as const;\n'
    outputs[out] = subprocess.check_output(['npx', 'prettier', '--stdin-filepath', str(out)], input=raw.encode())
    outputs[Path('src/content/masteryi-r-audio-timing.ts')] = ('// Exact finite source durations rounded up to simulation ticks.\nexport const MASTER_YI_R_ACTIVATE_TICKS = ' + str(tails['activate']) + ';\nexport const MASTER_YI_R_DEACTIVATE_TICKS = ' + str(tails['deactivate']) + ';\n').encode()
    reading = {'sourceGraphSha256': GRAPH_SHA256, 'decodedRecordSha256': DECODED_SHA256, 'bindings': bindings, 'media': 2, 'wavBytes': sum(len(v) for p, v in outputs.items() if p.suffix == '.wav'), 'tails': tails, 'attenuationId': 339248780, 'unresolvedOutputBusId': 1259461568, 'limits': ['Activation dispatch at accepted local R and deactivation only at natural buff expiry. Death/recast/match end retain finite activation tails without inventing a deactivation.', 'No Highlander trail dispatch or native bus/listening/lifecycle calibration.']}
    outputs[Path('docs/reference/masteryi/r-audio-reading.json')] = (json.dumps(reading, indent=2) + '\n').encode()
    return list(outputs.items()), reading


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--check', action='store_true'); args = parser.parse_args()
    outputs, reading = generate(); write_outputs(outputs, args.check)
    print(json.dumps({k: reading[k] for k in ['media', 'wavBytes', 'tails', 'attenuationId', 'unresolvedOutputBusId']}))
