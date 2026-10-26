"""Direct bounded native-byte witness; no disassembler, target or shader execution."""
from pathlib import Path
import bisect,io,json,runpy,struct
import native_client_restore as restored
ROOT=restored.ROOT
DEFAULTS=ROOT/'docs/reference/leona-native-emitter-defaults.json'
DEFAULTS_SHA256='17bf7879489412c1f28b9a36a46fc15668cd40d7ad76ceb5e3a2d32893ea051e'
LOADER=ROOT/'docs/reference/leona-native-bin-loader.json'
LOADER_SHA256='2488eba52b75e2c61f36fdd960311a490092bbfd64190f0cc688ad06e27650c6'
PARSER=ROOT/'tools/assets/verify-leona-native-particle-bindings.py'
PARSER_SHA256='34884e6c3c0096dcfc27f3240bcca71db499aed7fb35dcbb0c44c677a21de058'
require=restored.require
sha=restored.sha
def pinned(path,digest):
 raw=Path(path).read_bytes();require(sha(raw)==digest,'Frozen native witness input differs: '+str(path));return raw
def number(value):return int(value,16)if isinstance(value,str)else value
class Image:
 def __init__(self,data,sections):self.data=data;self.sections=sections
 def at(self,address,count):
  address=number(address);require(type(address)is int and type(count)is int and address>=0 and count>0,'Invalid native span')
  rows=[s for s in self.sections if s['address']<=address and address+count<=s['address']+s['bytes']]
  require(len(rows)==1,'Ambiguous or unmapped native span');s=rows[0];require(s['flags']&255 not in (1,12,18),'Native span is zerofill')
  offset=s['offset']+address-s['address'];require(0<=offset and offset+count<=len(self.data),'Native span exceeds slice');return self.data[offset:offset+count]
 def word(self,address):
  address=number(address);require(address%4==0,'Unaligned native instruction');return struct.unpack('<I',self.at(address,4))[0]
 def branch(self,address,link=True):
  pc=number(address);w=self.word(pc);require(w&0xfc000000==(0x94000000 if link else 0x14000000),'Expected direct ARM64 branch')
  imm=w&0x3ffffff
  if imm&(1<<25):imm-=1<<26
  return pc+4*imm
 def movz(self,address,register,value):
  w=self.word(address);require(w&0xff80001f==(0x52800000|register),'Expected MOVZ Wn');shift=((w>>21)&3)*16
  require(shift<32 and (((w>>5)&65535)<<shift)==value,'Native MOVZ value differs')
 def pair(self,row):
  a,b=map(number,row['hashPair']);w,z=self.word(a),self.word(b)
  require(b==a+4 and w&0xffe0001f==0x52800001 and z&0xffe0001f==0x72a00001,'Expected MOVZ/MOVK W1 hash pair')
  value=((w>>5)&65535)|(((z>>5)&65535)<<16);require(value==fnv(row['name'])==number(row['hash']),'Native candidate hash differs')
 def adr(self,address,register):
  pc=number(address);w=self.word(pc);require(w&0x9f00001f==(0x10000000|register),'Expected ADR callback');imm=(((w>>5)&0x7ffff)<<2)|((w>>29)&3)
  if imm&(1<<20):imm-=1<<21
  return pc+imm
 def page_pointer(self,address,add_address,register):
  pc=number(address);w,z=self.word(pc),self.word(add_address)
  require(w&0x9f00001f==(0x90000000|register)and z&0xffc003ff==(0x91000000|(register<<5)|register),'Expected unshifted ADRP/ADD pointer')
  imm=(((w>>5)&0x7ffff)<<2)|((w>>29)&3)
  if imm&(1<<20):imm-=1<<21
  return(pc&~4095)+imm*4096+((z>>10)&4095)
def fnv(name):
 value=0x811c9dc5
 for byte in name.lower().encode('ascii'):value=((value^byte)*0x01000193)&0xffffffff
 return value

def verify_records(image,defaults,loader):
 spans=[]
 for kind,pin in [('constructor',defaults),('loader',loader)]:
  require(pin['nativeExecuted']is False and pin['nativeShaderExecuted']is False,'Unexpected native execution claim')
  for row in pin['instructionSpans']:
   label=row.get('name',row['address'])
   raw=image.at(row['address'],row['bytes']);require(raw.hex()==row['hex']and sha(raw)==row['sha256'],'Inline native instruction span differs: '+label);spans.append({'kind':kind,'name':label,'address':row['address'],'bytes':len(raw),'sha256':sha(raw)})
  for row in pin['exactWords']:require(image.word(row['address'])==number(row['word']),'Native selected word differs')
  for row in pin['directBranches']:require(image.branch(row['address'],row.get('link',True))==number(row['target']),'Native branch target differs')
 for row in defaults['typeRegistrations']:
  image.pair(row);image.movz(row['sizeInstruction'],7,row['size']);require(image.branch(row['call'])==0x10169e674,'Native type registry call differs')
  for callback in row['callbacks']:require(image.adr(callback['instruction'],callback['register'])==number(callback['target']),'Native type callback differs')
 for row in defaults['fieldRegistrations']:
  image.pair(row);image.movz(row['offsetInstruction'],2,row['offset']);require(image.branch(row['call'])==number(row['wrapper']),'Native field wrapper differs')
 require(image.page_pointer(0x1018ac8a8,0x1018ac8ac,8)==image.page_pointer(0x10193aaf0,0x10193aaf4,8)==0x102481ef8,'Constructor/factory vptr differs')
 require(struct.unpack('<Q',image.at(0x10246e0c0,8))[0]==0x102230369 and image.at(0x102230369,1)==b'\0','Native empty-string default differs')
 return spans

def function_bounds(data,defaults,loader):
 cursor=32;linkedit=None
 for _ in range(struct.unpack_from('<I',data,16)[0]):
  command,length=struct.unpack_from('<II',data,cursor)
  if command==0x26:linkedit=struct.unpack_from('<II',data,cursor+8)
  cursor+=length
 info=defaults['functionStarts'];require(linkedit==(info['offset'],info['bytes']),'Native function-start command differs')
 require(linkedit[0]+linkedit[1]<=len(data),'Native function-start table exceeds slice');encoded=data[linkedit[0]:linkedit[0]+linkedit[1]]
 require(sha(encoded)==info['sha256'],'Native function-start bytes differ')
 starts=[];offset=value=shift=0
 for byte in encoded:
  value|=(byte&127)<<shift
  if byte&128:
   shift+=7;require(shift<64,'Invalid native function-start ULEB128');continue
  if value==0:break
  offset+=value;starts.append(number(defaults['textVmaddr'])+offset);value=shift=0
 require(len(starts)==info['count']and starts==sorted(set(starts)),'Native function-start inventory differs')
 bounds=[]
 for kind,pin in [('constructor',defaults),('loader',loader)]:
  for row in pin['llvmRecords']:
   begin,end=number(row['requestedStart']),number(row['nextFunctionStart']);index=bisect.bisect_left(starts,begin)
   require(starts[index:index+2]==[begin,end],'Declared native function bounds differ')
   bounds.append({'kind':kind,'start':row['requestedStart'],'next':row['nextFunctionStart']})
 return{**info,'declaredBounds':bounds,'historicalLlvmTextReverified':False}

def primary_archive_match():
 matching=restored.load();helper=runpy.run_path(str(restored.VERIFIER));manifests=[]
 import sys
 sys.path.insert(0,str(ROOT/'.tools/cdtb'))
 from cdtb.patcher import PatcherManifest
 from cdtb.tools import zstd_decompress
 for row in [matching['officialManifest'],matching['frozenAssetsManifest']]:
  raw=restored.checked(restored.target(row).read_bytes(),row);header=helper['rman_header'](raw);require(header==row['header'],'Primary cohort manifest header differs')
  body=zstd_decompress(raw[header['offset']:header['offset']+header['compressedBodyBytes']]);require(len(body)==header['decodedBodyBytes'],'Primary cohort manifest body differs')
  manifest=PatcherManifest();manifest.parse_body(io.BytesIO(body));require(len(manifest.files)==row['fileCount'],'Primary cohort manifest inventory differs');manifests.append(manifest)
 name='DATA/FINAL/Champions/MasterYi.wad.client';a,b=[m.files[name]for m in manifests]
 require(a.size==b.size and helper['sequence'](a)==helper['sequence'](b),'Native/frozen Master Yi archive differs')
 return{'archive':name,'bytes':a.size,'chunks':len(a.chunks),'orderedChunkIdsAndDecodedSizesIdentical':True,'sequenceSha256':helper['sequence_sha'](a),'nativeManifestSha256':matching['officialManifest']['sha256'],'assetsManifestSha256':matching['frozenAssetsManifest']['sha256']}

def primary_alignment():
 from masteryi_primary_hits import load,verify,cache_path,SOURCE_ROOT,PIN_SHA256
 pin,model,char=load();verify(pin,model,char);from cdtb import binfile
 raw_bins={};out=[];content=json.loads((ROOT/'src/content/masteryi-primary-hit-particles.json').read_bytes());by={(p['system'],p['index']):p for p in content['profiles']}
 expected={(system,index)for system,row in pin['resources'].items()for index,_ in enumerate(row['definition']['complexEmitterDefinitionData'])};require(len(by)==len(content['profiles'])==11 and set(by)==expected,'Compiled primary profile closure differs')
 for system,row in pin['resources'].items():
  path=row['sourceBin']
  if path not in raw_bins:
   native=next(r for r in pin['extraction']['files']if r['path']==path);raw_bins[path]=binfile.BinFile(io.BytesIO(cache_path(SOURCE_ROOT,native).read_bytes()))
  entry=next(e for e in raw_bins[path].entries if e.path.h==fnv(row['record']));field=entry['complexEmitterDefinitionData']
  require(int(field.type)==0x80 and int(field.value.vtype)==0x82,'Primary emitter list wire type differs')
  for index,emitter in enumerate(field.value.values):
   require(emitter.type.h==fnv('VfxEmitterDefinitionData'),'Primary emitter concrete type differs');fields={f.name.h:f for f in emitter.fields};p=by[(system,index)]
   omitted_primitive=fnv('primitive')not in fields;omitted_alpha=fnv('alphaRef')not in fields
   if omitted_primitive:require(p['kind']=='billboard','Primary omitted primitive differs from constructor alignment')
   if omitted_alpha:require(p['alphaRef']==5/255,'Primary omitted alpha reference differs from constructor-byte alignment')
   else:require(int(fields[fnv('alphaRef')].type)==3 and p['alphaRef']==fields[fnv('alphaRef')].value/255,'Primary explicit alpha reference differs')
   out.append({'system':system,'index':index,'emitter':p['name'],'listWireType':0x80,'elementWireType':0x82,'concreteTypeHash':f'{emitter.type.h:08x}','primitiveOmitted':omitted_primitive,'alphaRefOmitted':omitted_alpha,'compiledKind':p['kind'],'compiledAlphaRef':p['alphaRef']})
 require(len(out)==11 and sum(r['primitiveOmitted']for r in out)==9 and sum(r['alphaRefOmitted']for r in out)==7,'Primary constructor alignment closure differs')
 return{'sourcePinSha256':PIN_SHA256,'compiledContentSha256':sha((ROOT/'src/content/masteryi-primary-hit-particles.json').read_bytes()),'emitters':out}

def observe():
 matching=restored.load();defaults=json.loads(pinned(DEFAULTS,DEFAULTS_SHA256));loader=json.loads(pinned(LOADER,LOADER_SHA256));pinned(PARSER,PARSER_SHA256)
 row=next(r for r in matching['selectedFiles']if r['name']==matching['executableName']);binary=restored.checked(restored.target(row).read_bytes(),row);arch=next(a for a in matching['macho']['architectures']if a['architecture']=='arm64')
 require(defaults['matchingNativePin']['sha256']==restored.PIN_SHA256 and loader['constructorPin']['sha256']==DEFAULTS_SHA256,'Native witness cross-pin differs')
 require(defaults['target']['architecture']==arch and defaults['target']['sha256']==row['sha256'],'Constructor native cohort differs')
 data,sections=runpy.run_path(str(PARSER))['arm64_sections'](binary,arch);spans=verify_records(Image(data,sections),defaults,loader);bounds=function_bounds(data,defaults,loader)
 return{'format':1,'native':{'path':row['path'],'bytes':row['bytes'],'sha256':row['sha256'],'architecture':arch},'inputPins':[{'path':str(p.relative_to(ROOT)),'sha256':h}for p,h in [(DEFAULTS,DEFAULTS_SHA256),(LOADER,LOADER_SHA256),(PARSER,PARSER_SHA256)]],'sections':sections,'functionStarts':bounds,'verifiedInlineSpans':spans,'checks':{'inlineSpans':len(spans),'exactWords':len(defaults['exactWords'])+len(loader['exactWords']),'directBranches':len(defaults['directBranches'])+len(loader['directBranches']),'typeRegistrations':len(defaults['typeRegistrations']),'fieldRegistrations':len(defaults['fieldRegistrations']),'functionStarts':bounds['count'],'declaredFunctionBounds':len(bounds['declaredBounds'])},'constructorDefaults':{'primitive':{'candidate':'VfxPrimitiveCameraQuad','kindByte':0,'objectBytes':24,'definitionPointerOffset':96,'vptr':'0x102481ef8'},'texture':{'definitionOffset':152,'value':'','stringAddress':'0x102230369'},'alphaRef':{'definitionOffset':119,'byte':5}},'limits':['Fresh static byte witness for inline spans, selected words, direct branches and registrations only. No native game/shader execution or full historical LLVM/archive certificate.','Type and field labels are FNV/layout candidates; matching hashes do not exclude collisions or authenticate literal native names.','Constructor defaults and the identified generic loader chain do not establish actual Yi dispatch, later overrides, attachments, sampler state, shader selection or native visual parity.','Compiled alpha normalization by 255 remains a local reader/material policy; this witness establishes constructor byte 5 and alignment, not native upload conversion.']}
