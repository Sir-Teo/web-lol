"""Export exact Decisive Strike masters and all five declared event policies.

QAttack has two play actions, including an authored delayed layer. Active Q
masters have no embedded loops; no synthetic looping or dispatch is assigned.
"""
from pathlib import Path
import hashlib
import json
import math
import subprocess

sha=lambda b:hashlib.sha256(b).hexdigest()
graph_path=Path('docs/reference/garen-q-audio.json')
graph=json.loads(graph_path.read_text())
decoded=json.loads(Path('docs/reference/garen-q-audio-decoded.json').read_text())
assert decoded['sourceGraphSha256']==sha(graph_path.read_bytes())
nodes={n['id']:n for n in graph['nodes']}
def parameter(identity,ending):
    found=[p for p in nodes[identity]['parameters'] if p[0].endswith('/'+ending)]
    assert len(found)==1,(identity,ending)
    return found[0][2]
def properties(identity):
    fields=nodes[identity]['parameters'];result={}
    for f in fields:
        if f[0].endswith('/pID'):
            key=f[3].split('[')[-1].removesuffix(']')
            assert key not in result
            result[key]=float(next(p[2] for p in fields if p[0]==f[0][:-3]+'pValue'))
    return result
def write_changed(path,data):
    if not path.exists() or path.read_bytes()!=data:path.write_bytes(data)
events={e['name']:e for e in graph['events']}
profile={}
seen=set()
for role,event_name,action_index,target_id,gain,delay,priority in [
    ('cast','GarenQ_OnCast',0,62560358,-12,0,False),
    ('active','GarenQ_OnBuffActivate',0,842961681,-12,0,False),
    ('end','GarenQ_OnBuffDeactivate',0,648146214,-14,0,False),
    ('attack','GarenQAttack_OnCast',0,914141523,-12,0,True),
    ('attackDelayed','GarenQAttack_OnCast',1,423223224,-14,230,True),
]:
    event=events['Play_sfx_Garen_'+event_name]
    assert len(event['actions'])==(2 if 'QAttack' in event_name else 1)
    action=event['actions'][action_index]
    assert action['type']=='CAkActionPlay' and action['target']==target_id
    assert properties(action['id'])==({'DelayTime':delay} if delay else {})
    assert properties(target_id)==dict(MakeUpGain=gain,**({'Priority':60} if priority else {}))
    assert int(parameter(target_id,'DirectParentID'))==733464103
    policy={k:int(parameter(target_id,k)) for k in ['eMode','eRandomMode','wAvoidRepeatCount',
        'bResetPlayListAtEachPlay','bIsGlobal','bIsContinuous','_bIsUsingWeight',
        'u16MaxNumInstance','bKillNewest','sLoopCount','sLoopModMin','sLoopModMax','eTransitionMode']}
    assert policy['eMode']==0 and policy['eRandomMode']==1 and policy['wAvoidRepeatCount']==0
    assert policy['bIsContinuous']==0 and policy['sLoopCount']==1
    assert policy['bKillNewest']==0 and policy['_bIsUsingWeight']==0
    assert policy['bResetPlayListAtEachPlay']==1 and policy['bIsGlobal']==1
    variants=[]
    for i in range(int(parameter(target_id,'ulPlayListItem'))):
        sound=int(parameter(target_id,f'AkPlaylistItem:{i}/ulPlayID'))
        media_id=int(parameter(sound,'sourceID'))
        sound_props=properties(sound)
        assert sound_props==({671666920:{'MakeUpGain':-2},748996764:{'MakeUpGain':-1},150080593:{'MakeUpGain':-4}}.get(sound,{}))
        assert int(parameter(sound,'DirectParentID'))==target_id
        assert int(parameter(target_id,f'AkPlaylistItem:{i}/weight'))==50000
        assert media_id not in seen;seen.add(media_id)
        m=next(m for m in decoded['media'] if m['id']==media_id)
        assert m['channels']==1 and m['sampleRate']==44100
        assert m['decoderMetadata']['loopingInfo'] is None
        raw=(Path('.cache/garen-q-audio-decoded')/f'{media_id}.wav').read_bytes()
        assert len(raw)==m['wavBytes'] and sha(raw)==m['wavSha256']
        output=Path(f'public/assets/audio/garen-q-{media_id}.wav');write_changed(output,raw)
        variants.append(dict(id=media_id,soundId=sound,url=str(output).removeprefix('public/'),
            sha256=m['wavSha256'],pcmSha256=m['pcmSha256'],frames=m['frames'],sampleRate=m['sampleRate'],
            channels=m['channels'],durationSeconds=m['durationSeconds'],peak=m['peak'],
            gainDb=sound_props.get('MakeUpGain',0),loop=None))
    assert {v['id'] for v in variants}==set(action['affectedMediaIds'])
    profile[role]=dict(eventId=event['id'],actionId=action['id'],targetId=target_id,
        gainDb=gain,delaySeconds=delay/1000,priority=60,policy=policy,variants=variants,
        maxDurationSeconds=max(v['durationSeconds'] for v in variants))
assert seen=={m['id'] for m in graph['media']} and len(seen)==13
stop=events['Stop_sfx_Garen_GarenQ_OnBuffActivate'];assert len(stop['actions'])==1
action=stop['actions'][0]
assert action['type']=='CAkActionStop' and action['target']==profile['active']['targetId']
assert properties(action['id'])=={'TransitionTime':250} and int(parameter(action['id'],'eFadeCurve'))==4
profile['active']['stop']=dict(eventId=stop['id'],actionId=action['id'],fadeSeconds=0.25,curve=4)
assert properties(733464103)=={} and int(parameter(733464103,'DirectParentID'))==428652767
assert properties(428652767)=={'Priority':60,'AttenuationID':339248780}
assert int(parameter(428652767,'OverrideBusId'))==1259461568
assert int(parameter(339248780,'eScaling'))==2 and int(parameter(339248780,'curveToUse[0]'))==0
profile['attenuation']=dict(id=339248780,scaling=2,points=[dict(
    distance=float(parameter(339248780,f'AkRTPCGraphPoint:{i}/From')),
    storedValue=float(parameter(339248780,f'AkRTPCGraphPoint:{i}/To')),
    interpolation=int(parameter(339248780,f'AkRTPCGraphPoint:{i}/Interp'))) for i in range(6)],
    unresolvedOutputBusId=1259461568)
output=Path('src/content/garen-q-audio.ts')
text='// Generated by tools/assets/export-garen-q-audio.py.\n'
text+='// Native dispatch, selection, bus mix and listening remain unverified.\n'
text+='export const GAREN_Q_AUDIO = '+json.dumps(profile,indent=2)+' as const;\n'
formatted=subprocess.check_output(['npx','prettier','--stdin-filepath',str(output)],input=text.encode())
write_changed(output,formatted)
tail=math.ceil(max([p['delaySeconds']+p['maxDurationSeconds'] for k,p in profile.items() if k not in ['active','attenuation']]+[profile['active']['stop']['fadeSeconds']])*60)
write_changed(Path('src/content/garen-q-audio-timing.ts'),(
    '// Generated by tools/assets/export-garen-q-audio.py.\n'
    '// Cast, ending, both attack actions and active stop-fade tails at 60 Hz.\n'
    f'export const GAREN_Q_AUDIO_TAIL_TICKS = {tail};\n').encode())
print(json.dumps(dict(roles={k:dict(variants=len(p['variants']),gainDb=p['gainDb'],delaySeconds=p['delaySeconds'])
    for k,p in profile.items() if k!='attenuation'},shippedBytes=sum(m['wavBytes'] for m in decoded['media']))))
