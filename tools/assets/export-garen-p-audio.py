"""Derive recovery onset/full-file loop, authored transitions and per-role distance.

Original float masters remain unchanged. Native dispatch, bus mix and listening
are unverified. Sound Loop=0 follows pinned wwiser's infinite-loop interpretation.
"""
from pathlib import Path
import hashlib
import json
import math
import subprocess
sha=lambda b:hashlib.sha256(b).hexdigest()
graph_path=Path('docs/reference/garen-p-audio.json')
graph=json.loads(graph_path.read_text())
decoded=json.loads(Path('docs/reference/garen-p-audio-decoded.json').read_text())
assert decoded['sourceGraphSha256']==sha(graph_path.read_bytes())
nodes={n['id']:n for n in graph['nodes']}
def parameter(identity,ending):
    fields=[p for p in nodes[identity]['parameters'] if p[0].endswith('/'+ending)]
    assert len(fields)==1,(identity,ending)
    return fields[0][2]
def properties(identity):
    fields=nodes[identity]['parameters'];result={}
    for f in fields:
        if f[0].endswith('/pID'):
            key=f[3].split('[')[-1].removesuffix(']')
            assert key not in result
            result[key]=float(next(p[2] for p in fields if p[0]==f[0][:-3]+'pValue'))
    return result
def attenuation(identity,count):
    assert int(parameter(identity,'eScaling'))==2 and int(parameter(identity,'curveToUse[0]'))==0
    return dict(id=identity,scaling=2,points=[dict(distance=float(parameter(identity,f'AkRTPCGraphPoint:{i}/From')),
        storedValue=float(parameter(identity,f'AkRTPCGraphPoint:{i}/To')),
        interpolation=int(parameter(identity,f'AkRTPCGraphPoint:{i}/Interp'))) for i in range(count)])
events={e['name']:e for e in graph['events']};profile={}
for kind,suffix,target,sound,media,gain,fade,att in [
    ('onset','buffactivate',893784467,979443226,111098527,-18,0,339248780),
    ('active','OnBuffActivate',815773657,522765852,433054605,-40,.5,947191947)]:
    event=events['Play_sfx_Garen_GarenRecouperate1_'+suffix];assert len(event['actions'])==1
    action=event['actions'][0];assert action['target']==target and action['affectedMediaIds']==[media]
    assert properties(action['id'])==({'TransitionTime':500} if kind=='active' else {})
    assert int(parameter(action['id'],'eFadeCurve'))==4
    assert properties(target)==({'MakeUpGain':gain,'AttenuationID':att} if kind=='active' else {'MakeUpGain':gain})
    assert properties(sound)==({'Priority':60,'Loop':0} if kind=='active' else {'Priority':60})
    assert int(parameter(target,'DirectParentID'))==3628 and int(parameter(sound,'DirectParentID'))==target
    policy={k:int(parameter(target,k)) for k in ['eMode','eRandomMode','wAvoidRepeatCount','bResetPlayListAtEachPlay',
        'bIsGlobal','bIsContinuous','_bIsUsingWeight','u16MaxNumInstance','bKillNewest','sLoopCount','sLoopModMin','sLoopModMax','eTransitionMode']}
    assert policy==dict(eMode=0,eRandomMode=1,wAvoidRepeatCount=0,bResetPlayListAtEachPlay=1,bIsGlobal=1,
        bIsContinuous=0,_bIsUsingWeight=0,u16MaxNumInstance=4,bKillNewest=0,sLoopCount=1,sLoopModMin=0,sLoopModMax=0,eTransitionMode=0)
    assert int(parameter(target,'ulPlayListItem'))==1 and int(parameter(target,'AkPlaylistItem:0/ulPlayID'))==sound
    assert int(parameter(target,'AkPlaylistItem:0/weight'))==50000
    m=next(m for m in decoded['media'] if m['id']==media)
    assert m['sampleRate']==44100 and m['channels']==1 and m['decoderMetadata']['loopingInfo'] is None
    raw=Path(f'.cache/garen-p-audio-decoded/{media}.wav').read_bytes();assert sha(raw)==m['wavSha256']
    output=Path(f'public/assets/audio/garen-p-{media}.wav')
    if not output.exists() or output.read_bytes()!=raw:output.write_bytes(raw)
    profile[kind]=dict(eventId=event['id'],actionId=action['id'],targetId=target,gainDb=gain,priority=60,
        fadeInSeconds=fade,policy=policy,attenuation=attenuation(att,4 if kind=='active' else 6),
        clip=dict(id=media,soundId=sound,url=str(output).removeprefix('public/'),sha256=m['wavSha256'],pcmSha256=m['pcmSha256'],
            frames=m['frames'],sampleRate=m['sampleRate'],channels=1,durationSeconds=m['durationSeconds'],peak=m['peak'],
            loop=dict(start=0,end=m['frames']) if kind=='active' else None))
stop=events['Stop_sfx_Garen_GarenRecouperate1_OnBuffActivate'];assert len(stop['actions'])==1
action=stop['actions'][0];assert action['target']==profile['active']['targetId']
assert properties(action['id'])=={'TransitionTime':1000} and int(parameter(action['id'],'eFadeCurve'))==4
profile['active']['stop']=dict(eventId=stop['id'],actionId=action['id'],fadeSeconds=1,curve=4)
assert properties(3628)=={} and int(parameter(3628,'DirectParentID'))==428652767
assert properties(428652767)=={'Priority':60,'AttenuationID':339248780}
assert int(parameter(428652767,'OverrideBusId'))==1259461568
profile['unresolvedOutputBusId']=1259461568
source=json.loads(Path('docs/reference/garen-passive-particles.json').read_text())
assert source['resources']['Garen_P_Heal']['definition']['soundOnCreateDefault']=='Play_sfx_Garen_GarenRecouperate1_buffactivate'
reader=Path('.tools/wwiser/wwiser/generator/render/bnode_props.py')
reading=dict(repository='https://github.com/bnnm/wwiser',revision=graph['parserRevision'],path=str(reader),sha256=sha(reader.read_bytes()),
    interpretation='Sound property Loop=0 means infinite; no media-region markers selects the whole decoded buffer. This is the pinned reader interpretation, not native runtime observation.')
Path('docs/reference/garen-p-audio-reading.json').write_text(json.dumps(reading,indent=2)+'\n')
output=Path('src/content/garen-p-audio.ts')
output.write_text('// Generated by tools/assets/export-garen-p-audio.py.\n// Native script, listener/bus mix and loop-boundary listening remain unverified.\nexport const GAREN_P_AUDIO = '+json.dumps(profile,indent=2)+' as const;\n')
subprocess.run(['npx','prettier','--write',str(output)],check=True,stdout=subprocess.DEVNULL)
Path('src/content/garen-p-audio-timing.ts').write_text('// Generated by tools/assets/export-garen-p-audio.py.\n// Keep the onset even if healing stops immediately; the loop stop is shorter than the visual tail.\nexport const GAREN_P_ONSET_TICKS = '+str(math.ceil(profile['onset']['clip']['durationSeconds']*60))+';\n')
print(json.dumps(dict(media=2,frames=[profile[k]['clip']['frames'] for k in ['onset','active']],onsetTicks=math.ceil(profile['onset']['clip']['durationSeconds']*60),shippedBytes=sum(Path('public/'+profile[k]['clip']['url']).stat().st_size for k in ['onset','active']))))
