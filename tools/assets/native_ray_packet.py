"""Frozen native ray constructor/dispatch/packet witness; no target execution."""
from pathlib import Path
import bisect,json,runpy,struct
import native_constructor_witness as witness
import native_emitter_scalar_defaults as defaults
from native_atlas_runtime import function_starts
from masteryi_audio_graph import write_outputs
OUTPUT=Path('docs/reference/native-ray-packet.json')
require=witness.require
SPANS=[
 ('rayTypeRegistration',0x1018d904c,0x1018d9178,'e4e321ff50bed3493b2a8bc8bb2e8627be587b10e61abf462a5c2dd9efcf3f70'),
 ('rayAllocatingConstructor',0x10193ac90,0x10193acc4,'e6f35d5719c0453c733dac1809832c2025033b0d348f14ac3acc309ce9822cda'),
 ('rayInPlaceConstructor',0x10193acd8,0x10193acf8,'7c0075fa786829c58cd2f78911d30bbfb98ecd2a2d5c485a0206ebae93a9e1d1'),
 ('rayVertexBuilder',0x1018d9178,0x1018d9908,'544ab015a34e00347ea83290bc152713585cdba5d081a5e725a4c7fdd550d0c1'),
 ('primitiveVirtualDispatch',0x1018decbc,0x1018def30,'1f9413be802ab97b14fbc46ea8009d8fa0f8d3d83614e180613bf1ca77ee3a0e'),
 ('fastColorPacker',0x10167faf0,0x10167fb50,'b5fcbb8d9642f1a100574a9f8d8e8b7c92221731cda08afa387cda18662dfb16'),
 ('float4RegistrationWrapper',0x10034f3fc,0x10034f438,'2bd4f87894a99db64cd1d2f48ca3d792e3d75c273171a2433ead7e2f0de77a4b')]
WORDS=[
 (0x10193aca4,0x39002008,'Allocating constructor STRB kind at +8'),
 (0x10193acdc,0x39002008,'In-place constructor STRB kind at +8'),
 (0x1018deef0,0xf9400aa8,'Dispatch loads emitter definition at +0x10'),
 (0x1018deef4,0xf9403100,'Dispatch loads definition primitive at +0x60'),
 (0x1018deef8,0xf9400008,'Dispatch loads primitive vptr'),
 (0x1018deefc,0xf9401508,'Dispatch loads virtual slot +0x28'),
 (0x1018def00,0x910003e1,'Dispatch passes stack render context as X1'),
 (0x1018def04,0xd63f0100,'Dispatch BLR X8'),
 (0x1018d91c4,0xfd407100,'Load definition modulation RG at +0xe0'),
 (0x1018d922c,0x39405108,'Load definition blendMode byte at +0x14'),
 (0x1018d9234,0x52800309,'24-byte optional per-particle UV record stride'),
 (0x1018d9240,0x52800589,'44-byte per-particle draw record stride'),
 (0x1018d924c,0x52801589,'172-byte particle transform record stride'),
 (0x1018d9254,0x321f0108,'ORR definition mode byte, 2'),
 (0x1018d95b8,0x710009bf,'CMP combined mode, 2'),
 (0x1018d95c0,0x0f939252,'Conditional multiply RG by alpha'),
 (0x1018d95c4,0x1e330929,'Conditional multiply B by alpha'),
 (0x1018d95c8,0x1e2e1013,'Conditional alpha set to 1'),
 (0x1018d93dc,0x0e216800,'Vertex 0 UV0 float4 to half4'),
 (0x1018d93e0,0xfd000a80,'Vertex 0 half4 at +16'),
 (0x1018d93e4,0x1e23c060,'Vertex 0 lookup U float32 to half'),
 (0x1018d93e8,0x7d003280,'Vertex 0 lookup U at +24'),
 (0x1018d93ec,0x1e23c0a0,'Vertex 0 lookup V float32 to half'),
 (0x1018d93f0,0x7d003680,'Vertex 0 lookup V at +26'),
 (0x1018d9410,0x0e216800,'Vertex 1 UV0 float4 to half4'),
 (0x1018d9448,0x0e216800,'Vertex 2 UV0 float4 to half4'),
 (0x1018d9480,0x0e216800,'Vertex 3 UV0 float4 to half4'),
 (0x1018d9498,0x9101c288,'Advance vertex cursor by four 28-byte vertices'),
 (0x1018d94a8,0x11000929,'Increment triangle count by 2'),
 (0x1018d94b8,0x11001129,'Increment vertex count by 4'),
 (0x1018d97a0,0x1f074247,'Ray R: float32 FMA(value,255,0.5) before truncation'),
 (0x1018d97a4,0x1e3900e8,'Ray R: unsigned integer conversion'),
 (0x1018d97e0,0x1f1048e7,'Ray G: float32 FMA(value,255,0.5)'),
 (0x1018d9828,0x1f074127,'Ray B: float32 FMA(value,255,0.5)'),
 (0x1018d9890,0x1f020e62,'Ray A: float32 FMA(value,255,0.5)'),
 (0x10167fb00,0x1e210842,'Fast packer: alpha times 255'),
 (0x10167fb04,0x1e390048,'Fast packer: truncate alpha without +0.5'),
 (0x10167fb10,0x2ea1b800,'Fast packer: truncate RG without +0.5'),
 (0x1018ac934,0x4f03f600,'Emitter constructor modulation vector = ones'),
 (0x1018ac938,0xad068261,'Store Q1,Q0 at definition +0xd0; Q0 at +0xe0')]
FIELDS=[('blendMode',0x1018ab5e4,0x14,0x1018ac350),('modulationFactor',0x1018ab76c,0xe0,0x10034f3fc)]

def verify(image,core):
 starts=function_starts(image.data,core['functionStarts']);spans=[]
 for name,start,end,digest in SPANS:
  slot=bisect.bisect_left(starts,start);require(starts[slot:slot+2]==[start,end],'Ray native function bounds differ: '+name)
  raw=image.at(start,end-start);require(witness.sha(raw)==digest,'Ray native function bytes differ: '+name)
  spans.append({'name':name,'start':hex(start),'next':hex(end),'bytes':len(raw),'sha256':digest,'hex':raw.hex()})
 words=[]
 for pc,expected,reading in WORDS:
  require(image.word(pc)==expected,'Ray selected instruction differs: '+reading);words.append({'address':hex(pc),'word':f'{expected:08x}','reading':reading})
 witness.pinned(defaults.OUTPUT,'a6c381afaed4c5a680276794d8fa613d988d710eca0683ed8ee91cde494de6cf');defaults.verify(image)
 image.pair({'name':'VfxPrimitiveRay','hash':0xa14bd4d0,'hashPair':[0x1018d9098,0x1018d909c]});image.movz(0x1018d90a0,7,24)
 require(image.branch(0x1018d90a4)==0x10169e674,'Ray type registry call differs')
 require(image.adr(0x1018d9070,2)==0x10193ac90 and image.adr(0x1018d9080,4)==0x10193acd8,'Ray constructor callback differs')
 for address in [0x10193aca0,0x10193acd8]:image.movz(address,8,2)
 for pc in [0x10193aca8,0x10193ace0]:require(image.page_pointer(pc,pc+4,8)==0x102482228,'Ray constructor vptr differs')
 require(image.word(0x10193acb0)==image.word(0x10193ace8)==0xf9000008,'Ray constructor vptr store differs')
 slot=0x102482228+0x28;method=struct.unpack('<Q',image.at(slot,8))[0];require(method==0x1018d9178,'Ray vertex virtual slot differs')
 registrations=[]
 for name,pc,offset,wrapper in FIELDS:
  image.pair({'name':name,'hash':witness.fnv(name),'hashPair':[pc,pc+4]});image.movz(pc+8,2,offset);require(image.branch(pc+20)==wrapper,'Ray field wrapper differs')
  registrations.append({'candidate':name,'hash':f'{witness.fnv(name):08x}','address':hex(pc),'definitionOffset':offset,'wrapper':hex(wrapper)})
 image.movz(0x10034f414,3,13);require(image.branch(0x10034f428)==0x10169ebe8,'Modulation float4 registry differs')
 return {'functionSpans':spans,'selectedInstructions':words,'rayType':{'candidate':'VfxPrimitiveRay','hash':'a14bd4d0','objectBytes':24,'kindOffset':8,'kind':2,'vptr':'0x102482228','virtualSlotOffset':0x28,'virtualSlotAddress':hex(slot),'virtualMethod':hex(method),'slotBytes':image.at(slot,8).hex()},'fieldRegistrations':registrations,'modulationConstructorDefault':[1,1,1,1]}

def observe():
 core=json.loads(witness.pinned(defaults.CORE,defaults.CORE_SHA256));raw=witness.restored.checked(Path(core['native']['path']).read_bytes(),core['native']);witness.pinned(witness.PARSER,witness.PARSER_SHA256)
 data,sections=runpy.run_path(str(witness.PARSER))['arm64_sections'](raw,core['native']['architecture'])
 return {'format':1,'native':core['native'],'constructorWitness':{'path':str(defaults.CORE),'sha256':defaults.CORE_SHA256},**verify(witness.Image(data,sections),core),'reading':{'packet':'Four indexed vertices, two triangles; stride 28: position float3 +0, packed BGRA +12, UV0 half4 +16, UV1 half2 +24','uv0':'Per-vertex affine UV plus two supplied per-particle frame components; all four float lanes convert to half. The frame components are read from the 44-byte draw record, not recomputed here.','uv1':'Per-vertex affine coordinates when optional UV data is selected. One branch instead reads the draw-record float2 at +32 and zeros all affine coefficients, giving one half-rounded coordinate pair on all four vertices. Origins and mode producers are not established here.','color':'Definition modulationFactor at +0xe0 multiplies draw-record RGBA. If (blendMode | 2) == 2, multiply RGB by A and set A=1. For finite components, clamp at 0/1; inside that range convert float32 fma(component,255,0.5) to uint32. Pack BGRA bytes.','fastColorPacker':'Separate fast quad helper multiplies by 255 and truncates; it has no +0.5 operation. Do not apply either color packer globally.','sizes':'The builder consumes three scaled components of the 44-byte draw record and two positions from a 172-byte transform record. Their producer-side mapping to authored size/orientation is not attested.'},'nativeExecuted':False,'nativeShaderExecuted':False,'historicalLlvmTextReplaced':False,'limits':['Exact bounded static native bytes, not native execution, actual Yi dispatch, live shader selection or visual parity.','Type and field names are FNV/layout candidates; hashes neither exclude collisions nor authenticate native literal names.','Ray registration, both constructors, the virtual slot and a definition-primitive dispatch site identify this builder. The native producers of its context, transforms, clocks, color, UV modes, frames and 44-byte draw records remain unresolved.','Float32 arithmetic and half conversion retain the native floating-point environment. Nearest-even half examples would be conditional on FPCR; no live FPCR is measured.','Ray colors and the separate fast quad packer have different rounding/clamping paths. No application color or ray behavior is changed by this witness.','Missing historical LLVM archives remain missing; the inline bytes and static exploration are additional evidence only.']}

if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args();result=observe();write_outputs([(OUTPUT,(json.dumps(result,indent=2,allow_nan=False)+'\n').encode())],args.check);print(json.dumps({'nativeFunctions':len(result['functionSpans']),'selectedInstructions':len(result['selectedInstructions']),'rayKind':result['rayType']['kind'],'modulationDefault':result['modulationConstructorDefault'],'nativeExecuted':False}))
