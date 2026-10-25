"""Export untouched Leona Sunlight contact masters and source policy.

--check is offline and does not run a decoder. Runtime invocation, native random history and bus mix remain separate work.
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
path = Path('docs/reference/leona-sunlight-audio.json')
graph = json.loads(path.read_text())
decoded = json.loads(Path('docs/reference/leona-sunlight-audio-decoded.json').read_text())
require(decoded['sourceGraphSha256'] == sha(path.read_bytes()), 'Changed source graph')
require(len(graph['events']) == 1 and len(graph['nodes']) == 9 and len(graph['media']) == 3, 'Changed graph inventory')
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
require(len(decoded['media']) == 3, 'Changed decoded inventory')
for media in graph['media']:
    identity = media['id']
    encoded = (Path('.cache/leona-sunlight-audio-media-v1-20261025') / f'{identity}.wem').read_bytes()
    require(len(encoded) == media['bytes'] and sha(encoded) == media['sha256'], 'Changed encoded master')
    m = next(m for m in decoded['media'] if m['id'] == identity)
    require(m['encodedSha256'] == media['sha256'], 'Changed encoded provenance')
    require(m['channels'] == 1 and m['sampleRate'] == 44100 and m['decoderMetadata']['loopingInfo'] is None, 'Unexpected channel/rate/loop metadata')
    raw = (Path('.cache/leona-sunlight-audio-decoded-v1-20261025') / f'{identity}.wav').read_bytes()
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
    prefix = 'leona-sunlight'
    url = f'assets/audio/{prefix}-{identity}.wav'
    outputs['public/' + url] = raw
    masters[identity] = dict(id=identity, url=url, sha256=m['wavSha256'], pcmSha256=m['pcmSha256'], frames=m['frames'], sampleRate=m['sampleRate'], channels=m['channels'], durationSeconds=m['durationSeconds'], peak=m['peak'])

event = graph['events'][0]
require(event['name'] == 'Play_sfx_Leona_LeonaSunlight_hit' and event['id'] == 2146748535, 'Changed Sunlight event')
require(len(event['actions']) == 1, 'Changed action count')
action = event['actions'][0]
require(action['id'] == 917723274 and action['type'] == 'CAkActionPlay' and action['target'] == 2445, 'Changed play action')
require(properties(917723274) == dict(values={},ranges={}) and int(parameter(917723274,'eFadeCurve')) == 4, 'Changed play properties')
require(nodes[2445]['type'] == 'CAkRanSeqCntr' and properties(2445) == dict(values={'MakeUpGain':-12},ranges={}), 'Changed Sunlight container')
p = policy(2445)
expected = dict(eMode=0,eRandomMode=1,wAvoidRepeatCount=0,bResetPlayListAtEachPlay=1,bIsGlobal=1,bIsContinuous=0,_bIsUsingWeight=0,u16MaxNumInstance=2,bKillNewest=0,sLoopCount=1,sLoopModMin=0,sLoopModMax=0,eTransitionMode=0)
require(all(p.get(k) == v for k,v in expected.items()), 'Changed random/cap policy')
require(int(parameter(2445,'DirectParentID')) == 2444 and int(parameter(2445,'ulPlayListItem')) == 3, 'Changed container parent or playlist count')
variants = []
for i,(sound,media) in enumerate([(282110511,134510222),(943926914,495930967),(99903188,836514570)]):
    require(int(parameter(2445,f'AkPlaylistItem:{i}/ulPlayID')) == sound and int(parameter(2445,f'AkPlaylistItem:{i}/weight')) == 50000, 'Changed ordered playlist')
    require(int(parameter(sound,'sourceID')) == media and int(parameter(sound,'DirectParentID')) == 2445, 'Changed child/media identity')
    require(properties(sound) == dict(values={'Priority':60},ranges={}), 'Changed child properties or loop')
    variants.append(dict(**masters[media],soundId=sound,authoredProperties=properties(sound),soundPolicy=policy(sound)))
require(set(action['affectedMediaIds']) == set(masters), 'Changed affected media')
require(properties(2444) == dict(values={},ranges={}) and int(parameter(2444,'DirectParentID')) == 695650395, 'Changed actor parent')
require(properties(695650395) == dict(values={'Priority':60,'AttenuationID':339248780},ranges={}), 'Changed shared parent')
require(graph['unresolvedHierarchyIds'] == [1259461568] and int(parameter(695650395,'OverrideBusId')) == 1259461568, 'Changed unresolved bus')
require(int(parameter(339248780,'eScaling')) == 2 and int(parameter(339248780,'curveToUse[0]')) == 0, 'Changed attenuation scale')
points = [dict(distance=float(parameter(339248780,f'AkRTPCGraphPoint:{i}/From')),storedValue=float(parameter(339248780,f'AkRTPCGraphPoint:{i}/To')),interpolation=int(parameter(339248780,f'AkRTPCGraphPoint:{i}/Interp'))) for i in range(6)]
require(points == [dict(distance=d,storedValue=v,interpolation=i) for d,v,i in [(0,0,9),(1750,0,2),(2000,-0.7488113641738892,2),(2300,-0.93690425157547,2),(2750,-1,9),(3000,-1,4)]], 'Changed six-point attenuation')
root = ET.fromstring(b'<banks>'+Path(xml['path']).read_bytes()+b'</banks>')
stops = []
for obj in root.iter('object'):
    if obj.get('name') != 'CAkActionStop':continue
    read = lambda name: int(obj.find(f".//field[@name='{name}']").get('value'))
    stops.append(dict(actionId=read('ulID'),targetId=read('idExt')))
require(len(stops) == 5 and not any(r['targetId'] in nodes for r in stops), 'Changed bounded stop audit')
profile = dict(hit=dict(eventId=event['id'],actionId=action['id'],targetId=2445,gainDb=-12,pitchCents=0,fadeInSeconds=0,missingPropertyPolicy='Absent pitch, action delay and play transition locally bind to zero; native omitted defaults unverified.',authoredProperties=properties(2445),playProperties=properties(917723274),policy=p,variants=variants,maxDurationSeconds=max(v['durationSeconds'] for v in variants)),attenuation=dict(id=339248780,scaling=2,points=points,unresolvedOutputBusId=1259461568),parents=[dict(id=i,parentId=int(parameter(i,'DirectParentID')),authoredProperties=properties(i),policy=policy(i)) for i in [2444,695650395]],stopAudit=dict(scope='Five retained-bank Stop actions against all nine selected/inherited nodes only.',actions=stops,matchingTargets=[]),limits=['Source preparation only; Sunlight runtime dispatch remains separate.', 'No native caller, global shuffle sequence, effective inheritance, listener/bus mix or listening equivalence claim.', 'Untouched finite float32 masters; no authored loop or decoded loop region.'])
source = '// Generated by tools/assets/export-leona-sunlight-audio.py.\n// Untouched finite masters; native invocation/mix unverified.\nexport const LEONA_SUNLIGHT_AUDIO = '+json.dumps(profile,indent=2)+' as const;\n'
outputs['src/content/leona-sunlight-audio.ts'] = subprocess.check_output(['node_modules/.bin/prettier','--stdin-filepath','src/content/leona-sunlight-audio.ts'],input=source.encode())
# Validate every existing destination before writing any new public asset.
for file,raw in outputs.items():
    dest = Path(file)
    if '--check' in sys.argv:require(dest.is_file() and dest.read_bytes() == raw, 'Changed or missing output: '+file)
    elif dest.exists():require(dest.read_bytes() == raw, 'Refuse changed output: '+file)
if '--check' not in sys.argv:
    for file,raw in outputs.items():
        dest = Path(file)
        if not dest.exists():dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(raw)
print(json.dumps(dict(result='passed',checkOnly='--check' in sys.argv,events=1,roles=1,media=3,shippedBytes=sum(len(b) for p,b in outputs.items() if p.endswith('.wav')))))
