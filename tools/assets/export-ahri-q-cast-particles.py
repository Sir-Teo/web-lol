"""Publish verified cast transports and all three explicit source profiles; no event binding."""
import argparse,json,hashlib
from pathlib import Path
from ahri_q_particles import load,checked,require,PIN_SHA256
from ahri_q_cast import profiles

TEXTURE_TRANSPORT_SHA='084c0e7c985d1cbb906113ffb7833b01842b6efc9361295d0f72a0483dd37057'
MESH_TRANSPORT_SHA='c07c5a1cb7bbe1100894a686b6beb349b10307ed2ccada4e4ddd5f285c6390cf'
FRESNEL_SHA='65898adbd59d63a8ced08aceffe98dfb2b0701e65606f47c576dbcb702680cbc'

def sha(raw):return hashlib.sha256(raw).hexdigest()
def build():
 pin,_=load();texture_raw=checked('docs/reference/ahri/q-cast-texture-transport.json',TEXTURE_TRANSPORT_SHA);transport=json.loads(texture_raw);mesh_raw=checked('docs/reference/ahri/q-cast-mesh-transport.json',MESH_TRANSPORT_SHA);mesh=json.loads(mesh_raw)
 outputs={};textures=[];urls={}
 for t in transport['textures']:
  url='assets/effects/ahri-q-cast-'+t['source']['wadPathHash']+'.png';outputs[Path('public')/url]=checked(t['path'],t['sha256'],t['bytes']);urls[t['source']['path']]=url;textures.append({**t,'url':url})
 require(len(textures)==4 and sum(len(t['rectangles'])for t in textures)==28,'Incomplete Q cast mip closure')
 mesh_url='assets/effects/ahri-q-cast-swirls.glb';outputs[Path('public')/mesh_url]=checked(mesh['glb']['path'],mesh['glb']['sha256'],mesh['glb']['bytes'])
 fresnel_path=Path('src/content/leona-w-skin-fresnel.json');fresnel_raw=checked(fresnel_path,FRESNEL_SHA);compiled=profiles(pin,urls,mesh_url,json.loads(fresnel_raw))
 content=dict(textures=textures,meshes=[{**mesh['glb'],'url':mesh_url}],profiles=compiled)
 outputs[Path('src/content/ahri-q-cast-particles.json')]=(json.dumps(content,indent=2,allow_nan=False)+'\n').encode()
 reading=dict(format=1,sourcePinSha256=PIN_SHA256,textureTransportSha256=sha(texture_raw),meshTransportSha256=sha(mesh_raw),profileSha256=sha(outputs[Path('src/content/ahri-q-cast-particles.json')]),sharedSkinFresnel=dict(path=str(fresnel_path),sha256=sha(fresnel_raw),source=compiled[2]['reflection']['source'],mappedPower=compiled[2]['reflection']['mappedPower']),localDefaults=dict(erosionMixer=[0,0,0,1],erosionSliceWidth=1.5,erosionAddress=1,defaultAddress=0,defaultScale=[1,1,1],defaultLookupTypes=[1,0]),limits=['All three source emitters are projected. Publication does not bind rendering or simulation events.','Common checked skin-property mapping is reused at the same authored Fresnel input; native Q pixel equivalence remains unverified.','Missing constructor/sampler fields use explicit local adapter defaults. Native linger does not extend finite visible life.','Tails matches the retained native draw table; the second selector remains unmatched and no replacement is invented.','UV rotation and clamp remain explicit profile fields, not baked coordinate changes.'])
 outputs[Path('docs/reference/ahri/q-cast-particle-reading.json')]=(json.dumps(reading,indent=2)+'\n').encode();return outputs
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');a=p.parse_args();outputs=build()
 for path,raw in outputs.items():
  require(not any(p.is_symlink()for p in [path,*path.parents]),'Publication output cannot contain symlinks');require(not path.exists()or path.read_bytes()==raw,'Conflicting cast output: '+str(path));require(not a.check or path.exists(),'Missing cast output')
 if not a.check:
  for path,raw in outputs.items():
   if not path.exists():
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('xb')as out:out.write(raw)
 print(json.dumps(dict(result='passed',files=len(outputs),bytes=sum(map(len,outputs.values())),emitters=3,mips=28)))
