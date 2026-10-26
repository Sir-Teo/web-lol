"""Frozen Q particle on-create audio declarations, distinct from script dispatch."""
from pathlib import Path
import json
import math
from masteryi_audio_decode import DECODED, DECODED_SHA256, GRAPH, GRAPH_SHA256, MASTER_ROOT, check_masters
from masteryi_audio_graph import event_hash
from masteryi_audio_source import checked_bytes
from masteryi_q_particles import PIN_SHA256, load, require

POLICY_KEYS = ('eMode', 'eRandomMode', 'wAvoidRepeatCount', 'bResetPlayListAtEachPlay', 'bIsGlobal',
    'bIsContinuous', '_bIsUsingWeight', 'u16MaxNumInstance', 'bKillNewest', 'sLoopCount',
    'sLoopModMin', 'sLoopModMax', 'eTransitionMode')


def parameter(nodes, identity, ending):
    values = [p[2] for p in nodes[identity]['parameters'] if p[0].endswith('/' + ending)]
    require(len(values) == 1, f'Missing/ambiguous Q source parameter {identity}:{ending}')
    return values[0]


def properties(nodes, identity, ranged=False):
    fields = nodes[identity]['parameters']; result = {}
    for field in fields:
        if not field[0].endswith('/pID') or ('RANGED_MODIFIERS' in field[0]) != ranged: continue
        require(field[3] is not None and '[' in field[3], 'Unresolved Q property ID')
        name = field[3].split('[')[-1].removesuffix(']')
        require(name not in result, 'Repeated Q property')
        prefix = field[0][:-3]
        def value(suffix):
            rows = [p[2] for p in fields if p[0] == prefix + suffix]
            require(len(rows) == 1, 'Missing/ambiguous Q property value')
            result = float(rows[0]); require(math.isfinite(result), 'Nonfinite Q property value'); return result
        result[name] = [value('min'), value('max')] if ranged else value('pValue')
    return result


def ancestors(nodes, identity):
    result = []; seen = set()
    while identity:
        require(identity in nodes and identity not in seen, 'Missing/cyclic Q parent hierarchy')
        result.append(identity); seen.add(identity)
        identity = int(parameter(nodes, identity, 'DirectParentID'))
    return result


def expected_policy(cap, kill_newest):
    return dict(eMode=0, eRandomMode=1, wAvoidRepeatCount=0, bResetPlayListAtEachPlay=1, bIsGlobal=1,
        bIsContinuous=0, _bIsUsingWeight=0, u16MaxNumInstance=cap, bKillNewest=kill_newest,
        sLoopCount=1, sLoopModMin=0, sLoopModMax=0, eTransitionMode=0)


def generate():
    source, _ = load(); graph = json.loads(checked_bytes(GRAPH, GRAPH_SHA256)); decoded = check_masters()
    checked_bytes(DECODED, DECODED_SHA256)
    nodes = {n['id']: n for n in graph['nodes']}; masters = {m['id']: m for m in decoded['media']}
    bindings = [{'system': name, 'record': row['record'], 'present': 'soundOnCreateDefault' in row['definition'],
        'soundOnCreateDefault': row['definition'].get('soundOnCreateDefault')}
        for name, row in source['resources'].items()]
    require({b['system'] for b in bindings if b['present']} == {'MasterYi_Q_Cas', 'MasterYi_Q_Tar'}, 'Q on-create binding/omission closure differs')
    profiles = []; used = set()
    declarations = [('cast', 'MasterYi_Q_Cas', 'Play_sfx_MasterYi_AlphaStrike_missilecast',
                     [(8847, -12, 3, 1, [378075409]), (8848, -10, 3, 0, [642434939])]),
                    ('hit', 'MasterYi_Q_Tar', 'Play_sfx_MasterYi_AlphaStrike_hit',
                     [(8846, -11, 2, 0, [142077803, 48797763, 108844688, 555085050, 924931329])])]
    for kind, system, event_name, layers in declarations:
        require(source['resources'][system]['definition']['soundOnCreateDefault'] == event_name, 'Q declared event differs')
        events = [e for e in graph['events'] if e['name'] == event_name]
        require(len(events) == 1, 'Missing/ambiguous Q event'); event = events[0]
        require(event['id'] == event_hash(event_name) and len(event['actions']) == len(layers), 'Q event hash/action closure differs')
        for layer, (action, (container, gain, cap, kill, media_ids)) in enumerate(zip(event['actions'], layers)):
            require(action['type'] == 'CAkActionPlay' and action['target'] == container, 'Q action target/type differs')
            require(properties(nodes, action['id']) == {} and properties(nodes, action['id'], True) == {}
                    and int(parameter(nodes, action['id'], 'eFadeCurve')) == 4, 'Unhandled Q play action modifiers')
            require(nodes[container]['type'] == 'CAkRanSeqCntr' and properties(nodes, container) == {'MakeUpGain': gain}, 'Q container gain/type differs')
            ranges = properties(nodes, container, True); expected_ranges = {'Pitch': [-100, 100]} if kind == 'cast' else {}
            require(ranges == expected_ranges, 'Q pitch modifiers differ')
            chain = ancestors(nodes, container); require(chain == [container, 8845, 1056413114], 'Q source parent chain differs')
            policy = {key: int(parameter(nodes, container, key)) for key in POLICY_KEYS}
            require(policy == expected_policy(cap, kill), 'Q finite/global voice policy differs')
            require(int(parameter(nodes, container, 'ulPlayListItem')) == len(media_ids), 'Q playlist size differs')
            variants = []; sound_ids = []
            for index, media in enumerate(media_ids):
                sound = int(parameter(nodes, container, f'AkPlaylistItem:{index}/ulPlayID')); sound_ids.append(sound)
                require(int(parameter(nodes, container, f'AkPlaylistItem:{index}/weight')) == 50000, 'Q playlist weight differs')
                require(nodes[sound]['type'] == 'CAkSound' and int(parameter(nodes, sound, 'sourceID')) == media
                        and int(parameter(nodes, sound, 'DirectParentID')) == container
                        and properties(nodes, sound) == {} and properties(nodes, sound, True) == {}, 'Q leaf identity/modifiers differ')
                require(int(parameter(nodes, sound, 'OverrideBusId')) == 0 and int(parameter(nodes, sound, 'u16MaxNumInstance')) == 0, 'Q leaf routing/limit differs')
                master = masters[media]
                require(master['sampleRate'] == 44100 and master['channels'] == 1 and master['decoderMetadata']['loopingInfo'] is None, 'Q master format/loop differs')
                path = MASTER_ROOT / f'{media}.wav'; checked_bytes(path, master['wavSha256'], master['wavBytes']); used.add(media)
                variants.append({'id': media, 'soundId': sound, 'privatePath': str(path), 'sha256': master['wavSha256'],
                    'pcmSha256': master['pcmSha256'], 'bytes': master['wavBytes'], 'frames': master['frames'],
                    'sampleRate': 44100, 'channels': 1, 'durationSeconds': master['durationSeconds'], 'peak': master['peak'], 'gainDb': 0})
            require(set(action['targetNodes']) == {container, *sound_ids} and set(action['affectedMediaIds']) == set(media_ids), 'Q action media/node closure differs')
            profiles.append({'kind': kind, 'system': system, 'layer': layer, 'eventName': event_name, 'eventId': event['id'],
                'actionId': action['id'], 'containerId': container, 'ancestors': chain, 'gainDb': gain,
                'pitchCents': 0, 'pitchModifiers': [{'nodeId': container, 'property': name, 'minimum': v[0], 'maximum': v[1]} for name,v in ranges.items()],
                'delaySeconds': 0, 'policy': policy, 'variants': variants})
    require(len(profiles) == 3 and len(used) == 7, 'Q profile/media closure differs')
    require(properties(nodes, 8845) == {} and properties(nodes, 8845, True) == {}
            and properties(nodes, 1056413114) == {'Priority': 60, 'AttenuationID': 339248780}
            and properties(nodes, 1056413114, True) == {}, 'Unhandled Q inherited modifier')
    require(all(int(parameter(nodes, i, 'OverrideBusId')) == 0 for i in [8845,8846,8847,8848])
            and int(parameter(nodes, 1056413114, 'OverrideBusId')) == 1259461568
            and all(int(parameter(nodes, i, 'u16MaxNumInstance')) == 0 for i in [8845,1056413114]), 'Q inherited routing/limits differ')
    attenuation = {'id': 339248780, 'scaling': int(parameter(nodes, 339248780, 'eScaling')),
        'unresolvedOutputBusId': 1259461568, 'priority': 60,
        'points': [{'distance': float(parameter(nodes, 339248780, f'AkRTPCGraphPoint:{i}/From')),
                    'storedValue': float(parameter(nodes, 339248780, f'AkRTPCGraphPoint:{i}/To')),
                    'interpolation': int(parameter(nodes, 339248780, f'AkRTPCGraphPoint:{i}/Interp'))} for i in range(6)]}
    require(attenuation['scaling'] == 2 and len([p for p in nodes[339248780]['parameters'] if p[0].endswith('/From')]) == 6, 'Q attenuation curve differs')
    tails = {kind: math.ceil(max(v['durationSeconds'] / 2 ** ((p['pitchCents'] + sum(m['minimum'] for m in p['pitchModifiers'])) / 1200)
        for p in profiles if p['kind'] == kind for v in p['variants']) * 60) for kind in ['cast', 'hit']}
    return {'format': 1, 'particleSourceSha256': PIN_SHA256, 'audioGraphSha256': GRAPH_SHA256,
        'decodedRecordSha256': DECODED_SHA256, 'bindings': bindings, 'profiles': profiles, 'attenuation': attenuation,
        'tails': tails, 'media': 7, 'wavBytes': sum(masters[m]['wavBytes'] for m in used),
        'peaksAboveOne': sum(masters[m]['peak'] > 1 for m in used), 'peak': max(masters[m]['peak'] for m in used),
        'limits': ['Declared particle soundOnCreateDefault bindings only. Native Q script/particle creation callbacks remain unverified.',
            'Critical target and audio-named dummy omit the binding; no critical or dummy sound is inferred.',
            'Native gains, pitch ranges, finite policies, oldest/newest voice limits and attenuation remain declarations. Indexed choice, admission, dispatch and unresolved bus mixing need explicit local runtime adapters.',
            'Private float masters retain headroom, rate, channels and samples without normalization, clipping or resampling. No new public WAVs or runtime state in this preparation.']}
