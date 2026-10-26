"""Deliver complete Highlander cast textures/meshes and separate local profiles."""
from pathlib import Path
import argparse,json,math,runpy
from masteryi_r_particles import SOURCE_ROOT,load,checked,require
from masteryi_r_cast import profiles
from masteryi_q_decode import sha
from masteryi_audio_graph import write_outputs
TRANSPORT=Path('docs/reference/masteryi/r-cast-texture-transport.json')
TRANSPORT_SHA256='b5e024640d924e8aaa5f209b6c7b2d6c98b030dfc5600c7273f5c645708f46e8'
MESH=Path('docs/reference/masteryi/r-cast-mesh-transport.json')
MESH_SHA256='b15e9c43540b2012ef6e1e072f358f4ee83920a3c8cae695e8628cf4c8e5b97c'
def json_bytes(x):return(json.dumps(x,indent=2,allow_nan=False)+'\n').encode()
def generate_outputs():
 pin,_=load();raw=checked(TRANSPORT,TRANSPORT_SHA256);transport=json.loads(raw)
 packer=runpy.run_path(str(Path(__file__).with_name('pack-masteryi-r-cast-textures.py')));packer['verify'](transport,SOURCE_ROOT)
 require((packer['OUTPUT']/'textures.json').read_bytes()==raw,'Highlander texture staging differs')
 known=[t for name in ['q-cast','q-contact','q-end','w-cast','w-buff']for t in json.loads(Path('src/content/masteryi-'+name+'-particles.json').read_text())['textures']]
 outputs={};assets=[];urls={}
 for t in transport['textures']:
  shared=next((k for k in known if(k['sha256'],k['bytes'])==(t['sha256'],t['bytes'])),None)
  url=shared['url']if shared else f"assets/effects/masteryi-r-cast-{t['source']['wadPathHash']}.png";urls[t['source']['path']]=url;assets.append({**t,'key':t['source']['wadPathHash'],'url':url});outputs[Path('public')/url]=checked(t['path'],t['sha256'],t['bytes'])
 mesh_transport=json.loads(checked(MESH,MESH_SHA256));meshes=[];mesh_urls={}
 for name,m in zip(['cone','fireball'],mesh_transport['meshes']):
  require(json.loads(Path(m['output']['path']+'.json').read_text())==m and m['validation']=={'errors':0,'warnings':0,'roundTripAttributesExact':True},'Highlander mesh staging/validation differs')
  url='assets/models/masteryi-r-cast-'+name+'.glb';mesh_urls[m['source']['path']]=url;meshes.append({**m,'url':url});outputs[Path('public')/url]=checked(m['output']['path'],m['output']['sha256'],m['output']['bytes'])
 defaults_path=Path('docs/reference/garen-spin-defaults.json');defaults_raw=checked(defaults_path,'51aaa77125b84ae77e05586d31c7e45de3037028345222a0addd1ed188debefb')
 compiled=profiles(pin,urls,mesh_urls,json.loads(defaults_raw)['defaults']);ends=[]
 for p in compiled:
  delay=max(1,math.ceil(p['delay']*60-1e-5));rate=p['rate']['values'][0][0]
  count=max(1,math.trunc(rate))if p['single']else max(1,math.floor(math.floor(p['emitterLife']*60)*rate/60));last=delay+(0 if p['single']else(1 if count==1 else math.ceil(count*60/rate))-1)
  ends.append(last+math.ceil(max(v[0]for v in p['life']['values'])*60)+1)
 retention=max(ends);require(retention==27 and len(assets)==10 and sum(len(t['rectangles'])for t in assets)==86 and len(meshes)==2,'Highlander cast closure/retention differs')
 content={'textures':assets,'meshes':meshes,'profiles':compiled};outputs[Path('src/content/masteryi-r-cast-particles.json')]=json_bytes(content);outputs[Path('src/content/masteryi-r-cast-timing.ts')]=f'// Complete finite authored emission/life bound on the local delayed first-update grid.\nexport const HIGHLANDER_CAST_HISTORY_TICKS = {retention};\n'.encode()
 reading={'format':1,'sourcePinSha256':sha(Path('docs/reference/masteryi/r-particles.json').read_bytes()),'transport':{'path':str(TRANSPORT),'sha256':TRANSPORT_SHA256},'meshTransport':{'path':str(MESH),'sha256':MESH_SHA256},'profileSha256':sha(json_bytes(content)),'historyTicks':retention,'readerDefaults':{'path':str(defaults_path),'sha256':sha(defaults_raw)},'limits':['Complete R_Cas only; sustained variants, attached overlay and takedown system remain separate.','Raw omitted lifetime is retained as null; the single lens burst needs no finite emission stop. Local birth phase uses zero for an unbounded emitter.','Delayed first update follows the existing Solar max(1,ceil(delay*60-1e-5)) grid; source delay remains unchanged. Native update/random/dispatch parity remains unverified.','Source mode 2 uses the existing local early-copy distortion route and raw strength 1.0; native phase/power/default mapping remains unverified.','Source-X reflection, actor-root placement, fixed cosmetic draws, omission defaults and neutral lookup product are explicit local adapters.','R_Cas omits sound; this renderer adds none. Sustained variants author a separate persistent trail cue.','Source linger fields do not extend finite visible lives.']};outputs[Path('docs/reference/masteryi/r-cast-runtime-reading.json')]=json_bytes(reading)
 return list(outputs.items()),content,reading
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args();outputs,content,reading=generate_outputs();write_outputs(outputs,args.check);print(json.dumps({'profiles':8,'textures':10,'mips':86,'meshes':2,'historyTicks':reading['historyTicks']}))
