"""Compile complete current primary trail systems and exact rendered sample markers."""
from pathlib import Path
import argparse,json,math,runpy,struct
from masteryi_attack_trails import SOURCE_ROOT,GLB,GLB_SHA256,load,checked,require
from masteryi_primary_trail_particles import SYSTEMS,profiles
from masteryi_audio_graph import write_outputs
from masteryi_q_decode import sha
TRANSPORT=Path('docs/reference/masteryi/attack-trail-texture-transport.json')
MESH=Path('docs/reference/masteryi/attack-trail-mesh-transport.json')
TRANSPORT_SHA256='877c8dcc1750c70226ba5f08c56fb3d2621dac3d75fc95e598e3c05ddf6b363b'
MESH_SHA256='a7b5eb7e27d0f0ff64627a0eb256fb8643718ccd1d12a105e61f8bdf7fcc1673'
def jb(value):return(json.dumps(value,indent=2,allow_nan=False)+'\n').encode()
PRIMARY_BINDINGS=tuple(zip(SYSTEMS,('Attack1','Attack2','Crit'),(5.,5.,8.)))
def markers(model,glb,bindings=PRIMARY_BINDINGS):
 require(glb[:4]==b'glTF'and struct.unpack_from('<II',glb,4)==(2,len(glb))and glb[16:20]==b'JSON','Invalid primary marker GLB')
 n=struct.unpack_from('<I',glb,12)[0];doc=json.loads(glb[20:20+n]);binary=glb[28+n:];animations={a['name']:a for a in doc['animations']};graph=model['animations']['data']['Characters/MasterYi/Animations/Skin0']['mClipDataMap'];joints={i for skin in doc['skins']for i in skin['joints']}
 def alias(name):return'entry_'+name[1:-1]if name.startswith('{')else name.lower()
 def sample_times(name):
  rows=[]
  for sampler in animations[name]['samplers']:
   a=doc['accessors'][sampler['input']];v=doc['bufferViews'][a['bufferView']];require(a['componentType']==5126 and a['type']=='SCALAR'and'byteStride'not in v,'Unsupported primary marker clock accessor');offset=v.get('byteOffset',0)+a.get('byteOffset',0);rows.append(list(struct.unpack_from('<'+'f'*a['count'],binary,offset)))
  require(rows and all(row==rows[0]for row in rows)and rows[0][0]==0 and all(a<b for a,b in zip(rows[0],rows[0][1:])),'Mixed/invalid primary marker sample clocks');return rows[0]
 out=[]
 for system,parent,frame in bindings:
  root=graph[parent];require(root['__type']=='ParallelClipData'and len(root['mClipNameList'])==2,'Primary marker parent differs');default=graph[root['mClipNameList'][0]];events=[(child,key,event)for child in root['mClipNameList']for key,event in graph[child].get('mEventDataMap',{}).items()if event.get('mEffectKey')==system];require(len(events)==1,'Primary marker event closure differs');child,key,event=events[0]
  require(type(event['mStartFrame'])is float and event['mStartFrame']==frame and event['mIsLoop']is False and 'mTickDuration'not in graph[child],'Primary marker source frame/loop differs');require(default['mAnimationResourceData']==graph[child]['mAnimationResourceData'],'Primary default/event resources differ');clip=alias(root['mClipNameList'][0]);event_clip=alias(child);times=sample_times(clip);require(times==sample_times(event_clip)and frame.is_integer()and 0<=frame<len(times),'Primary marker rendered clocks differ');pair=event['mParticleEventDataPairList'];require(len(pair)==1,'Primary marker attachment count differs');bone=pair[0]['mBoneName'];nodes=[i for i,node in enumerate(doc['nodes'])if node.get('name','').lower()==bone.lower()];require(len(nodes)==1 and nodes[0]in joints,'Primary marker joint differs')
  out.append({'system':system,'parent':parent,'clip':clip,'eventClip':event_clip,'eventKey':key,'sourceFrame':frame,'renderedSeconds':times[int(frame)],'renderedDuration':times[-1],'sampleCount':len(times),'sourceBone':bone,'glbNode':nodes[0],'glbBone':doc['nodes'][nodes[0]]['name'],'profileIndex':len(out)})
 return out

def generate_outputs():
 pin,model=load();transport=json.loads(checked(TRANSPORT,TRANSPORT_SHA256));runpy.run_path('tools/assets/pack-masteryi-attack-trail-textures.py')['verify'](transport,SOURCE_ROOT);mesh=json.loads(checked(MESH,MESH_SHA256));mesh_bytes=checked(mesh['output']['path'],mesh['output']['sha256'],mesh['output']['bytes']);require(mesh['exportedCorners']==1500 and mesh['validation']=={'errors':0,'warnings':0,'roundTripAttributesExact':True},'Primary trail mesh transport differs')
 selected={e[k].lower()for system in SYSTEMS for e in pin['resources'][system]['definition']['complexEmitterDefinitionData']for k in ['texture','particleColorTexture']};known=[t for p in Path('src/content').glob('masteryi-*-particles.json')if p.name!='masteryi-primary-trail-particles.json'for t in json.loads(p.read_text()).get('textures',[])];outputs={};assets=[];urls={}
 for t in transport['textures']:
  if t['source']['path']not in selected:continue
  shared=next((k for k in known if(k['sha256'],k['bytes'])==(t['sha256'],t['bytes'])),None);url=shared['url']if shared else f"assets/effects/masteryi-primary-trail-{t['source']['wadPathHash']}.png";urls[t['source']['path']]=url;assets.append({**t,'url':url,'key':t['source']['wadPathHash']});outputs[Path('public')/url]=checked(t['path'],t['sha256'],t['bytes'])
 require(len(assets)==4 and sum(len(t['rectangles'])for t in assets)==34,'Primary trail texture/mip closure differs')
 mesh_url='assets/models/masteryi-primary-trail.glb';outputs[Path('public')/mesh_url]=mesh_bytes;defaults=json.loads(checked('docs/reference/garen-spin-defaults.json','51aaa77125b84ae77e05586d31c7e45de3037028345222a0addd1ed188debefb'))['defaults'];compiled=profiles(pin,urls,mesh_url,defaults);clock=markers(model,checked(GLB,GLB_SHA256));content={'textures':assets,'mesh':{**mesh['output'],'url':mesh_url,'source':mesh['source'],'exportedCorners':1500,'attributes':mesh['attributes']},'profiles':compiled,'markers':clock,'retainedUndispatchedSystems':sorted(set(pin['resources'])-set(SYSTEMS))};tail=math.ceil(max(p['life']['values'][0][0]for p in compiled)*60)+2;require(tail==20,'Primary trail history bound differs')
 outputs[Path('src/content/masteryi-primary-trail-particles.json')]=jb(content);outputs[Path('src/content/masteryi-primary-trail-timing.ts')]=('// Local rendered-clip marker clocks; not native callback calibration.\nexport const PRIMARY_TRAIL_HISTORY_TICKS = 20;\nexport const PRIMARY_TRAIL_MARKERS = {\n'+''.join('  '+kind+': {\n    renderedSeconds: '+repr(marker['renderedSeconds'])+',\n    renderedDuration: '+repr(marker['renderedDuration'])+',\n  },\n'for kind,marker in zip(['attack1','attack2','crit'],clock))+'} as const;\n').encode()
 reading={'format':1,'sourcePinSha256':sha(Path('docs/reference/masteryi/attack-trail-particles.json').read_bytes()),'textureTransportSha256':TRANSPORT_SHA256,'meshTransportSha256':MESH_SHA256,'profileSha256':sha(jb(content)),'markers':clock,'historyTicks':tail,'limits':['Both current ordinary and critical trails are complete. Native ordinary selection/PRNG remains uncalibrated; passive uses its separate saved event dispatch.','Literal source frames index the exact retained rendered sample clock; default/event alias arrays must match. Ceil fixed-step marker admission and the existing one-tick first update are local display policies, not native mTickDuration or callback calibration.','Current named center-joint full position/quaternion, source-X reflection and .01 transport units are explicit local placement. Raw local/particle-local omissions remain null; profile frame flags enable the joint adapter rather than attesting native controls. Rig skin-scale inheritance remains uncalibrated.','Omitted blend uses the existing local zero policy; source offsets, critical rotation, scale, lookup/default adapters and scrolling remain explicit. Both systems omit sound defaults; no audio is added.']};outputs[Path('docs/reference/masteryi/primary-trail-runtime-reading.json')]=jb(reading);return list(outputs.items()),content,reading
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');a=p.parse_args();outputs,c,r=generate_outputs();write_outputs(outputs,a.check);print(json.dumps({'profiles':len(c['profiles']),'markers':len(c['markers']),'textures':4,'mips':34,'meshCorners':1500,'historyTicks':20}))
