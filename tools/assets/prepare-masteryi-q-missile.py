"""Retain ordinary/AP Q missile definitions and private texture/mesh transports."""
from pathlib import Path
import argparse,copy,hashlib,json,runpy
from masteryi_q_particles import SOURCE_ROOT,load,checked,require
from masteryi_w_cast import binhash
from masteryi_audio_graph import write_outputs
TRANSPORT=Path('docs/reference/masteryi/q-missile-texture-transport.json')
TRANSPORT_SHA256='2c1b1bd451100831bdd0e6ce7043c0fc982f26dbfeeb728a296dfd3c9e174b69'
MESH=Path('docs/reference/masteryi/q-missile-mesh-transport.json')
MESH_SHA256='504984ea1b80dbbfba8fcadbe1bc507d7b20205ff459eed21ffa5a6934273b0a'
SELECTED_SHA256='353bb4babc684525d14c76984c71970a740b11fbb0711b0bb051cb92cb3da41e'
SYSTEMS=('MasterYi_Q_Mis','MasterYi_Q_AP_Mis')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def json_bytes(x):return (json.dumps(x,indent=2,allow_nan=False)+'\n').encode()
def selected(pin):
 definitions={k:pin['resources'][k]['definition']for k in SYSTEMS}
 require(sha(json.dumps(definitions,sort_keys=True,separators=(',',':'),allow_nan=False).encode())==SELECTED_SHA256,'Frozen Q missile definitions differ')
 require([len(definitions[k]['complexEmitterDefinitionData'])for k in SYSTEMS]==[5,3],'Q missile emitter closure differs')
 require(binhash('frameRate')=='{9b111ae4}','Q missile frame-rate candidate differs')
 return copy.deepcopy(definitions)
def generate_outputs():
 pin,_=load();definitions=selected(pin);transport=json.loads(checked(TRANSPORT,TRANSPORT_SHA256))
 packer=runpy.run_path('tools/assets/pack-masteryi-q-missile-textures.py');packer['verify'](transport,SOURCE_ROOT)
 require((packer['OUTPUT']/'textures.json').read_bytes()==TRANSPORT.read_bytes(),'Q missile staging record differs')
 mesh=json.loads(checked(MESH,MESH_SHA256));staged=Path(mesh['output']['path']+'.json');require(staged.read_bytes()==MESH.read_bytes(),'Q missile mesh staging differs')
 checked(mesh['output']['path'],mesh['output']['sha256'],mesh['output']['bytes']);checked(mesh['decoded']['path'],mesh['decoded']['sha256'])
 require((mesh['sourceVertices'],mesh['triangles'],mesh['exportedCorners'],mesh['flags'])==(27,24,72,5),'Q missile mesh closure differs')
 require(len(bytes.fromhex(mesh['tailHex']))==24 and not mesh['sourceHasVertexColors']and not mesh['sourceFaceRgbAppliedAsMaterial']and not mesh['normalsGenerated'],'Q missile mesh invented source attributes')
 require(mesh['validation']=={'errors':0,'warnings':0,'roundTripAttributesExact':True},'Q missile GLB validation differs')
 require(len(transport['textures'])==11 and sum(len(t['rectangles'])for t in transport['textures'])==99,'Q missile mip closure differs')
 fields=[{'system':name,'index':i,'emitter':e['emitterName'],'rawHash':'{9b111ae4}','value':e['{9b111ae4}'],'frames':e['numFrames'],'divisions':e['texDiv']}for name,d in definitions.items()for i,e in enumerate(d['complexEmitterDefinitionData'])if'{9b111ae4}'in e]
 reading={'format':1,'sourcePinSha256':sha(Path('docs/reference/masteryi/q-particles.json').read_bytes()),'selectedDefinitionsSha256':SELECTED_SHA256,'systems':definitions,'privateTextureTransport':{'path':str(TRANSPORT),'sha256':TRANSPORT_SHA256},'privateMeshTransport':{'path':str(MESH),'sha256':MESH_SHA256},'frameRateCandidate':{'name':'frameRate','hashMatches':True,'fields':fields},'mesh':mesh,'limits':['Raw definitions and private transports only; no runtime creation, public assets, gameplay or inferred AP selection.','All eight emitters retain complete fields, numeric/Boolean distinctions and omitted flags, lookup, bind and sound fields. No renderer defaults are substituted.','Raw frame-rate fields match a name candidate; native atlas animation semantics remain unverified, including AP numFrames=2 on a 1x4 grid.','Native missile creation, target/retarget timing, local transform axes, stop/destruction semantics, tails and AP branch dispatch are unresolved. Source lifetime alone does not establish the owning missile lifetime.','The AP distortion keeps raw mode 2 and strength 0.03500000014901161; source-to-shader power and phase mapping remain unverified.','Private GLB uses explicit 0.01 transport scale, expanded source corner order/UVs and a custom face-RGB audit attribute. No normals, reflection, pivot offset, winding change or invented tint.','Canonical software decoding and exact transport do not certify native compressed-texture/GPU behavior.']}
 return [(Path('docs/reference/masteryi/q-missile-particle-reading.json'),json_bytes(reading))],reading
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args();outputs,reading=generate_outputs();write_outputs(outputs,args.check);print(json.dumps({'systems':2,'emitters':8,'textures':11,'authoredMips':99,'meshCorners':72,'runtimeChanged':False}))
