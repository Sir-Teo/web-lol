"""Retain all three sustained Highlander variants without guessing native runtime callbacks."""
from pathlib import Path
import argparse,hashlib,json,runpy
from masteryi_r_particles import SOURCE_ROOT,load,checked,require
from masteryi_r_buff import selected,SELECTED_SHA256
from masteryi_audio_graph import write_outputs
TRANSPORT=Path('docs/reference/masteryi/r-buff-texture-transport.json')
TRANSPORT_SHA256='80f78240f37e1413bbf6724cf9efc4b12edf83b17c164db83cb5f53d97c608c4'
MESH=Path('docs/reference/masteryi/q-missile-mesh-transport.json')
MESH_SHA256='504984ea1b80dbbfba8fcadbe1bc507d7b20205ff459eed21ffa5a6934273b0a'
def sha(raw):return hashlib.sha256(raw).hexdigest()
def json_bytes(x):return(json.dumps(x,indent=2,allow_nan=False)+'\n').encode()
def generate_outputs(transport_path=TRANSPORT,packer_path=Path('tools/assets/pack-masteryi-r-buff-textures.py')):
 pin,_=load();definitions=selected(pin);transport_raw=checked(transport_path,TRANSPORT_SHA256);transport=json.loads(transport_raw)
 packer=runpy.run_path(str(packer_path));packer['verify'](transport,SOURCE_ROOT)
 require((packer['OUTPUT']/'textures.json').read_bytes()==transport_raw,'Sustained Highlander staging differs')
 require(len(transport['textures'])==6 and sum(len(t['rectangles'])for t in transport['textures'])==56,'Sustained Highlander mip closure differs')
 mesh_raw=checked(MESH,MESH_SHA256);mesh=json.loads(mesh_raw);require(Path(mesh['output']['path']+'.json').read_bytes()==mesh_raw,'Shared dash metadata staging differs');checked(mesh['output']['path'],mesh['output']['sha256'],mesh['output']['bytes']);checked(mesh['decoded']['path'],mesh['decoded']['sha256'])
 decoded=json.loads(Path('docs/reference/masteryi/r-particles-decoded.json').read_bytes());native=next(m for m in decoded['meshes']if m['source']['path']==mesh['source']['path']);require(native['source']==mesh['source']and native['sha256']==mesh['decoded']['sha256'],'Shared R/Q dash decode differs')
 require((mesh['sourceVertices'],mesh['triangles'],mesh['exportedCorners'],mesh['flags'])==(27,24,72,5)and len(bytes.fromhex(mesh['tailHex']))==24,'Shared dash geometry closure differs')
 require(mesh['validation']=={'errors':0,'warnings':0,'roundTripAttributesExact':True}and not mesh['sourceHasVertexColors']and not mesh['sourceFaceRgbAppliedAsMaterial']and not mesh['normalsGenerated'],'Shared dash invented attributes/validation differs')
 unsorted=[{'system':n,'index':i,'emitter':e['emitterName'],'times':ts}for n,d in definitions.items()for i,e in enumerate(d['complexEmitterDefinitionData'])if (ts:=e.get('Color',{}).get('dynamics',{}).get('times',[]))!=sorted(ts)]
 require(len(unsorted)==3,'Sustained Highlander unsorted source curves differ')
 fields=[{'system':n,'index':i,'emitter':e['emitterName'],'rawHash':'{9b111ae4}','value':e['{9b111ae4}'],'frames':e['numFrames'],'divisions':e['texDiv'],'uvMode':e.get('uvMode')}for n,d in definitions.items()for i,e in enumerate(d['complexEmitterDefinitionData'])if'{9b111ae4}'in e]
 reading={'format':1,'sourcePinSha256':sha(Path('docs/reference/masteryi/r-particles.json').read_bytes()),'selectedDefinitionsSha256':SELECTED_SHA256,'systems':definitions,'privateTextureTransport':{'path':str(TRANSPORT),'sha256':TRANSPORT_SHA256},'sharedPrivateMeshTransport':{'path':str(MESH),'sha256':MESH_SHA256},'mesh':mesh,'unsortedColorKeys':unsorted,'rawFrameRateCandidate':{'name':'frameRate','fields':fields},'limits':['Raw source definitions and private transports only; no renderer defaults, public assets or runtime dispatch.','All ten emitters preserve numeric/Boolean distinctions, explicit fields and omissions, with no sorting of nonmonotonic Color keys or inferred interpolation.','Rank resource names do not establish native script selection, switching, restart or buff stop/tail callbacks. Source emitter lifetimes do not establish buff lifetime.','Rate probability tables remain exact; native rate RNG, update cadence and accumulation remain unverified.','uvMode=2, frame-rate name candidate, atlas counts/divisions, random starts and independent secondary texture scroll retain their distinct source fields; native sampler/frame semantics remain unverified.','The third variant includes a locked attached-mesh overlay without a standalone SCB; actor geometry/skin sampling, bind curve .5 to -1.5 and lifecycle require separate work.','The standalone dash is the exact existing private Q missile transport, with native corners/UV/face RGB audit, explicit .01 scale and no invented normals, reflection or tint.','All three systems declare the same persistent trail sound; native lifecycle callbacks and Wwise RTPC input remain unresolved, so no flat-volume loop is invented.','Canonical software decoding and exact transport do not certify native compressed-texture/GPU/frame parity.']}
 return [(Path('docs/reference/masteryi/r-buff-particle-reading.json'),json_bytes(reading))],reading
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args();outputs,reading=generate_outputs();write_outputs(outputs,args.check);print(json.dumps({'systems':3,'emitters':10,'textures':6,'authoredMips':56,'sharedPrivateMeshCorners':72,'unsortedColorCurves':3,'runtimeChanged':False}))
