"""Decode every authored attack-trail mip and retain its native mesh privately."""
from pathlib import Path
import argparse,json,re,runpy,struct
from masteryi_attack_trails import PIN_SHA256,SOURCE_ROOT,load,cache_path,checked,require,canonical
from masteryi_q_decode import sha,scb_mesh
RECORD=Path('docs/reference/masteryi/attack-trail-particles-decoded.json')
OUTPUT=Path('.cache/masteryi-attack-trail-particles-decoded')
RECORD_SHA256='93bf9c506872bd7ba6d47e74588133b559c6e8f26ea548abff7e75878bcd27e1'
engine=runpy.run_path(str(Path(__file__).with_name('decode-masteryi-q-particles.py')))
PROFILE={'source_pin_sha256':PIN_SHA256,'texture_count':4,'mesh_count':1}
ANIMATION_POLICY={'nativeAnmsCheckedSeparately':4,'sharedParticleExtensionGuardUnchanged':True}

def source_profile(sources):
 pin,model=load()
 for row in pin['extraction']['files']:checked(cache_path(sources,row),row['sha256'],row['bytes'])
 # Preserve the common particle reader's allowed extensions. All original
 # animation bytes stay checked against the full source pin before selection.
 return {**pin,'extraction':{**pin['extraction'],'files':[r for r in pin['extraction']['files']if not r['path'].endswith('.anm')]}},model

def generate(sources=SOURCE_ROOT,output=OUTPUT):
 pin,model=source_profile(sources)
 outputs,record=engine['generate'](sources,output,source_load=lambda:(pin,model),**PROFILE)
 record['animationSourcePolicy']=dict(ANIMATION_POLICY)
 return outputs,record

def check_record(record_path=RECORD,sources=SOURCE_ROOT,record_sha256=RECORD_SHA256):
 pin,model=source_profile(sources)
 record=engine['check_record'](record_path,sources,record_sha256,source_load=lambda:(pin,model),**PROFILE)
 require(canonical(record.get('animationSourcePolicy'))==canonical(ANIMATION_POLICY),'Decoded animation source policy differs')
 for mesh in record['meshes']:
  data=json.loads(checked(mesh['path'],mesh['sha256'],mesh['bytes']));native=scb_mesh(checked(cache_path(sources,mesh['source']),mesh['source']['sha256'],mesh['source']['bytes']))
  require(canonical(data)==canonical(native),'Decoded typed native mesh differs')
  keys=['sourceVertices','triangles','flags','sourceBounds','measuredMinMax','centralPoint','tailHex']
  require(canonical({k:mesh[k]for k in keys})==canonical({k:data[k]for k in keys}),'Decoded mesh metadata differs')
  require(mesh['byteExactNativeRoundTrip']is True and mesh['normalsGenerated']is False and type(mesh['unitScaleApplied'])is int and mesh['unitScaleApplied']==1,'Decoded mesh transport policy differs')
  points=struct.pack('<'+'f'*(len(data['sourcePoints'])*3),*(v for point in data['sourcePoints']for v in point));indices=struct.pack('<'+'I'*len(data['sourceIndices']),*data['sourceIndices'])
  require(mesh['sourcePointFloat32Sha256']==sha(points)and mesh['sourceIndexUInt32Sha256']==sha(indices)and mesh['sourceFaceRgbSha256']==sha(bytes.fromhex(data['sourceFaceRgbHex'])),'Decoded mesh stream digest differs')
 return record

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');p.add_argument('--sources',type=Path,default=SOURCE_ROOT);p.add_argument('--output',type=Path,default=OUTPUT);p.add_argument('--record',type=Path,default=RECORD);p.add_argument('--record-sha256',default=RECORD_SHA256);args=p.parse_args()
 require(re.fullmatch(r'[0-9a-f]{64}',args.record_sha256)is not None,'Decode record hash is invalid')
 if args.check:record=check_record(args.record,args.sources,args.record_sha256)
 else:
  outputs,record=generate(args.sources,args.output);data=(json.dumps(record,indent=2,allow_nan=False)+'\n').encode();require(sha(data)==args.record_sha256,'Decode build/profile differs; use separately reviewed record/output/checksum');outputs.append((args.record,data))
  for path,raw in outputs:
   if path.exists():require(path.read_bytes()==raw,'Conflicting decoded output: '+str(path))
  for path,raw in outputs:
   if not path.exists():
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('xb')as out:out.write(raw)
 print(json.dumps({'textures':len(record['textures']),'mips':sum(len(t['levels'])for t in record['textures']),'meshes':len(record['meshes']),'pngBytes':sum(m['bytes']for t in record['textures']for m in t['levels']),'mode':'check'if args.check else'decode','runtimeChanged':False}))
if __name__=='__main__':main()
