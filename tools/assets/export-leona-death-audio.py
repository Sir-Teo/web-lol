"""Export untouched Leona Death3D layered masters and source policy.

--check is offline and does not run a decoder. Native invocation, cancellation and bus mix remain separate work.
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
path = Path('docs/reference/leona-death-audio.json')
graph = json.loads(path.read_text())
decoded = json.loads(Path('docs/reference/leona-death-audio-decoded.json').read_text())
require(decoded['sourceGraphSha256'] == sha(path.read_bytes()), 'Changed source graph')
require(len(graph['events']) == 1 and len(graph['nodes']) == 7 and len(graph['media']) == 2, 'Changed graph inventory')
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
require(len(decoded['media']) == 2, 'Changed decoded inventory')
for media in graph['media']:
    identity = media['id']
    encoded = (Path('.cache/leona-death-audio-media-v1-20261025') / f'{identity}.wem').read_bytes()
    require(len(encoded) == media['bytes'] and sha(encoded) == media['sha256'], 'Changed encoded master')
    m = next(m for m in decoded['media'] if m['id'] == identity)
    require(m['encodedSha256'] == media['sha256'], 'Changed encoded provenance')
    require(m['channels'] == 1 and m['sampleRate'] == 44100 and m['decoderMetadata']['loopingInfo'] is None, 'Unexpected channel/rate/loop metadata')
    raw = (Path('.cache/leona-death-audio-decoded-v1-20261025') / f'{identity}.wav').read_bytes()
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
    prefix = 'leona-death'
    url = f'assets/audio/{prefix}-{identity}.wav'
    outputs['public/' + url] = raw
    masters[identity] = dict(id=identity, url=url, sha256=m['wavSha256'], pcmSha256=m['pcmSha256'], frames=m['frames'], sampleRate=m['sampleRate'], channels=m['channels'], durationSeconds=m['durationSeconds'], peak=m['peak'])

event = graph['events'][0]
require(event['name'] == 'Play_sfx_Leona_Death3D_cast' and event['id'] == 1647906331, 'Changed Death3D event')
require(len(event['actions']) == 2, 'Changed layered action count')
profile = dict(event=dict(name=event['name'],id=event['id'],actionIds=[a['id'] for a in event['actions']]))
for i,(role,action_id,sound,media,delay_ms) in enumerate([('first',22612475,461770655,455387691,0),('second',148653763,267995038,558948421,1750)]):
    action = event['actions'][i]
    require(action['id'] == action_id and action['type'] == 'CAkActionPlay' and action['target'] == sound and action['affectedMediaIds'] == [media], 'Changed ordered layered play action')
    require(properties(action_id) == dict(values={'DelayTime':1750} if delay_ms else {},ranges={}) and int(parameter(action_id,'eFadeCurve')) == 4, 'Changed layer play delay/properties')
    require(nodes[sound]['type'] == 'CAkSound' and int(parameter(sound,'sourceID')) == media, 'Changed direct sound/media')
    require(properties(sound) == dict(values={'MakeUpGain':-10},ranges={}), 'Changed direct sound gain/pitch/loop')
    require(int(parameter(sound,'DirectParentID')) == 212757264, 'Changed sound parent')
    p = policy(sound)
    require(p.get('u16MaxNumInstance') == 4 and p.get('bKillNewest') == 0 and p.get('bIgnoreParentMaxNumInst') == 1, 'Changed direct sound admission policy')
    profile[role] = dict(actionId=action_id,targetId=sound,gainDb=-10,pitchCents=0,delaySeconds=delay_ms/1000,fadeInSeconds=0,authoredProperties=properties(sound),playProperties=properties(action_id),policy=p,variants=[dict(**masters[media],soundId=sound)],maxDurationSeconds=masters[media]['durationSeconds'],missingPropertyPolicy='Absent pitch and play transition locally bind to zero; absent first-layer delay locally binds to zero. Native omitted-property defaults remain unverified.')
require(properties(212757264) == dict(values={'Priority':55,'AttenuationID':687014649},ranges={}), 'Changed parent properties')
require(int(parameter(212757264,'DirectParentID')) == 0 and int(parameter(212757264,'OverrideBusId')) == 2232828494 and graph['unresolvedHierarchyIds'] == [2232828494], 'Changed parent/output hierarchy')
require(int(parameter(687014649,'eScaling')) == 2 and int(parameter(687014649,'curveToUse[0]')) == 0, 'Changed attenuation scale')
points = [dict(distance=float(parameter(687014649,f'AkRTPCGraphPoint:{i}/From')),storedValue=float(parameter(687014649,f'AkRTPCGraphPoint:{i}/To')),interpolation=int(parameter(687014649,f'AkRTPCGraphPoint:{i}/Interp'))) for i in range(3)]
require(points == [dict(distance=d,storedValue=v,interpolation=i) for d,v,i in [(0,0,9),(1350,0,4),(2412,-1,4)]], 'Changed death attenuation table')
root = ET.fromstring(b'<banks>'+Path(xml['path']).read_bytes()+b'</banks>')
stops=[]
for obj in root.iter('object'):
    if obj.get('name') != 'CAkActionStop':continue
    read=lambda name:int(obj.find(f".//field[@name='{name}']").get('value'))
    stops.append(dict(actionId=read('ulID'),targetId=read('idExt')))
require(len(stops) == 5 and not any(r['targetId'] in nodes for r in stops), 'Changed bounded stop audit')
profile['attenuation']=dict(id=687014649,scaling=2,points=points,unresolvedOutputBusId=2232828494)
profile['parents']=[dict(id=212757264,parentId=0,authoredProperties=properties(212757264),policy=policy(212757264))]
profile['stopAudit']=dict(scope='All five retained-bank Stop actions against seven selected/inherited nodes only.',actions=stops,matchingTargets=[])
profile['limits']=['Source preparation only; saved death facts and runtime playback remain separate.','Two ordered Play layers, with authored 1.75-second second delay, not random alternatives.','No authored sound loop and no decoded loop region; native caller/timing/animation, cancellation, effective inheritance and listener/bus mix remain unverified.']
source='// Generated by tools/assets/export-leona-death-audio.py.\n// Untouched finite masters and independent layered Play policy.\nexport const LEONA_DEATH_AUDIO = '+json.dumps(profile,indent=2)+' as const;\n'
outputs['src/content/leona-death-audio.ts']=subprocess.check_output(['node_modules/.bin/prettier','--stdin-filepath','src/content/leona-death-audio.ts'],input=source.encode())
ticks=math.ceil(max(profile[r]['delaySeconds']+profile[r]['maxDurationSeconds'] for r in ['first','second'])*60)
outputs['src/content/leona-death-audio-timing.ts']=('// Generated by tools/assets/export-leona-death-audio.py.\n// Finite source tails, including the second Play action delay, at 60 Hz.\n'+f'export const LEONA_DEATH_AUDIO_TICKS = {ticks};\n').encode()
for file,raw in outputs.items():
    dest=Path(file)
    if '--check' in sys.argv:require(dest.is_file() and dest.read_bytes()==raw,'Changed or missing output: '+file)
    elif dest.exists():require(dest.read_bytes()==raw,'Refuse changed output: '+file)
if '--check' not in sys.argv:
    for file,raw in outputs.items():
        dest=Path(file)
        if not dest.exists():dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(raw)
print(json.dumps(dict(result='passed',checkOnly='--check' in sys.argv,events=1,layers=2,media=2,shippedBytes=sum(len(b) for p,b in outputs.items() if p.endswith('.wav')),tailTicks=ticks)))
