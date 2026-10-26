"""Compile both complete Double Strike trail systems and exact rendered sample markers."""
from pathlib import Path
import argparse,json,math,runpy
from masteryi_attack_trails import SOURCE_ROOT,GLB,GLB_SHA256,load,checked,require
from masteryi_passive_trail_particles import SYSTEMS,BINDINGS,profiles
from masteryi_audio_graph import write_outputs
from masteryi_q_decode import sha
TRANSPORT=Path('docs/reference/masteryi/attack-trail-texture-transport.json')
MESH=Path('docs/reference/masteryi/attack-trail-mesh-transport.json')
TRANSPORT_SHA256='877c8dcc1750c70226ba5f08c56fb3d2621dac3d75fc95e598e3c05ddf6b363b'
MESH_SHA256='a7b5eb7e27d0f0ff64627a0eb256fb8643718ccd1d12a105e61f8bdf7fcc1673'
def jb(value):return(json.dumps(value,indent=2,allow_nan=False)+'\n').encode()
def generate_outputs():
 pin,model=load();transport=json.loads(checked(TRANSPORT,TRANSPORT_SHA256));runpy.run_path('tools/assets/pack-masteryi-attack-trail-textures.py')['verify'](transport,SOURCE_ROOT)
 mesh=json.loads(checked(MESH,MESH_SHA256));mesh_bytes=checked(mesh['output']['path'],mesh['output']['sha256'],mesh['output']['bytes']);require(mesh['exportedCorners']==1500 and mesh['validation']=={'errors':0,'warnings':0,'roundTripAttributesExact':True},'Passive trail mesh transport differs')
 selected={e[k].lower()for system in SYSTEMS for e in pin['resources'][system]['definition']['complexEmitterDefinitionData']for k in ['texture','particleColorTexture']}
 known=[t for p in Path('src/content').glob('masteryi-*-particles.json')if p.name!='masteryi-passive-trail-particles.json'for t in json.loads(p.read_text()).get('textures',[])]
 outputs={};assets=[];urls={}
 for t in transport['textures']:
  if t['source']['path']not in selected:continue
  shared=next((k for k in known if(k['sha256'],k['bytes'])==(t['sha256'],t['bytes'])),None)
  url=shared['url']if shared else f"assets/effects/masteryi-passive-trail-{t['source']['wadPathHash']}.png"
  urls[t['source']['path']]=url;assets.append({**t,'url':url,'key':t['source']['wadPathHash']});outputs[Path('public')/url]=checked(t['path'],t['sha256'],t['bytes'])
 require(len(assets)==3 and sum(len(t['rectangles'])for t in assets)==25,'Passive trail texture/mip closure differs')
 mesh_url='assets/models/masteryi-primary-trail.glb';outputs[Path('public')/mesh_url]=mesh_bytes
 defaults=json.loads(checked('docs/reference/garen-spin-defaults.json','51aaa77125b84ae77e05586d31c7e45de3037028345222a0addd1ed188debefb'))['defaults']
 compiled=profiles(pin,urls,mesh_url,defaults)
 clock=runpy.run_path(str(Path(__file__).with_name('export-masteryi-primary-trails.py')))['markers'](model,checked(GLB,GLB_SHA256),BINDINGS)
 require(all(p['blend']==4 and p['rawFlags']=={'blendMode':4,'isLocalOrientation':None,'particleIsLocalOrientation':None}for p in compiled),'Passive authored blend/local omissions differ')
 content={'textures':assets,'mesh':{**mesh['output'],'url':mesh_url,'source':mesh['source'],'exportedCorners':1500,'attributes':mesh['attributes']},'profiles':compiled,'markers':clock}
 tail=math.ceil(max(p['life']['values'][0][0]for p in compiled)*60)+2;require(tail==16,'Passive trail history bound differs')
 outputs[Path('src/content/masteryi-passive-trail-particles.json')]=jb(content)
 outputs[Path('src/content/masteryi-passive-trail-timing.ts')]=('// Local rendered-clip marker clocks; not native callback calibration.\nexport const PASSIVE_TRAIL_HISTORY_TICKS = 16;\nexport const PASSIVE_TRAIL_MARKERS = [\n'+''.join('  {\n    renderedSeconds: '+repr(m['renderedSeconds'])+',\n    renderedDuration: '+repr(m['renderedDuration'])+',\n  },\n'for m in clock)+'] as const;\n').encode()
 reading={'format':1,'sourcePinSha256':sha(Path('docs/reference/masteryi/attack-trail-particles.json').read_bytes()),'textureTransportSha256':TRANSPORT_SHA256,'meshTransportSha256':MESH_SHA256,'profileSha256':sha(jb(content)),'markers':clock,'historyTicks':tail,'limits':['Both complete authored Passive trail events retain separate marker identities on the same accepted current-controller pose. Two particle events do not establish two audio callbacks.','Literal source frames index identical retained default/event rendered clocks. Fixed-step crossing and one-tick first update are local display policies; native callback timing remains uncalibrated.','Full current named center-joint position/quaternion, source-X reflection and .01 VFX units remain local adapters. Both source blend4 values are explicit; omitted local/particle-local fields stay null.','Native rig scale inheritance, placement, shader inputs, visibility and cancellation behavior remain calibration limits.']}
 outputs[Path('docs/reference/masteryi/passive-trail-runtime-reading.json')]=jb(reading)
 return list(outputs.items()),content,reading
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');a=p.parse_args();outputs,c,r=generate_outputs();write_outputs(outputs,a.check);print(json.dumps({'profiles':2,'markers':2,'textures':3,'mips':25,'meshCorners':1500,'historyTicks':16}))
