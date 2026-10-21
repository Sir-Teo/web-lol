"""Export unchanged Courage masters, including sound-level gain and loop regions."""
from pathlib import Path
import hashlib
import json
import math
import subprocess
import struct

sha = lambda b: hashlib.sha256(b).hexdigest()
graph_path = Path('docs/reference/garen-w-audio.json')
graph = json.loads(graph_path.read_text())
decoded = json.loads(Path('docs/reference/garen-w-audio-decoded.json').read_text())
assert decoded['sourceGraphSha256'] == sha(graph_path.read_bytes())
nodes = {n['id']: n for n in graph['nodes']}
def parameter(identity, ending):
    found = [p for p in nodes[identity]['parameters'] if p[0].endswith('/'+ending)]
    assert len(found) == 1, (identity, ending)
    return found[0][2]
def properties(identity):
    fields = nodes[identity]['parameters']; result = {}
    for f in fields:
        if f[0].endswith('/pID'):
            key = f[3].split('[')[-1].removesuffix(']')
            value = next(p[2] for p in fields if p[0] == f[0][:-3]+'pValue')
            assert key not in result
            result[key] = float(value)
    return result
events = {e['name']: e for e in graph['events']}
profile = {}
for role, name, target_id, gain in [('cast','OnCast',170251337,-15), ('active','OnBuffActivate',1026887969,-16),
                                  ('end','OnBuffDeactivate',567523884,-17)]:
    event = events['Play_sfx_Garen_GarenW_'+name]
    assert len(event['actions']) == 1
    action = event['actions'][0]
    assert action['target'] == target_id and not properties(action['id'])
    assert properties(target_id) == {'MakeUpGain': gain}
    assert int(parameter(target_id,'DirectParentID')) == 799359420
    policy = {k:int(parameter(target_id,k)) for k in ['eMode','eRandomMode','wAvoidRepeatCount',
        'bResetPlayListAtEachPlay','bIsGlobal','bIsContinuous','_bIsUsingWeight',
        'u16MaxNumInstance','bKillNewest','sLoopCount','sLoopModMin','sLoopModMax','eTransitionMode']}
    assert policy['eMode']==0 and policy['eRandomMode']==1 and policy['wAvoidRepeatCount']==0
    assert policy['bIsContinuous']==0 and policy['sLoopCount']==1
    assert policy['bKillNewest']==0 and policy['_bIsUsingWeight']==0
    variants = []
    for i in range(int(parameter(target_id,'ulPlayListItem'))):
        sound = int(parameter(target_id,f'AkPlaylistItem:{i}/ulPlayID'))
        media_id = int(parameter(sound,'sourceID'))
        sound_props = properties(sound)
        assert sound_props == ({'Loop':0} if role=='active' else {'MakeUpGain':-0.20000000298023224} if sound==1049819132 else {})
        assert int(parameter(target_id,f'AkPlaylistItem:{i}/weight')) == 50000
        m = next(m for m in decoded['media'] if m['id']==media_id)
        assert m['sampleRate']==44100 and m['channels']==1
        loop = m['decoderMetadata']['loopingInfo']
        assert bool(loop) == (role=='active')
        if loop:
            assert 0 <= loop['start'] < loop['end'] <= m['frames']
            # RIFF stores an inclusive endpoint; vgmstream's metadata has already
            # converted it to an exclusive end (pinned src/meta/wwise.c).
            wem=(Path('.cache/garen-w-audio-media') / f'{media_id}.wem').read_bytes()
            assert sha(wem)==m['encodedSha256']
            offset=12
            while True:
                tag,size=struct.unpack_from('<4sI',wem,offset)
                offset+=8
                assert offset+size<=len(wem)
                if tag==b'smpl':
                    smpl=wem[offset:offset+size]
                    break
                offset+=size+(size%2)
            assert struct.unpack_from('<I',smpl,28)[0]==1
            assert loop==dict(start=struct.unpack_from('<I',smpl,44)[0],end=struct.unpack_from('<I',smpl,48)[0]+1)
        raw = (Path('.cache/garen-w-audio-decoded') / f'{media_id}.wav').read_bytes()
        assert sha(raw)==m['wavSha256']
        output=Path(f'public/assets/audio/garen-w-{media_id}.wav');output.write_bytes(raw)
        variants.append(dict(id=media_id,soundId=sound,url=str(output).removeprefix('public/'),
            sha256=m['wavSha256'],pcmSha256=m['pcmSha256'],frames=m['frames'],sampleRate=m['sampleRate'],
            channels=m['channels'],durationSeconds=m['durationSeconds'],peak=m['peak'],
            gainDb=sound_props.get('MakeUpGain',0),loop=loop))
    assert {v['id'] for v in variants} == set(action['affectedMediaIds'])
    profile[role]=dict(eventId=event['id'],actionId=action['id'],targetId=target_id,gainDb=gain,
        policy=policy,variants=variants,maxDurationSeconds=max(v['durationSeconds'] for v in variants))
stop=events['Stop_sfx_Garen_GarenW_OnBuffActivate'];assert len(stop['actions'])==1
action=stop['actions'][0];assert action['target']==profile['active']['targetId']
assert properties(action['id'])=={'TransitionTime':250}
assert int(parameter(action['id'],'eFadeCurve'))==4
profile['active']['stop']=dict(eventId=stop['id'],actionId=action['id'],fadeSeconds=0.25,curve=4)
assert properties(799359420)=={} and int(parameter(799359420,'DirectParentID'))==428652767
assert properties(428652767)=={'Priority':60,'AttenuationID':339248780}
assert int(parameter(428652767,'OverrideBusId'))==1259461568
assert int(parameter(339248780,'eScaling'))==2 and int(parameter(339248780,'curveToUse[0]'))==0
points=[dict(distance=float(parameter(339248780,f'AkRTPCGraphPoint:{i}/From')),
    storedValue=float(parameter(339248780,f'AkRTPCGraphPoint:{i}/To')),
    interpolation=int(parameter(339248780,f'AkRTPCGraphPoint:{i}/Interp'))) for i in range(6)]
profile['attenuation']=dict(id=339248780,scaling=2,points=points,unresolvedOutputBusId=1259461568)
output=Path('src/content/garen-w-audio.ts')
output.write_text('// Generated by tools/assets/export-garen-w-audio.py.\n'
    '// Native dispatch, shuffle, listener/bus mix and loop-boundary listening remain unverified.\n'
    +'export const GAREN_W_AUDIO = '+json.dumps(profile,indent=2)+' as const;\n')
subprocess.run(['npx','prettier','--write',str(output)],check=True,stdout=subprocess.DEVNULL)
tail=math.ceil(max(profile['cast']['maxDurationSeconds'],profile['end']['maxDurationSeconds'],profile['active']['stop']['fadeSeconds'])*60)
Path('src/content/garen-w-audio-timing.ts').write_text('// Generated by tools/assets/export-garen-w-audio.py.\n'
    '// Retain cast, ending and stop-fade tails, including death immediately after cast.\n'
    +f'export const GAREN_W_AUDIO_TAIL_TICKS = {tail};\n')
print(json.dumps(dict(roles={k:dict(variants=len(profile[k]['variants']),gainDb=profile[k]['gainDb'],seconds=profile[k]['maxDurationSeconds']) for k in ['cast','active','end']},
    tailTicks=tail,shippedBytes=sum((Path('public')/v['url']).stat().st_size for k in ['cast','active','end'] for v in profile[k]['variants']))))
