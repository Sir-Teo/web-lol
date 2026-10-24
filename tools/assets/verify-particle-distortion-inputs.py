"""Verify retained distortion TOCs/bundles/Metal/AIR/text without compilation,
network, or native execution. --hashes recomputes define hashes with xxhash.
"""
import argparse,hashlib,itertools,json,struct
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--hashes',action='store_true');args=parser.parse_args()
if args.hashes:
 from xxhash import xxh64_intdigest
pin=json.loads(Path('docs/reference/particle-distortion-shaders.json').read_text());root=Path('.cache/particle-distortion-shaders/native')
sha=lambda b:hashlib.sha256(b).hexdigest()
for p in pin['provenance']['files']:
 data=(root/p['path']).read_bytes();assert len(data)==p['bytes'];assert sha(data)==p['sha256']
by_table={}
for p in pin['programs']:by_table.setdefault(p['table'],[]).append(p)
assert len(by_table)==4 and len(pin['programs'])==15
for table,records in by_table.items():
 data=(root/table).read_bytes();at=0
 def unpack(fmt):
  global at
  v=struct.unpack_from('<'+fmt,data,at);at+=struct.calcsize('<'+fmt);return v[0] if len(v)==1 else v
 def string():
  global at
  n=unpack('I');v=data[at:at+n].decode('ascii');assert len(v)==n;at+=n;return v
 assert string()=='TOC3.0';count,define_count,bundled,stage=unpack('4I');assert stage in (0,1)
 assert string()=='baseDefines';defines=[(string(),string()) for _ in range(define_count)]
 assert string()=='shaders';hashes=[unpack('Q') for _ in range(count)];ids=[unpack('I') for _ in range(count)]
 assert at==len(data) and count==2**define_count and set(ids)==set(range(bundled));lookup=dict(zip(hashes,ids));assert len(lookup)==count
 if args.hashes:
  expected={xxh64_intdigest(''.join(f'{k}={v}' for k,v in sorted(d for d,on in zip(defines,bits) if on))) for bits in itertools.product((False,True),repeat=define_count)};assert expected==set(hashes)
 bundle=(root/(table+'_0')).read_bytes();offset=0;programs=[]
 while offset<len(bundle):
  n,=struct.unpack_from('<I',bundle,offset);offset+=4;b=bundle[offset:offset+n];assert n>0 and len(b)==n and b[:4]==b'MTLB';programs.append(b);offset+=n
 assert offset==len(bundle) and len(programs)==bundled==len(records)
 assert {p['index'] for p in records}==set(range(bundled))
 for p in records:
  metal=Path(p['metallib']['path']).read_bytes();bc=Path(p['bitcode']['path']).read_bytes();text=Path(p['disassembly']['path']).read_bytes()
  assert metal==programs[p['index']] and sha(metal)==p['metallib']['sha256']
  assert len(metal)==p['metallib']['bytes'];start=p['bitcode']['offset'];assert bc==metal[start:start+len(bc)] and len(bc)==p['bitcode']['bytes'] and sha(bc)==p['bitcode']['sha256'];assert bc[:4]==b'BC\xc0\xde'
  assert sha(text)==p['disassembly']['sha256'] and b'@wrapped_main' in text
  if args.hashes:
   for d in p['defines']:
    key=xxh64_intdigest(''.join(f'{k}={v}' for k,v in sorted(d.items())));assert lookup[key]==p['index']
print(json.dumps(dict(result='passed',tables=4,programs=15,streams=45,defineHashesRecomputed=args.hashes,nativeExecuted=False,compilerExecuted=False)))
