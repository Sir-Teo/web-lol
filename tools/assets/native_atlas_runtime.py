"""Bounded native atlas/quad-packet witness; static bytes and AIR text only."""
from pathlib import Path
import bisect,ctypes as c,json,runpy,struct,sys
import native_constructor_witness as witness
import native_emitter_scalar_defaults as defaults
from masteryi_audio_graph import write_outputs
from particle_distortion_recovery import toc,programs
require=witness.require
OUTPUT=Path('docs/reference/native-atlas-runtime.json')
SHADER_PIN=Path('docs/reference/particle-shaders.json')
SHADER_SHA256='6c837e13f6f4abecff49aee3bbe91b12247ccd70a2df69fec0568916d0535ca6'
LLVM=Path('/usr/lib/x86_64-linux-gnu/libLLVM.so.19.1')
LLVM_SHA256='3523f50f635d2a1ea47518a392451f2854b92823ceaf1345fb806099dd1a3b8a'
TABLE='assets/shaders/hlsl/particlesystem/quad_vs.vs-metal'
SPANS=[
 ('quad',0x1018f1bc4,0x1018f2234,'830f0e5789e38eccc9a77b376804d36a6c56b426b19ef4cdc7d4b1dbb1bf0f4c'),
 ('mesh',0x1018f2a2c,0x1018f3144,'a6b7c031b44d3fb456a8555b072d99525ccd0e61a0854fdad78a820db3ce4c4c'),
 ('billboardPacket',0x1018f11c4,0x1018f18d8,'a56f4baf062d82ef2704bd43ceac71b81cad673eb1b6ee0416bbcd77d6622b91'),
 ('localQuadPacket',0x1018f18d8,0x1018f1bc4,'e2caec71e9404dd432d7a25cbefcca94c990880ad8fd01c8d86fb48d81ca70b2'),
 ('textureInfoBinding',0x10188ee40,0x10188fc5c,'56020d2aafb2cacbede912b3a1b5c759d3a80ee22cf92561c24f9997a290f36f')]
# Each selected word is separately checked as well as the complete function hash.
WORDS=[
 (0x1018f1f44,0xb942d10c,'LDR W12, definition flags +0x2d0'),
 (0x1018f1f48,0x7944c109,'LDRH W9, definition startFrame +0x260'),
 (0x1018f1f4c,0x7944c50a,'LDRH W10, definition numFrames +0x262'),
 (0x1018f1f50,0xbd42650e,'LDR S14, definition frameRate +0x264'),
 (0x1018f1f64,0x7100051f,'CMP primitive kind, 1'),
 (0x1018f1f88,0x1e230148,'UCVTF S8, numFrames'),
 (0x1018f1f90,0x1e23012a,'UCVTF S10, startFrame'),
 (0x1018f2030,0xf94052c8,'LDR per-particle array +0xa0'),
 (0x1018f2044,0x1e2139ac,'FSUB S12, emitter +0xf0 minus particle array +0x10'),
 (0x1018f2048,0x1e2c09c1,'FMUL S1, frameRate, difference'),
 (0x1018f204c,0x1e2021c8,'FCMP frameRate, 0'),
 (0x1018f2050,0x2f00e402,'MOVI D2, 0'),
 (0x1018f2054,0x1e22cc21,'FCSEL S1, product, zero, GT'),
 (0x1018f2058,0x1f080400,'FMADD S0, per-particle fraction, numFrames, animation'),
 (0x1018f205c,0x721b019f,'TST flags, random-start mask 0x20'),
 (0x1018f2060,0x1e200c20,'FCSEL S0, animation, combined, EQ'),
 (0x1018f2064,0x1e204101,'FMOV S1, numFrames'),
 (0x1018f20c8,0x1e2a2920,'FADD S0, modulo result, startFrame'),
 (0x1018f21c8,0x370feec8,'TBNZ particle-local mask bit 1'),
 (0x1018f1840,0x6e140403,'MOV V3.S[2], continuous frame'),
 (0x1018f1848,0x0e216863,'FCVTN V3.4H, V3.4S'),
 (0x1018f184c,0xfd0008a3,'STR half4 at vertex +16'),
 (0x1018f1850,0x1e23c021,'FCVT H1, lookup U'),
 (0x1018f1858,0x1e23c042,'FCVT H2, lookup V'),
 (0x1018f1b18,0x0e216800,'Local packet FCVTN V0.4H, V0.4S'),
 (0x1018f2e74,0x5ea1b800,'Mesh FCVTZS S0, S0'),
 (0x10188efe8,0xfc48c100,'LDUR D0, definition texDiv +0x8c'),
 (0x10188efec,0x0ea0d801,'FCMEQ texDiv components, zero'),
 (0x10188eff0,0x0f03f608,'FMOV V8.2S, 1'),
 (0x10188eff4,0x2e20fd02,'FDIV V2.2S, ones, texDiv'),
 (0x10188eff8,0x0e611c41,'BIC reciprocal zero lanes'),
 (0x10188effc,0xbd0093e0,'STR texDiv.x at stack +0x90'),
 (0x10188f000,0xfc0943e1,'STUR reciprocal texDiv at stack +0x94'),
 (0x10188f004,0xb9009fff,'STR zero at stack +0x9c')]

def function_starts(data,info):
 cursor=32;command=None
 for _ in range(struct.unpack_from('<I',data,16)[0]):
  kind,length=struct.unpack_from('<II',data,cursor)
  require(length>=8 and cursor+length<=len(data),'Invalid native load command extent')
  if kind==0x26:require(command is None,'Duplicate function-start command');command=struct.unpack_from('<II',data,cursor+8)
  cursor+=length
 require(command==(info['offset'],info['bytes']),'Native function-start command differs')
 offset,length=command;encoded=data[offset:offset+length];require(len(encoded)==length and witness.sha(encoded)==info['sha256'],'Native function-start table differs')
 starts=[];address=0x100000000;value=shift=0
 for byte in encoded:
  value|=(byte&127)<<shift
  if byte&128:shift+=7;require(shift<64,'Invalid function-start integer');continue
  if value==0:break
  address+=value;starts.append(address);value=shift=0
 require(len(starts)==info['count']and starts==sorted(set(starts)),'Native function-start inventory differs')
 return starts

def imports(data,addresses):
 cursor=32;symbols=indirect=None;stubs=[]
 for _ in range(struct.unpack_from('<I',data,16)[0]):
  command,size=struct.unpack_from('<II',data,cursor)
  require(size>=8 and cursor+size<=len(data),'Invalid native import command extent')
  if command==2:symbols=struct.unpack_from('<4I',data,cursor+8)
  if command==11:indirect=struct.unpack_from('<2I',data,cursor+56)
  if command==0x19:
   count=struct.unpack_from('<I',data,cursor+64)[0];require(72+count*80<=size,'Invalid native import section extent')
   for i in range(count):
    off=cursor+72+i*80;address,length=struct.unpack_from('<QQ',data,off+32);flags,first,stride=struct.unpack_from('<III',data,off+64)
    if flags&255==8:stubs.append((address,length,first,stride))
  cursor+=size
 require(symbols is not None and indirect is not None,'Missing native import tables')
 symoff,count,stroff,strsize=symbols;indirectoff,indirectcount=indirect
 require(symoff+count*16<=len(data)and stroff+strsize<=len(data)and indirectoff+indirectcount*4<=len(data),'Native import table exceeds slice')
 rows=[]
 for address,expected in addresses:
  candidates=[s for s in stubs if s[0]<=address<s[0]+s[1]];require(len(candidates)==1,'Ambiguous native import stub')
  begin,length,first,stride=candidates[0];require(stride==12 and (address-begin)%stride==0,'Invalid native import stub alignment')
  slot=first+(address-begin)//stride;require(slot<indirectcount,'Invalid native indirect symbol index')
  index=struct.unpack_from('<I',data,indirectoff+slot*4)[0];require(index<count,'Invalid native import symbol')
  nameoff,kind,section,desc,value=struct.unpack_from('<IBBHQ',data,symoff+index*16);require(nameoff<strsize,'Invalid native import name offset')
  end=data.find(b'\0',stroff+nameoff,stroff+strsize);require(end>=0,'Unterminated native import name');name=data[stroff+nameoff:end].decode('ascii')
  require(name==expected and kind==1 and section==0 and value==0,'Native import binding differs')
  rows.append({'address':hex(address),'indirectSlot':slot,'symbolIndex':index,'name':name,'descriptor':desc})
 return rows

def verify_native(image,core):
 starts=function_starts(image.data,core['functionStarts']);spans=[]
 for name,start,end,digest in SPANS:
  slot=bisect.bisect_left(starts,start);require(starts[slot:slot+2]==[start,end],'Atlas function bounds differ: '+name)
  raw=image.at(start,end-start);require(witness.sha(raw)==digest,'Atlas function bytes differ: '+name)
  spans.append({'name':name,'start':hex(start),'next':hex(end),'bytes':len(raw),'sha256':digest,'hex':raw.hex()})
 words=[]
 for pc,word,meaning in WORDS:
  require(image.word(pc)==word,'Atlas selected instruction differs: '+meaning)
  words.append({'address':hex(pc),'word':f'{word:08x}','reading':meaning})
 branches=[]
 for pc,target in [(0x1018f2068,0x1020003c0),(0x1018f2e6c,0x1020003c0),(0x1018f2e84,0x1020003c0),(0x1018f1fbc,0x1018f18d8),(0x1018f21e8,0x1018f11c4),(0x10188f014,0x10195232c)]:
  require(image.branch(pc)==target,'Atlas direct branch differs');branches.append({'address':hex(pc),'target':hex(target)})
 require(image.page_pointer(0x10188f008,0x10188f00c,1)==0x102277770,'Atlas TEXTURE_INFO pointer differs')
 names=[]
 for address,text in [(0x102277770,'TEXTURE_INFO'),(0x1022777b2,'vParticleUVTransform'),(0x102277857,'COLOR_LOOKUP_UV')]:
  require(image.at(address,len(text)+1)==text.encode()+b'\0','Atlas literal differs');names.append({'address':hex(address),'value':text})
 native_imports=imports(image.data,[(0x1020003c0,'_fmodf'),(0x1020007c8,'_modff')])
 return {'functionSpans':spans,'selectedInstructions':words,'directBranches':branches,'literals':names,'imports':native_imports,'functionStarts':{k:v for k,v in core['functionStarts'].items()if k in ('offset','bytes','sha256','count')}}

def reconstruct_shader(pin,work):
 # Fail closed before RiotArchive's constructor can attempt a missing manifest download.
 manifest=pin['extraction']['manifest']
 require(manifest['url']=='https://lol.dyn.riotcdn.net/channels/public/releases/29CE6E781C3B6368.manifest','Atlas manifest URL differs')
 witness.pinned(Path('.cache/riot-reference/29CE6E781C3B6368.manifest'),manifest['sha256'])
 sys.path.insert(0,'.tools/cdtb')
 from riot_archive import RiotArchive
 from xxhash import xxh64_intdigest
 class FrozenArchive(RiotArchive):
  def prefetch(self,ranges):
   for offset,size in ranges:
    for _,chunk in self.chunks_for(offset,size):
     key=f'{chunk.chunk_id:016X}';row=pin['extraction']['chunks'].get(key)
     require(row is not None and row['offset']==chunk.offset and row['bytes']==chunk.size and row['url']==f'https://lol.dyn.riotcdn.net/channels/public/bundles/{chunk.bundle.bundle_id:016X}.bundle','Atlas shader RMAN binding differs')
     witness.restored.checked(Path(f'.cache/riot-reference/{key}.chunk').read_bytes(),{'path':key,**row})
 paths=[TABLE,TABLE+'_0'];archive=FrozenArchive({f'{xxh64_intdigest(p):016x}':p for p in paths},pin['extraction'],archive_name=pin['extraction']['archive']);archive.extract(paths,work/'native')
 resources={p:(work/'native'/p).read_bytes()for p in paths}
 for p,raw in resources.items():
  row=next(r for r in pin['extraction']['files']if r['path']==p);witness.restored.checked(raw,row)
 selected=next(r for r in pin['selections']if r['toc']==TABLE and r['defines']=={})
 require(selected['index']==selected['shaderId']==1 and toc(resources[TABLE])[1]==[{}],'Default quad shader selection differs')
 metal=programs(resources[TABLE+'_0'])[1];witness.restored.checked(metal,{**selected,'path':selected['output']})
 marker=metal.find(bytes.fromhex('dec0170b'));require(marker>=0 and marker+20<=len(metal),'Missing quad bitcode wrapper')
 magic,version,offset,size,cpu=struct.unpack_from('<5I',metal,marker)
 require((magic,version,offset,cpu)==(0x0b17c0de,0,20,0xffffffff)and marker+offset+size==len(metal),'Quad bitcode wrapper differs')
 bitcode=metal[marker+offset:marker+offset+size]
 require(size==4204 and witness.sha(bitcode)=='82fb97c3f753b3130c2ea653b750d01e6dbb7d776e536e686756cfb9da062d47','Quad bitcode payload differs')
 return selected,bitcode,archive.provenance()

def shader_text(bitcode,name):
 witness.pinned(LLVM,LLVM_SHA256);llvm=c.CDLL(str(LLVM));P=c.c_void_p
 def bind(name,result,args):
  f=getattr(llvm,name);f.restype=result;f.argtypes=args;return f
 version=bind('LLVMGetVersion',None,[c.POINTER(c.c_uint)]*3);values=[c.c_uint()for _ in range(3)];version(*(c.byref(v)for v in values));require([v.value for v in values]==[19,1,7],'Atlas static LLVM version differs')
 buffer=bind('LLVMCreateMemoryBufferWithMemoryRangeCopy',P,[c.c_char_p,c.c_size_t,c.c_char_p]);parse=bind('LLVMParseBitcode2',c.c_int,[P,c.POINTER(P)]);printmodule=bind('LLVMPrintModuleToString',P,[P]);free_message=bind('LLVMDisposeMessage',None,[P]);free_module=bind('LLVMDisposeModule',None,[P]);free_buffer=bind('LLVMDisposeMemoryBuffer',None,[P]);target=bind('LLVMGetTarget',c.c_char_p,[P])
 memory=buffer(bitcode,len(bitcode),name.encode());module=P()
 try:
  require(parse(memory,c.byref(module))==0,'Cannot decode pinned quad bitcode')
  require(target(module)==b'air64-apple-macosx10.11.0','Quad AIR target differs');pointer=printmodule(module)
  try:raw=c.string_at(pointer)
  finally:free_message(pointer)
 finally:
  if module:free_module(module)
  free_buffer(memory)
 require(witness.sha(raw)=='38b681d06c05b6787d944b78c9dc576e2ef80f2137a188eb94e6473e897dc3ff','Fresh quad AIR text differs')
 text=raw.decode();begin=text.index('  %8 = extractelement');end=text.index('  %25 = getelementptr',begin)
 return {'reader':{'path':str(LLVM),'sha256':LLVM_SHA256,'version':[19,1,7]},'bytes':len(raw),'sha256':witness.sha(raw),'target':'air64-apple-macosx10.11.0','atlasIr':text[begin:end],'freshAirText':text}

def observe(work=Path('.cache/native-atlas-runtime-witness')):
 core=json.loads(witness.pinned(defaults.CORE,defaults.CORE_SHA256));scalar=json.loads(witness.pinned(defaults.OUTPUT,'a6c381afaed4c5a680276794d8fa613d988d710eca0683ed8ee91cde494de6cf'))
 raw=witness.restored.checked(Path(core['native']['path']).read_bytes(),core['native']);witness.pinned(witness.PARSER,witness.PARSER_SHA256)
 data,sections=runpy.run_path(str(witness.PARSER))['arm64_sections'](raw,core['native']['architecture']);native=verify_native(witness.Image(data,sections),core)
 require(scalar['atlas']=={'startFrame':0,'numFrames':1,'frameRate':0.0},'Atlas constructor defaults differ')
 pin=json.loads(witness.pinned(SHADER_PIN,SHADER_SHA256));selection,bitcode,extraction=reconstruct_shader(pin,Path(work));shader=shader_text(bitcode,str(Path(selection['output']).with_suffix('.bc')))
 return {'format':1,'native':core['native'],'inputs':[{'path':str(defaults.CORE),'sha256':defaults.CORE_SHA256},{'path':str(defaults.OUTPUT),'sha256':witness.sha(defaults.OUTPUT.read_bytes())},{'path':str(SHADER_PIN),'sha256':SHADER_SHA256}],**native,'quadShader':{'selection':selection,'extraction':extraction,'bitcodeBytes':len(bitcode),'bitcodeSha256':witness.sha(bitcode),**shader},'reading':{'quadFrame':'startFrame + fmodf(randomFlag ? fma(fraction, numFrames, animation) : animation, numFrames); animation = frameRate > 0 ? frameRate * (emitterFieldF0 - particleArray10[index]) : 0; all CPU operations float32','quadPacket':'28 bytes per vertex: position float3 +0, packed color +12, UV0 half4 +16 (frame in z), lookup UV half2 +24; four vertices per quad','textureInfo':'[texDiv.x, texDiv.x == 0 ? 0 : 1/texDiv.x, texDiv.y == 0 ? 0 : 1/texDiv.y, 0]','quadShader':'frame = floor(ATTR8.z); row = floor(frame * TEXTURE_INFO.y); u = (frame + ATTR8.x - row * TEXTURE_INFO.x) * TEXTURE_INFO.y; v = (row + ATTR8.y) * TEXTURE_INFO.z','meshFrame':'Same random/animation modulo and start addition, followed by FCVTZS before UV transform; do not generalize the quad half-frame path to mesh emitters'},'nativeExecuted':False,'nativeShaderExecuted':False,'historicalLlvmTextReplaced':False,'limits':['Bounded static witness, not native execution or proof of actual Yi dispatch, live shader selection, later overrides or visual parity.','Emitter field +0xf0 minus per-particle array +0x10 is consistent with age; clock units and array producers are not established here. Array +0xa0 is consumed as a fraction; its RNG distribution and relation to the local indexed sampler are not established.','Quad primitive gate accepts kinds 0 and 1; default CameraQuad kind 0 is separately witnessed. Ray and mesh paths must be traced independently.','ARM64 half conversions use the active floating-point environment. Round-to-nearest-even examples are conditional on that rounding mode; this witness does not attest live FPCR.','Fresh LLVM 19 text retains the original AIR target. It is additional evidence, not a replacement for missing historical LLVM archives. Shader fast-math transformations and actual GPU arithmetic are not attested.']}

if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');parser.add_argument('--work-dir',type=Path,default=Path('.cache/native-atlas-runtime-witness'));args=parser.parse_args()
 result=observe(args.work_dir);write_outputs([(OUTPUT,(json.dumps(result,indent=2,allow_nan=False)+'\n').encode())],args.check)
 print(json.dumps({'nativeFunctions':len(result['functionSpans']),'selectedInstructions':len(result['selectedInstructions']),'imports':len(result['imports']),'shader':result['quadShader']['selection']['sha256'],'nativeExecuted':False}))
