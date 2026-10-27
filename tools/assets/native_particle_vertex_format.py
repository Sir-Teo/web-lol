"""Static particle vertex declaration and Metal format/Objective-C binding witness."""
from pathlib import Path
import bisect,io,json,re,runpy,struct,zipfile
import native_constructor_witness as witness
import native_emitter_scalar_defaults as defaults
import native_atlas_runtime as atlas
from masteryi_audio_graph import write_outputs
require=witness.require
OUTPUT=Path('docs/reference/native-particle-vertex-format.json')
APPLE_ARCHIVE=Path('.cache/native-particle-vertex-format/metal-cpp_macOS15_iOS18.zip')
APPLE_ARCHIVE_SHA256='0433df1e0ab13c2b0becbd78665071e3fa28381e9714a3fce28a497892b8a184'
APPLE_HEADER='metal-cpp/Metal/MTLVertexDescriptor.hpp'
APPLE_HEADER_SHA256='4c397dc5e1ff89c440756c87ad534df4a6234f9086f8bc549f3732bf0a73812e'
SPANS=[
 ('particleDeclarations',0x1018a405c,0x1018a454c,'746300e2f38b88f4bafcfdbbcb54ecde70e19753eddc674620e2575106d7e231'),
 ('metalLayoutConstructor',0x101a8edb8,0x101a8efd4,'bb903ee168564b6512d05e50e981c477d37bea41d125940dd716943d69e260be'),
 ('metalAttributeBinding',0x101a8f4d8,0x101a8f5c4,'b675b00eade2f96d56ef15f0644f1f56a793d3fedd2f6d4d9b6c0f49d3087971'),
 ('metalFormatUpdate',0x101a8f5c4,0x101a8ff24,'8ba8999f0fb57fb73d39329f2a223acddcfb7510253fb96019a829dae5a9ecdd'),
 ('metalLayoutFactory',0x101a86a94,0x101a86aec,'cfbc134a7c3017769ddbbd67781d85c6e0a728cdde137a8d9fe12a7215d54cb0')]
SELECTORS=[('attributes',0x1020030c0),('objectAtIndexedSubscript:',0x102003f80),('layouts',0x102003bc0),('setBufferIndex:',0x102004360),('setFormat:',0x102004620),('setOffset:',0x1020049e0),('setStride:',0x102004cc0)]
BINDING_OFFSET=38975488
BINDING_BYTES=11360
BINDING_SHA256='c242686286b75bdc7f1ae4858bd648ab6e2c63c895b3df8b5bd53d21b7ce65ba'

def page_load(image,pc,loadpc,base,destination):
 w,z=image.word(pc),image.word(loadpc)
 require(w&0x9f00001f==0x90000000|base and z&0xffc003ff==0xf9400000|(base<<5)|destination,'Expected ADRP/LDR pointer')
 imm=(((w>>5)&0x7ffff)<<2)|((w>>29)&3)
 if imm&(1<<20):imm-=1<<21
 return(pc&~4095)+imm*4096+((z>>10)&4095)*8

def binding_table(data):
 cursor=32;segments=[];libraries=[];info=None
 for _ in range(struct.unpack_from('<I',data,16)[0]):
  command,size=struct.unpack_from('<II',data,cursor);require(size>=8 and cursor+size<=len(data),'Invalid Metal load command')
  if command==0x19:
   name=data[cursor+8:cursor+24].split(b'\0')[0].decode();address,length=struct.unpack_from('<QQ',data,cursor+24);segments.append({'name':name,'address':address,'bytes':length})
  if command in(0xc,0x18,0x1f,0x80000018,0x8000001f):
   nameoff=struct.unpack_from('<I',data,cursor+8)[0];require(24<=nameoff<size,'Invalid Metal library name');end=data.find(b'\0',cursor+nameoff,cursor+size);require(end>=0,'Unterminated Metal library name');libraries.append(data[cursor+nameoff:end].decode())
  if command==0x80000022:require(info is None and size==48,'Duplicate or invalid binding command');info=struct.unpack_from('<10I',data,cursor+8)
  cursor+=size
 require(info is not None and info[2:4]==(BINDING_OFFSET,BINDING_BYTES),'Native binding command differs')
 raw=data[BINDING_OFFSET:BINDING_OFFSET+BINDING_BYTES];require(len(raw)==BINDING_BYTES and witness.sha(raw)==BINDING_SHA256,'Native binding table differs')
 return raw,segments,libraries

def decode_bindings(raw,segments,libraries):
 offset=0;segment=None;address=0;symbol=None;ordinal=0;kind=1;addend=0;flags=0;rows=[];mask=(1<<64)-1
 def integer(signed=False):
  nonlocal offset
  value=shift=0
  for _ in range(10):
   require(offset<len(raw),'Truncated binding integer');byte=raw[offset];offset+=1;value|=(byte&127)<<shift;shift+=7
   if not byte&128:
    if signed and byte&64:value-=1<<shift
    require(-(1<<63)<=value<(1<<63)if signed else 0<=value<=mask,'Binding integer exceeds 64 bits');return value
  raise ValueError('Oversized binding integer')
 def bind():
  require(segment is not None and segment<len(segments)and symbol is not None and kind==1 and address+8<=segments[segment]['bytes'],'Invalid native binding state')
  require(0<ordinal<=len(libraries),'Unsupported native binding library ordinal')
  rows.append({'address':hex(segments[segment]['address']+address),'segment':segments[segment]['name'],'symbol':symbol,'library':libraries[ordinal-1],'ordinal':ordinal,'type':kind,'flags':flags,'addend':addend})
 while offset<len(raw):
  byte=raw[offset];offset+=1;opcode=byte&240;imm=byte&15
  if opcode==0:require(not any(raw[offset:]),'Nonzero bytes after native binding end');return rows
  if opcode==0x10:ordinal=imm
  elif opcode==0x20:ordinal=integer()
  elif opcode==0x30:ordinal=imm if imm==0 else imm-16
  elif opcode==0x40:
   end=raw.find(b'\0',offset);require(end>=offset,'Unterminated native binding symbol');symbol=raw[offset:end].decode('ascii');offset=end+1;flags=imm
  elif opcode==0x50:kind=imm
  elif opcode==0x60:addend=integer(True)
  elif opcode==0x70:segment=imm;require(segment<len(segments),'Native binding segment exceeds inventory');address=integer()
  elif opcode==0x80:address=(address+integer())&mask
  elif opcode==0x90:bind();address=(address+8)&mask
  elif opcode==0xa0:bind();address=(address+8+integer())&mask
  elif opcode==0xb0:bind();address=(address+8*(imm+1))&mask
  elif opcode==0xc0:
   count,skip=integer(),integer();require(count<=len(raw)*8,'Native binding repeat exceeds bound')
   for _ in range(count):bind();address=(address+8+skip)&mask
  else:raise ValueError('Unsupported native binding opcode '+hex(opcode))
 raise ValueError('Missing native binding end')

def selectors(image):
 section=next(s for s in image.sections if s['name']=='__objc_stubs');rows=[]
 for name,pc in SELECTORS:
  require(section['address']<=pc and pc+32<=section['address']+section['bytes']and(pc-section['address'])%32==0,'Invalid Objective-C stub range')
  reference=page_load(image,pc,pc+4,1,1);literal=struct.unpack('<Q',image.at(reference,8))[0]
  require(image.at(literal,len(name)+1)==name.encode()+b'\0','Objective-C selector differs')
  target=page_load(image,pc+8,pc+12,16,16);require(target==0x102358210 and image.word(pc+16)==0xd61f0200,'Objective-C message target differs')
  raw=image.at(pc,32);rows.append({'name':name,'stub':hex(pc),'reference':hex(reference),'literal':hex(literal),'messagePointer':hex(target),'bytes':32,'sha256':witness.sha(raw),'hex':raw.hex()})
 return rows

def api_enums(path=APPLE_ARCHIVE):
 raw=witness.pinned(path,APPLE_ARCHIVE_SHA256)
 require(len(raw)==195223,'Official Metal archive length differs')
 with zipfile.ZipFile(io.BytesIO(raw))as archive:
  require(archive.namelist().count(APPLE_HEADER)==1,'Official Metal header inventory differs');header=archive.read(APPLE_HEADER)
 require(len(header)==12017 and witness.sha(header)==APPLE_HEADER_SHA256,'Official Metal header differs')
 expected={'VertexFormatUChar4Normalized':9,'VertexFormatHalf2':25,'VertexFormatHalf4':27,'VertexFormatFloat3':30,'VertexFormatUChar4Normalized_BGRA':42}
 for name,value in expected.items():
  matches=re.findall(r'\b'+name+r'\s*=\s*(\d+)\s*,',header.decode());require(matches==[str(value)],'Official Metal enum differs: '+name)
 return {'url':'https://developer.apple.com/metal/cpp/files/metal-cpp_macOS15_iOS18.zip','archive':{'path':str(APPLE_ARCHIVE),'bytes':len(raw),'sha256':APPLE_ARCHIVE_SHA256},'header':{'archivePath':APPLE_HEADER,'bytes':len(header),'sha256':APPLE_HEADER_SHA256},'enums':expected,'scope':'Public Metal ABI enum mapping, not evidence that the native client was built with this SDK.'}

WORDS=[
 (0x1018a408c,0xf9407508,'Device virtual layout factory slot +0xe8'),
 (0x1018a40a0,0xd63f0100,'Call device layout factory'),
 (0x1018a43b8,0x0f004460,'Position descriptor word 0x00030000'),
 (0x1018a43c0,0x52800028,'Descriptor auxiliary word 1'),
 (0x101a8ede8,0xbd001000,'Initialize descriptor slots'),
 (0x101a8ee28,0xb8008c08,'Advance descriptor destination to this+8'),
 (0x101a8ee78,0x3c888e80,'Advance resource cursor to this+0x88'),
 (0x101a8ee90,0xb9010695,'Store supplied attribute count at this+0x18c'),
 (0x101a8ee98,0xd37d7ea3,'Descriptor copy bytes = count * 8'),
 (0x101a8eed8,0x385ff12b,'Read copied internal type byte'),
 (0x101a8eedc,0x7100057f,'Compare internal type with 1'),
 (0x101a8eee4,0x3900012a,'Force that type to four components'),
 (0x10168829c,0xaa0203e1,'Descriptor copy wrapper moves source to X1'),
 (0x1016882a0,0xaa0303e2,'Descriptor copy wrapper moves size to X2'),
 (0x101a8f67c,0x38408eb4,'Read attribute index from copied descriptor'),
 (0x101a8f680,0x394006a8,'Read internal type byte'),
 (0x101a8f698,0x52800136,'Initial selected Metal format = 9'),
 (0x101a8f6a8,0x91006d16,'Float format = component count + 27'),
 (0x101a8f6c8,0x7100111f,'Half path compares component count with 4'),
 (0x101a8f6cc,0x52800369,'Half4 selected format = 27'),
 (0x101a8f6d0,0x9a9f0129,'Half4 selection else invalid format'),
 (0x101a8f6d4,0x7100091f,'Half path compares component count with 2'),
 (0x101a8f6d8,0x52800328,'Half2 selected format = 25'),
 (0x101a8f6dc,0x9a890116,'Select Half2 or prior Half4 result'),
 (0x101a8f718,0xaa1403e2,'Metal attribute index argument'),
 (0x101a8f720,0xaa1603e2,'Metal format argument'),
 (0x101a8f740,0xaa1603e2,'Metal byte-offset argument'),
 (0x101a8f5a8,0x39062288,'Binding a stream marks descriptor dirty')]


def constant_pointer(image,pc,loadpc):
 w,z=image.word(pc),image.word(loadpc)
 require(w&0x9f00001f==0x90000009 and z&0xffc003ff==0xfd400120,'Expected descriptor ADRP/LDR D0')
 imm=(((w>>5)&0x7ffff)<<2)|((w>>29)&3)
 if imm&(1<<20):imm-=1<<21
 return(pc&~4095)+imm*4096+((z>>10)&4095)*8


def store_descriptor(image,pc,offset,second=False):
 word=image.word(pc);opcode=(0xb9000000|(21<<5)|8)if second else(0xbd000000|(21<<5))
 require(word&0xffc003ff==opcode and((word>>10)&4095)*4==offset,'Descriptor initializer store differs')


def verify(image,core):
 starts=atlas.function_starts(image.data,core['functionStarts']);spans=[]
 for name,start,end,digest in [*SPANS,('descriptorCopyWrapper',0x10168829c,0x1016882a8,'cc3fa510aebeb4254d9c17891dfb0536700b2e0fea0fd8f4282ebe12012acc10')]:
  slot=bisect.bisect_left(starts,start);require(starts[slot:slot+2]==[start,end],'Vertex-format function bounds differ: '+name)
  raw=image.at(start,end-start);require(witness.sha(raw)==digest,'Vertex-format function bytes differ: '+name)
  spans.append({'name':name,'start':hex(start),'next':hex(end),'bytes':len(raw),'sha256':digest,'hex':raw.hex()})
 words=[]
 for pc,word,reading in WORDS:
  require(image.word(pc)==word,'Vertex-format selected instruction differs: '+reading);words.append({'address':hex(pc),'word':f'{word:08x}','reading':reading})
 require(image.page_pointer(0x1018a4074,0x1018a4078,8)==image.page_pointer(0x1018a43a4,0x1018a43a8,21)==0x1025e84e8,'Particle declaration guard pointer differs')
 require(image.page_pointer(0x1018a4090,0x1018a4094,21)==0x1025e84f0 and image.word(0x1018a4098)==0x910a32a1,'Particle declaration argument pointer differs')
 image.movz(0x1018a409c,2,4)
 descriptor_words=[0x00030000];constant_rows=[]
 for pc,load,expected in [(0x1018a43c8,0x1018a43cc,0x102132c38),(0x1018a43d8,0x1018a43dc,0x102133270),(0x1018a43e8,0x1018a43ec,0x102132c48)]:
  address=constant_pointer(image,pc,load);require(address==expected,'Particle descriptor constant pointer differs');raw=image.at(address,8);descriptor_words.append(struct.unpack('<I',raw[:4])[0]);constant_rows.append({'address':hex(address),'bytes':8,'hex':raw.hex(),'sha256':witness.sha(raw)})
 require(descriptor_words==[0x00030000,0x00010103,0x00040408,0x00020409],'Particle descriptor constants differ')
 for i,(pc,second)in enumerate([(0x1018a43bc,0x1018a43c4),(0x1018a43d0,0x1018a43d4),(0x1018a43e0,0x1018a43e4),(0x1018a43f0,0x1018a43f4)]):
  store_descriptor(image,pc,0x294+i*8);store_descriptor(image,second,0x298+i*8,True)
 require(image.page_pointer(0x101a8edd4,0x101a8edd8,8)==0x102497ca8,'Metal layout vptr differs')
 require(struct.unpack('<Q',image.at(0x102497ca8,8))[0]==0x101a8f4d8 and struct.unpack('<Q',image.at(0x102497650,8))[0]==0x101a86a94,'Metal virtual layout methods differ')
 for pc in [0x101a85e18,0x101a86050]:require(image.page_pointer(pc,pc+4,8)==0x102497568 and image.word(pc+8)==0xf9000008,'Metal device vptr setup differs')
 require(image.branch(0x101a86ac0)==0x101a8edb8 and image.branch(0x101a8eeb0)==0x10168829c and image.branch(0x1016882a4,False)==0x102000774,'Metal declaration copy/factory branch differs')
 require(page_load(image,0x101a8ef08,0x101a8ef0c,8,0)==0x1024fbdd0 and image.branch(0x101a8ef10)==0x102000888,'Metal descriptor allocation differs')
 imports=atlas.imports(image.data,[(0x102000888,'_objc_opt_new'),(0x1020008a0,'_objc_release'),(0x102000774,'_memcpy')])
 raw,segments,libraries=binding_table(image.data);bindings=decode_bindings(raw,segments,libraries);require(len(bindings)==2297,'Native binding inventory differs');selected=[]
 for address,name,library,flags in [('0x1024fbdd0','_OBJC_CLASS_$_MTLVertexDescriptor','/System/Library/Frameworks/Metal.framework/Versions/A/Metal',1),('0x102358210','_objc_msgSend','/usr/lib/libobjc.A.dylib',0)]:
  rows=[r for r in bindings if r['address']==address];require(len(rows)==1 and rows[0]['symbol']==name and rows[0]['library']==library and rows[0]['flags']==flags and rows[0]['addend']==0,'Metal Objective-C binding differs');selected.extend(rows)
 selector_rows=selectors(image)
 for pc,target in [(0x101a8f714,0x1020030c0),(0x101a8f71c,0x102003f80),(0x101a8f724,0x102004620),(0x101a8f744,0x1020049e0),(0x101a8f778,0x102004360)]:require(image.branch(pc)==target,'Metal descriptor selector call differs')
 table=image.at(0x1021346f0,7);require(table==bytes.fromhex('001c061c081115'),'Metal format switch table differs')
 layout=[]
 for word,pc,attribute,offset in zip(descriptor_words,[0x1018a40b0,0x1018a40d0,0x1018a40f0,0x1018a4110],[0,3,8,9],[0,12,16,24]):
  semantic,kind,components,pad=struct.pack('<I',word);require(semantic==attribute and pad==0,'Particle descriptor fields differ')
  image.movz(pc,1,attribute);image.movz(pc+8,3,offset);image.movz(pc+12,4,28);require(image.word(pc+4)==0xaa1303e2 and image.word(pc+16)==0xd63f0100,'Particle vertex stream binding differs')
  adjusted=4 if kind==1 else components;target=0x101a8f6a0+4*table[kind]
  if target==0x101a8f6a0:metal=adjusted+27
  elif target==0x101a8f710:metal=9
  elif target==0x101a8f6c0:metal=25 if adjusted==2 else 27 if adjusted==4 else 0
  else:raise ValueError('Unsupported first-layout internal type')
  layout.append({'attribute':attribute,'initializerAddress':hex(0x1025e877c+8*len(layout)),'initializerHex':struct.pack('<II',word,1).hex(),'internalType':kind,'initialComponents':components,'metalComponents':adjusted,'byteOffset':offset,'stride':28,'metalFormat':metal,'formatBranch':hex(target)})
 require([r['metalFormat']for r in layout]==[30,9,27,25],'Particle Metal formats differ')
 return {'functionSpans':spans,'selectedInstructions':words,'descriptorConstants':constant_rows,'firstParticleLayout':layout,'switchTable':{'address':'0x1021346f0','hex':table.hex()},'objectiveCSelectors':selector_rows,'nativeImports':imports,'dynamicBindings':{'offset':BINDING_OFFSET,'bytes':BINDING_BYTES,'sha256':BINDING_SHA256,'count':len(bindings),'selected':selected},'virtualSlots':[{'address':'0x102497650','deviceVptr':'0x102497568','slotOffset':0xe8,'method':'0x101a86a94'},{'address':'0x102497ca8','layoutVptr':'0x102497ca8','slotOffset':0,'method':'0x101a8f4d8'}]}


def observe():
 core=json.loads(witness.pinned(defaults.CORE,defaults.CORE_SHA256));witness.pinned(witness.PARSER,witness.PARSER_SHA256);raw=witness.restored.checked(Path(core['native']['path']).read_bytes(),core['native']);data,sections=runpy.run_path(str(witness.PARSER))['arm64_sections'](raw,core['native']['architecture'])
 pins=[(Path('docs/reference/native-atlas-runtime.json'),'1755709dceba19f907e1f754ba84ecab00206905751d6b9e894cf7e84a7c46d6'),(Path('docs/reference/native-ray-packet.json'),'ab9b825f1108ed1e44124ee5f9821753eb73352cbf8738a8eebbb884c892b4ec')]
 for path,digest in pins:witness.pinned(path,digest)
 native=verify(witness.Image(data,sections),core);api=api_enums()
 return {'format':1,'native':core['native'],'inputs':[{'path':str(defaults.CORE),'sha256':defaults.CORE_SHA256},*[{'path':str(p),'sha256':s}for p,s in pins]],**native,'metalApi':api,'reading':{'position':'Attribute 0: Float3 at byte 0','color':'Attribute 3: UChar4Normalized at byte 12. Internal color type 1 starts with component count 1; the Metal constructor changes it to 4. Format 9 normalizes byte lanes; it is distinct from BGRA-swizzling format 42.','uv0':'Attribute 8: Half4 at byte 16','uv1':'Attribute 9: Half2 at byte 24','stride':28,'declaration':'The first of four declarations assembled by 0x1018a405c. BSS descriptor bytes are reconstructed from verified initialization instructions and constant-pool loads; BSS memory was not read as initialized native data.','shader':'The separately pinned default quad shader swizzles ATTR3 from BGRA and floors ATTR8.z. CPU packet/declaration/shader observations compose conditionally when this layout and shader are selected.'},'nativeExecuted':False,'nativeShaderExecuted':False,'historicalLlvmTextReplaced':False,'limits':['Static native declaration/factory/constructor/binding/format trace; no native execution, actual Yi dispatch, live GPU state or final visual parity.','The first 28-byte declaration matches the recovered CPU quad/ray packet. Draw-specific selection of this declaration and of the separately inspected default shader remains unobserved.','The official Apple header supplies public Metal ABI enum names/values. This does not identify the SDK or compiler used to build the native client.','Normalized vertex bytes do not establish native color-space, blend, texture-sampler or output-target state.','No game behavior or asset changes in this witness. Ray color/UV producers, authored size mapping and clocks remain separate work.','Original missing historical LLVM archives are neither replaced nor certified.']}

if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args();result=observe();write_outputs([(OUTPUT,(json.dumps(result,indent=2,allow_nan=False)+'\n').encode())],args.check);print(json.dumps({'nativeFunctions':len(result['functionSpans']),'selectedInstructions':len(result['selectedInstructions']),'attributes':[(r['attribute'],r['metalFormat'])for r in result['firstParticleLayout']],'dynamicBindings':result['dynamicBindings']['count'],'nativeExecuted':False}))
