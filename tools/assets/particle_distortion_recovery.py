"""Restore exact frozen shader resources, Metal libraries, bitcode and LLVM text.
No shader/game execution. Original source pins are immutable; nonmatching text
rejects before any of the 53 canonical evidence outputs is published.
"""
from pathlib import Path
import hashlib,itertools,json,os,struct,subprocess
import native_client_restore as source
ROOT=source.ROOT
PIN=ROOT/'docs/reference/particle-distortion-shaders.json'
PIN_SHA256='d1eaaf2ebc4a8f0ba34c60028db9aff61f1beddd201c7ade14a63d2ee9517ca2'
CACHE=Path('.cache/particle-distortion-shaders')
WORK=Path('.cache/particle-distortion-recovery')
require=source.require
sha=source.sha

def load(path=PIN):
 raw=Path(path).read_bytes();require(sha(raw)==PIN_SHA256,'Frozen distortion pin differs');pin=json.loads(raw)
 require(len(pin['programs'])==15 and len(pin['provenance']['files'])==8 and len(pin['provenance']['chunks'])==9,'Frozen shader closure differs')
 require(pin['provenance']['referenceVersion']=='16.18.8175716','Frozen shader version differs')
 return pin

def rows(pin):
 return [{**r,'path':str(CACHE/'native'/r['path'])}for r in pin['provenance']['files']]+[r[k]for r in pin['programs']for k in ['metallib','bitcode','disassembly']]

def target(row,root=ROOT):
 relative=Path(row['path']);require(not relative.is_absolute()and'..'not in relative.parts and relative.is_relative_to(CACHE),'Invalid shader evidence target')
 return Path(root)/relative

def checked(raw,row):
 require(sha(raw)==row['sha256']and('bytes'not in row or len(raw)==row['bytes']),'Frozen shader payload differs: '+row['path']);return raw

def preflight(pin,root=ROOT):
 inventory=rows(pin);require(len(inventory)==53 and len({r['path']for r in inventory})==53,'Duplicate shader evidence target')
 for row in inventory:
  path=target(row,root)
  if path.exists():checked(path.read_bytes(),row)
 return inventory

class Reader:
 def __init__(self,data):self.data=data;self.offset=0
 def read(self,fmt):
  width=struct.calcsize('<'+fmt);require(self.offset+width<=len(self.data),'Truncated shader table');out=struct.unpack_from('<'+fmt,self.data,self.offset);self.offset+=width;return out[0]if len(out)==1 else out
 def string(self):
  width=self.read('I');require(self.offset+width<=len(self.data),'Truncated shader table string');value=self.data[self.offset:self.offset+width].decode('ascii');self.offset+=width;return value

def toc(data):
 from xxhash import xxh64_intdigest
 r=Reader(data);require(r.string()=='TOC3.0','Shader TOC version differs');count,defines,bundles,stage=r.read('4I')
 require(stage in (0,1)and defines<=16 and count==2**defines and 0<bundles<=count,'Invalid shader TOC extent')
 require(r.string()=='baseDefines','Shader defines marker differs');names=[(r.string(),r.string())for _ in range(defines)]
 require(len({name for name,_ in names})==defines and r.string()=='shaders','Shader define names differ')
 hashes=[r.read('Q')for _ in range(count)];ids=[r.read('I')for _ in range(count)]
 require(r.offset==len(data)and len(set(hashes))==count and set(ids)==set(range(bundles)),'Shader TOC inventory differs')
 lookup=dict(zip(hashes,ids));selections={i:[]for i in range(bundles)}
 for bits in itertools.product((False,True),repeat=defines):
  selected=sorted(d for d,enabled in zip(names,bits)if enabled);hashed=xxh64_intdigest(''.join(f'{k}={v}'for k,v in selected));require(hashed in lookup,'Shader combination hash differs');selections[lookup[hashed]].append(dict(selected))
 return selections

def programs(data):
 r=Reader(data);result=[]
 while r.offset<len(data):
  size=r.read('I');require(size>0 and r.offset+size<=len(data),'Truncated native Metal program');raw=data[r.offset:r.offset+size];r.offset+=size;require(raw[:4]==b'MTLB','Native Metal magic differs');result.append(raw)
 require(0<len(result)<=100,'Invalid native program count');return result

def native_payloads(pin,resources):
 outputs={};tables={r['table']for r in pin['programs']};require(len(tables)==4,'Shader table closure differs')
 for row in pin['provenance']['files']:checked(resources[row['path']],row);outputs[str(CACHE/'native'/row['path'])]=resources[row['path']]
 for table in sorted(tables):
  selections=toc(resources[table]);binaries=programs(resources[table+'_0']);selected=[r for r in pin['programs']if r['table']==table]
  require(len(selections)==len(binaries)==len(selected)and{r['index']for r in selected}==set(range(len(binaries))),'Native shader program closure differs')
  for row in selected:
   require(selections[row['index']]==row['defines'],'Shader define selection differs');metal=checked(binaries[row['index']],row['metallib']);info=row['bitcode'];offset=info['offset']
   require(offset>=20 and offset+info['bytes']<=len(metal)and metal.find(bytes.fromhex('dec0170b'))==offset-20,'Metal bitcode wrapper offset differs')
   require(struct.unpack_from('<5I',metal,offset-20)==(0x0b17c0de,0,20,info['bytes'],0xffffffff),'Metal bitcode wrapper header differs')
   outputs[row['metallib']['path']]=metal;outputs[info['path']]=checked(metal[offset:offset+info['bytes']],info)
 return outputs

def verify(pin,payloads):
 require(set(payloads)=={r['path']for r in rows(pin)},'Shader payload closure differs')
 for row in rows(pin):checked(payloads[row['path']],row)
 resources={r['path']:payloads[str(CACHE/'native'/r['path'])]for r in pin['provenance']['files']};rebuilt=native_payloads(pin,resources)
 for path,data in rebuilt.items():require(payloads[path]==data,'Reconstructed native shader payload differs')
 return {'nativeResources':8,'metalPrograms':15,'bitcodePayloads':15,'exactDisassemblyPayloads':15,'canonicalPayloads':53,'nativeExecuted':False,'originalPinsChanged':False}

def check(pin,root=ROOT):
 inventory=preflight(pin,root);payloads={r['path']:target(r,root).read_bytes()for r in inventory};return verify(pin,payloads)

def publish(pin,payloads,root=ROOT):
 result=verify(pin,payloads);inventory=preflight(pin,root)
 for row in inventory:
  path=target(row,root)
  if path.exists():continue
  path.parent.mkdir(parents=True,exist_ok=True)
  with path.open('xb')as stream:stream.write(payloads[row['path']])
 return result

def reconstruct(pin,work=WORK):
 from riot_archive import RiotArchive
 from xxhash import xxh64_intdigest
 class FrozenArchive(RiotArchive):
  def prefetch(self,ranges):
   for offset,size in ranges:
    for _,chunk in self.chunks_for(offset,size):
     key=f'{chunk.chunk_id:016X}';row=pin['provenance']['chunks'].get(key)
     require(row is not None and row['offset']==chunk.offset and row['bytes']==chunk.size and row['url']==f'https://lol.dyn.riotcdn.net/channels/public/bundles/{chunk.bundle.bundle_id:016X}.bundle','Frozen shader RMAN chunk binding differs')
     raw=(ROOT/'.cache/riot-reference'/f'{key}.chunk').read_bytes();source.checked(raw,{'path':key,**row})
 paths=[r['path']for r in pin['provenance']['files']];archive=FrozenArchive({f'{xxh64_intdigest(p):016x}':p for p in paths},pin['provenance'],archive_name=pin['provenance']['archive']);archive.extract(paths,Path(work)/'native')
 require(archive.provenance()==pin['provenance'],'Frozen shader archive provenance differs')
 return native_payloads(pin,{r['path']:(Path(work)/'native'/r['path']).read_bytes()for r in pin['provenance']['files']})

def download_inputs(pin):
 receipts=[];manifest=pin['provenance']['manifest'];manifest_row={'path':'.cache/riot-reference/29CE6E781C3B6368.manifest','bytes':16683525,**manifest}
 chunks=[{'path':f'.cache/riot-reference/{key}.chunk',**row,'range':[row['offset'],row['offset']+row['bytes']-1]}for key,row in pin['provenance']['chunks'].items()]
 for row in [manifest_row,*chunks]:
  path=ROOT/row['path']
  if path.exists():source.checked(path.read_bytes(),row)
 for row in [manifest_row,*chunks]:
  path=ROOT/row['path']
  if path.exists():continue
  raw,receipt=source.fetch(row);path.parent.mkdir(parents=True,exist_ok=True)
  with path.open('xb')as stream:stream.write(raw)
  receipts.append({'path':row['path'],**receipt})
 return receipts

def disassemble(pin,payloads,work,compiler,library_dirs=()):
 sandbox=Path(work).resolve()/'compiler-sandbox';sandbox.mkdir(parents=True,exist_ok=True);logs=[];env=dict(os.environ)
 if library_dirs:env['LD_LIBRARY_PATH']=':'.join(str(Path(p).resolve())for p in library_dirs)
 compiler=str(Path(compiler).resolve())
 for row in pin['programs']:
  relative=Path(row['bitcode']['path']);input=sandbox/relative;input.parent.mkdir(parents=True,exist_ok=True);data=payloads[str(relative)]
  if input.exists():require(input.read_bytes()==data,'Conflicting shader compiler input')
  else:
   with input.open('xb')as stream:stream.write(data)
  output=sandbox/(relative.stem+'.ll')
  require(not output.exists(),'Shader compiler staging output already exists')
  command=[compiler,'-S','-emit-llvm','-Xclang','-disable-llvm-passes','--target=arm64-apple-macosx26.5.0',str(relative),'-o',str(output)]
  result=subprocess.run(command,cwd=sandbox,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True,timeout=30)
  payloads[row['disassembly']['path']]=checked(output.read_bytes(),row['disassembly']);logs.append({'command':command,'stderr':result.stderr,'sha256':sha(output.read_bytes())})
 return logs

def restore(pin,work=WORK,compiler=None,library_dirs=(),root=ROOT):
 inventory=preflight(pin,root)
 if all(target(r,root).exists()for r in inventory):return {**check(pin,root),'downloads':[],'compilerRuns':[],'alreadyComplete':True}
 require(compiler is not None,'Missing static compiler for shader evidence recovery')
 receipts=download_inputs(pin);payloads=reconstruct(pin,work);commands=disassemble(pin,payloads,work,compiler,library_dirs);result=publish(pin,payloads,root)
 return {**result,'downloads':receipts,'compilerRuns':commands,'alreadyComplete':False}

if __name__=='__main__':
 import argparse,tempfile
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');parser.add_argument('--work-dir',type=Path);parser.add_argument('--clang',type=Path);parser.add_argument('--library-dir',type=Path,action='append');parser.add_argument('--receipt',type=Path);args=parser.parse_args()
 if args.receipt:require(not args.receipt.exists(),'Shader recovery receipt already exists')
 pin=load()
 if args.check:result=check(pin)
 elif all(target(r).exists()for r in preflight(pin)):
  result=restore(pin)
 else:
  if args.work_dir:work=args.work_dir
  else:
   (ROOT/WORK).mkdir(parents=True,exist_ok=True);work=Path(tempfile.mkdtemp(prefix='run-',dir=ROOT/WORK))
  compiler=args.clang or ROOT/'.tools/llvm21/usr/lib/llvm-21/bin/clang'
  libraries=args.library_dir if args.library_dir is not None else([]if args.clang else[ROOT/'.tools/llvm21/usr/lib/x86_64-linux-gnu',ROOT/'.tools/llvm21/usr/lib/llvm-21/lib'])
  result=restore(pin,work,compiler,libraries)
 if args.receipt:
  args.receipt.parent.mkdir(parents=True,exist_ok=True)
  with args.receipt.open('x')as stream:stream.write(json.dumps({'sourcePinSha256':PIN_SHA256,**result},indent=2)+'\n')
 print(json.dumps({k:v for k,v in result.items()if k not in ['compilerRuns','downloads']}|{'compilerRuns':len(result.get('compilerRuns',[])),'downloads':len(result.get('downloads',[]))}))
