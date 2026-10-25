"""Export untouched Leona attack masters with distinct action/container/switch policy.

--check is offline and does not run a decoder. Runtime invocation, switch choice,
filter transfer, native random history and bus mix are separate reconstruction work.
"""
from pathlib import Path
import hashlib
import json
import math
import struct
import subprocess
import sys
import xml.etree.ElementTree as ET

def require(condition, message):
    if not condition:
        raise ValueError(message)

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

require(all(arg == '--check' for arg in sys.argv[1:]), 'Unknown argument')
path = Path('docs/reference/leona-aa-audio.json')
graph = json.loads(path.read_text())
decoded = json.loads(Path('docs/reference/leona-aa-audio-decoded.json').read_text())
require(decoded['sourceGraphSha256'] == sha(path.read_bytes()), 'Changed source graph')
require(len(graph['events']) == 10 and len(graph['nodes']) == 65 and len(graph['media']) == 28, 'Changed graph inventory')
for item in graph['bankSources']:
    raw = Path(item['localPath']).read_bytes()
    require(len(raw) == item['bytes'] and sha(raw) == item['sha256'], 'Changed pinned bank')
xml = graph['parserXml']
require(sha(Path(xml['path']).read_bytes()) == xml['sha256'], 'Changed pinned XML')
nodes = {n['id']: n for n in graph['nodes']}

def parameter(identity, suffix, optional=False):
    found = [p for p in nodes[identity]['parameters'] if p[0].endswith('/' + suffix)]
    if optional and not found:
        return None
    require(len(found) == 1, (identity, suffix))
    return found[0][2]

def properties(identity):
    fields = nodes[identity]['parameters']
    result = dict(values={}, ranges={})
    for field in fields:
        if not field[0].endswith('/pID'):
            continue
        key = field[3].split('[')[-1].removesuffix(']')
        base = field[0][:-3]
        if 'RANGED_MODIFIERS' in field[0]:
            require(key not in result['ranges'], 'Repeated ranged property')
            result['ranges'][key] = {k: float(next(p[2] for p in fields if p[0] == base + k)) for k in ('min', 'max')}
        else:
            require(key not in result['values'], 'Repeated property')
            result['values'][key] = float(next(p[2] for p in fields if p[0] == base + 'pValue'))
    return result

policy_fields = ['eMode', 'eRandomMode', 'wAvoidRepeatCount', 'bResetPlayListAtEachPlay', 'bIsGlobal', 'bIsContinuous', '_bIsUsingWeight', 'u16MaxNumInstance', 'bKillNewest', 'bIgnoreParentMaxNumInst', 'sLoopCount', 'sLoopModMin', 'sLoopModMax', 'eTransitionMode', 'bUseVirtualBehavior', 'eVirtualQueueBehavior', 'eBelowThresholdBehavior', 'bPriorityOverrideParent', 'bPriorityApplyDistFactor']
def policy(identity):
    return {k: int(v) for k in policy_fields if (v := parameter(identity, k, True)) is not None}

outputs, masters = {}, {}
shared = [65890581, 99858069, 124210504, 149881516, 180033450, 256570934, 271147565]
require(len(decoded['media']) == 28, 'Changed decoded inventory')
for media in graph['media']:
    identity = media['id']
    encoded = (Path('.cache/leona-aa-audio-media-v1-20261024') / f'{identity}.wem').read_bytes()
    require(len(encoded) == media['bytes'] and sha(encoded) == media['sha256'], 'Changed encoded master')
    m = next(m for m in decoded['media'] if m['id'] == identity)
    require(m['encodedSha256'] == media['sha256'], 'Changed encoded provenance')
    require(m['channels'] == 1 and m['sampleRate'] == 44100 and m['decoderMetadata']['loopingInfo'] is None, 'Unexpected channel/rate/loop metadata')
    raw = (Path('.cache/leona-aa-audio-decoded-v1-20261024') / f'{identity}.wav').read_bytes()
    require(sha(raw) == m['wavSha256'] and len(raw) == m['wavBytes'], 'Changed decoded master')
    require(raw[:4] == b'RIFF' and raw[8:12] == b'WAVE' and struct.unpack_from('<I', raw, 4)[0] + 8 == len(raw), 'Invalid WAV')
    chunks, offset = {}, 12
    while offset < len(raw):
        tag, length = struct.unpack_from('<4sI', raw, offset)
        require(tag not in chunks and offset + 8 + length <= len(raw), 'Invalid WAV chunk')
        chunks[tag] = raw[offset + 8:offset + 8 + length]
        offset += 8 + length + length % 2
    require(offset == len(raw), 'Invalid WAV end')
    require(struct.unpack_from('<HHIIHH', chunks[b'fmt ']) == (3, 1, 44100, 176400, 4, 32), 'Invalid float master format')
    pcm = chunks[b'data']
    require(len(pcm) == m['frames'] * 4 and sha(pcm) == m['pcmSha256'], 'Changed PCM provenance')
    samples = [x[0] for x in struct.iter_unpack('<f', pcm)]
    require(samples and all(math.isfinite(x) for x in samples), 'Nonfinite PCM')
    require(max(abs(x) for x in samples) == m['peak'], 'Changed PCM peak')
    require(sum(abs(x) > 1 for x in samples) == m['samplesOutsideUnitRange'], 'Changed PCM headroom')
    require(m['durationSeconds'] == m['frames'] / 44100, 'Changed PCM duration')
    prefix = 'leona-q' if identity in shared else 'leona-aa'
    url = f'assets/audio/{prefix}-{identity}.wav'
    outputs['public/' + url] = raw
    masters[identity] = dict(id=identity, url=url, sha256=m['wavSha256'], pcmSha256=m['pcmSha256'], frames=m['frames'], sampleRate=m['sampleRate'], channels=m['channels'], durationSeconds=m['durationSeconds'], peak=m['peak'], reusedQ=identity in shared)

containers = []
for identity, parent, values, cap in [(2419,2418,{'MakeUpGain':-11},2),(2425,2424,{'MakeUpGain':-9},2),(2426,2424,{'MakeUpGain':-12},2), *[(i,474813184,{},4) for i in range(6307,6311)], (483073156,2418,{'LPF':20,'MakeUpGain':-9,'Priority':56},0)]:
    require(nodes[identity]['type'] == 'CAkRanSeqCntr', 'Unexpected random container type')
    props = properties(identity)
    require(props == dict(values=values,ranges={}), 'Changed container properties')
    require(int(parameter(identity,'DirectParentID')) == parent, 'Changed container parent')
    p = policy(identity)
    special = identity == 483073156
    expected = dict(eMode=0,eRandomMode=0 if special else 1,wAvoidRepeatCount=3 if special else 0,bResetPlayListAtEachPlay=1,bIsGlobal=1,bIsContinuous=0,_bIsUsingWeight=0,u16MaxNumInstance=cap,bKillNewest=0,sLoopCount=1,sLoopModMin=0,sLoopModMax=0,eTransitionMode=0)
    require(all(p.get(k) == v for k,v in expected.items()), 'Changed random/cap policy')
    require(int(parameter(identity,'ulPlayListItem')) == 4, 'Changed playlist count')
    variants = []
    for i in range(4):
        sound = int(parameter(identity,f'AkPlaylistItem:{i}/ulPlayID'))
        require(int(parameter(identity,f'AkPlaylistItem:{i}/weight')) == 50000, 'Changed playlist weight')
        sound_properties = properties(sound)
        expected_sound = {} if special else {'Priority':60 if identity == 2426 else 56}
        require(sound_properties == dict(values=expected_sound,ranges={}), 'Unexpected sound property or loop')
        media = int(parameter(sound,'sourceID'))
        variants.append(dict(**masters[media],soundId=sound,authoredProperties=sound_properties,soundPolicy=policy(sound)))
    containers.append(dict(id=identity,parentId=parent,authoredProperties=props,policy=p,variants=variants,maxRawDurationSeconds=max(v['durationSeconds'] for v in variants)))

switch_id = 474813184
require(properties(switch_id) == dict(values={'MakeUpGain':-14},ranges={'Pitch':dict(min=-300,max=300)}), 'Changed hit switch pitch/gain')
require(int(parameter(switch_id,'DirectParentID')) == 2418, 'Changed switch parent')
require(int(parameter(switch_id,'ulGroupID')) == 1559186049 and int(parameter(switch_id,'ulDefaultSwitch')) == 1153642577, 'Changed switch identity')
require(int(parameter(switch_id,'ulNumSwitchGroups')) == 4, 'Changed switch branch count')
branches = []
for i,value in enumerate([1153642577,2473969246,1216965916,2058049674]):
    require(int(parameter(switch_id,f'CAkSwitchPackage:{i}/ulSwitchID')) == value, 'Changed switch value')
    require(int(parameter(switch_id,f'CAkSwitchPackage:{i}/ulNumItems')) == 1, 'Changed switch items')
    child = int(parameter(switch_id,f'CAkSwitchPackage:{i}/NodeList/NodeID'))
    require(child == 6307+i, 'Changed switch child')
    props = {}
    for k in ['ulNodeID','bIsFirstOnly','bContinuePlayback','eOnSwitchMode','FadeOutTime','FadeInTime']:
        fields = [p[2] for p in nodes[switch_id]['parameters'] if f'/AkSwitchNodeParams:{i}/' in p[0] and p[0].endswith('/'+k)]
        require(len(fields) == 1, 'Missing branch parameter: '+k)
        props[k] = int(fields[0])
    require(props == dict(ulNodeID=child,bIsFirstOnly=0,bContinuePlayback=0,eOnSwitchMode=1,FadeOutTime=0,FadeInTime=0), 'Changed branch behavior')
    branches.append(dict(valueId=value,containerId=child,parameters=props))

events = []
for event in graph['events']:
    require(len(event['actions']) == 1, 'Unexpected action count')
    action = event['actions'][0]
    require(action['type'] == 'CAkActionPlay', 'Unexpected non-play action')
    suffix = event['name'].removeprefix('Play_sfx_Leona_')
    cast = suffix.endswith('_OnCast')
    critical = 'CritAttack' in suffix
    special = suffix == 'LeonaBasicAttack3_OnHit'
    target = (2425 if critical else 2419) if cast else (2426 if critical else 483073156 if special else switch_id)
    require(action['target'] == target, 'Changed event target')
    delay = 40 if suffix in ['LeonaBasicAttack_OnCast','LeonaBasicAttack4_OnCast'] else 0
    props = properties(action['id'])
    require(props == dict(values={'DelayTime':40} if delay else {},ranges={}), 'Changed play delay/properties')
    require(int(parameter(action['id'],'eFadeCurve')) == 4, 'Changed play curve')
    events.append(dict(name=event['name'],id=event['id'],actionId=action['id'],targetId=target,authoredProperties=props,delaySeconds=delay/1000,missingPropertyPolicy='Absent delay and play transition locally bind to zero; native omitted-property defaults unverified.'))

require(properties(2418) == dict(values={},ranges={}) and properties(2424) == dict(values={},ranges={}), 'Changed actor parent properties')
require(all(int(parameter(i,'DirectParentID')) == 644758313 for i in [2418,2424]), 'Changed actor ancestry')
require(properties(644758313) == dict(values={'Priority':56,'AttenuationID':134343538},ranges={}), 'Changed parent properties')
require(graph['unresolvedHierarchyIds'] == [211064428] and int(parameter(644758313,'OverrideBusId')) == 211064428, 'Changed unresolved output bus')
require(int(parameter(134343538,'eScaling')) == 2 and int(parameter(134343538,'curveToUse[0]')) == 0, 'Changed attenuation policy')
points = [dict(distance=float(parameter(134343538,f'AkRTPCGraphPoint:{i}/From')),storedValue=float(parameter(134343538,f'AkRTPCGraphPoint:{i}/To')),interpolation=int(parameter(134343538,f'AkRTPCGraphPoint:{i}/Interp'))) for i in range(3)]
require(points == [dict(distance=0,storedValue=0,interpolation=9),dict(distance=1350,storedValue=0,interpolation=4),dict(distance=2412,storedValue=-1,interpolation=4)], 'Changed attenuation table')
root = ET.fromstring(b'<banks>'+Path(xml['path']).read_bytes()+b'</banks>')
stops = []
for obj in root.iter('object'):
    if obj.get('name') != 'CAkActionStop':continue
    read = lambda name: int(obj.find(f".//field[@name='{name}']").get('value'))
    stops.append(dict(actionId=read('ulID'),targetId=read('idExt')))
require(len(stops) == 5 and not any(s['targetId'] in nodes for s in stops), 'Changed bounded stop audit')
profile = dict(events=events,containers=containers,hitSwitch=dict(id=switch_id,groupId=1559186049,defaultValueId=1153642577,parentId=2418,authoredProperties=properties(switch_id),policy=policy(switch_id),branches=branches),attenuation=dict(id=134343538,scaling=2,points=points,unresolvedOutputBusId=211064428),parents=[dict(id=i,parentId=int(parameter(i,'DirectParentID')),authoredProperties=properties(i),policy=policy(i)) for i in [2418,2424,644758313]],stopAudit=dict(scope='All five Stop actions in the retained Leona events bank, including selected and inherited targets; no global/script absence claim.',actions=stops,matchingTargets=[]),limits=['Source audio preparation only; no ordinary-attack runtime, saved attempts or invocation policy added.', 'Numeric switch IDs and ranges retain source facts; native target-material selection, random pitch distribution and global shuffle history are unobserved.', 'LPF20 is retained without inventing a frequency transfer function; effective inheritance, virtualization and unresolved listener/bus mix remain unverified.', 'No authored sound loop and no matching retained-bank stop target; no native cancellation or listening proof.', 'Seven byte-identical masters reuse existing Q WAV URLs without merging distinct container policies.'])
source = '// Generated by tools/assets/export-leona-aa-audio.py.\n// Untouched float32 masters and raw authoring policy; no native invocation/filter/mix claim.\nexport const LEONA_AA_AUDIO = '+json.dumps(profile,indent=2)+' as const;\n'
outputs['src/content/leona-aa-audio.ts'] = subprocess.check_output(['node_modules/.bin/prettier','--stdin-filepath','src/content/leona-aa-audio.ts'],input=source.encode())
for file,raw in outputs.items():
    dest = Path(file)
    if '--check' in sys.argv:
        require(dest.is_file() and dest.read_bytes() == raw, 'Changed or missing output: '+file)
    elif dest.exists():
        require(dest.read_bytes() == raw, 'Refuse changed output: '+file)
    else:
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_bytes(raw)
print(json.dumps(dict(result='passed',checkOnly='--check' in sys.argv,events=10,containers=8,media=28,reusedQ=7,newMasters=21,totalMasterBytes=sum(m['wavBytes'] for m in decoded['media']),newBytes=sum(len(raw) for file,raw in outputs.items() if file.startswith('public/assets/audio/leona-aa-')))))
