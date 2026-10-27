"""CameraQuad constructor/dispatch and distinct truncating byte packet; static only."""
from pathlib import Path
import bisect,json,runpy,struct
import native_constructor_witness as witness
import native_ray_packet as ray
from native_atlas_runtime import function_starts
from masteryi_audio_graph import write_outputs
OUTPUT=Path('docs/reference/native-cameraquad-packets.json')
RAY_SHA256='ab9b825f1108ed1e44124ee5f9821753eb73352cbf8738a8eebbb884c892b4ec'
FORMAT_PIN=Path('docs/reference/native-particle-vertex-format.json')
FORMAT_SHA256='2c45b6fb42a5eea59daa453e96af9f5d49a2afa38a1a84dafaf3be2b8919e1f6'
require=witness.require
SPANS=[('cameraQuadRegistration', 4321017352, 4321017652, '50a51fed4523dac186ee4999aad36d68776403804387a4f4a3357ed58fed0e66'), ('cameraQuadAllocatingConstructor', 4321422044, 4321422092, '316e234a24ce0ca73b79ff0b3ebb72bd3e858c79dc9376e6429dcf8c26f21bad'), ('cameraQuadInPlaceConstructor', 4321422112, 4321422140, '55ca9d3f89d28c770ad272fa46cb0271465069edc965c244eedec42b54cb8cf7'), ('cameraQuadVertexBuilder', 4321017652, 4321019780, '149990c9d303295ffed9dfea94c1b8377cb40f0c8bfc7747607ca904bfa7d55d'), ('emitterDefinitionConstructor', 4320839724, 4320840788, '2dcad45a377031f968f1853db3115140f15b014a00aa7ff3ea035bbf219b1684'), ('optimizedQuad', 4321123268, 4321124916, '830f0e5789e38eccc9a77b376804d36a6c56b426b19ef4cdc7d4b1dbb1bf0f4c'), ('optimizedBillboardPacket', 4321120708, 4321122520, 'a56f4baf062d82ef2704bd43ceac71b81cad673eb1b6ee0416bbcd77d6622b91'), ('optimizedLocalPacket', 4321122520, 4321123268, 'e2caec71e9404dd432d7a25cbefcca94c990880ad8fd01c8d86fb48d81ca70b2')]
WORDS=[(4321017388, 271672706, 'adr x2, #0x10193aadc'), (4321017404, 271673124, 'adr x4, #0x10193ab20'), (4321017428, 1385664129, 'mov w1, #0xbc74'), (4321017432, 1924324257, 'movk w1, #0x96dd, lsl #16'), (4321017436, 1384121095, 'mov w7, #0x18'), (4321017440, 2549553669, 'bl #0x10169e674'), (4321422060, 956309535, 'strb wzr, [x0, #8]'), (4321422064, 4026554920, 'adrp x8, #0x102481000'), (4321422068, 2436620552, 'add x8, x8, #0xef8'), (4321422072, 4177526792, 'str x8, [x0]'), (4321422112, 956309535, 'strb wzr, [x0, #8]'), (4321422116, 4026554920, 'adrp x8, #0x102481000'), (4321422120, 2436620552, 'add x8, x8, #0xef8'), (4321422124, 4177526792, 'str x8, [x0]'), (4320839836, 1384121088, 'mov w0, #0x18'), (4320839844, 956309535, 'strb wzr, [x0, #8]'), (4320839848, 2952814248, 'adrp x8, #0x102481000'), (4320839852, 2436620552, 'add x8, x8, #0xef8'), (4320839856, 4177526792, 'str x8, [x0]'), (4320839876, 4162814752, 'stur x0, [x25, #-8]'), (4321017748, 1833828673, 'ldp d1, d0, [x10, #0xe0]'), (4321017904, 960516360, 'ldrb w8, [x8, #0x14]'), (4321017912, 840892680, 'orr w8, w8, #2'), (4321017940, 2432812000, 'add x0, sp, #0x70'), (4321017944, 3506611105, 'sub x1, x29, #0xa8'), (4321017948, 2549522085, 'bl #0x10167faf0'), (4321017952, 3108008936, 'ldr w8, [sp, #0x70]'), (4321017956, 3103788680, 'str w8, [x20, #0xc]'), (4321017960, 3103795848, 'str w8, [x20, #0x28]'), (4321017964, 3103803016, 'str w8, [x20, #0x44]'), (4321017968, 3103810184, 'str w8, [x20, #0x60]'), (4321018648, 4232069440, 'ldur d0, [x10, #4]'), (4321018652, 1833142242, 'ldp d2, d1, [sp, #0x38]'), (4321018656, 773905440, 'fmul v0.2s, v1.2s, v0.2s'), (4321018660, 4232102209, 'ldur d1, [x10, #0xc]'), (4321018664, 773971009, 'fmul v1.2s, v2.2s, v1.2s'), (4321018668, 1832224672, 'stp d0, d1, [x29, #-0xa8]'), (4321018676, 1895827807, 'cmp w10, #2'), (4321018680, 1409286369, 'b.ne #0x1018d8354'), (4321018684, 262246400, 'fmul v0.2s, v0.2s, v1.s[1]'), (4321018692, 262246432, 'fmul v0.2s, v1.2s, v1.s[1]'), (4321018700, 1386737674, 'mov w10, #0x3f800000'), (4321018704, 3088466858, 'stur w10, [x29, #-0x9c]'), (4321018192, 237070402, 'fcvtn v2.4h, v2.4s'), (4321018196, 4244638338, 'str d2, [x20, #0x10]'), (4321018200, 505659938, 'fcvt h2, s17'), (4321018204, 2097164930, 'str h2, [x20, #0x18]'), (4321018208, 505660002, 'fcvt h2, s19'), (4321018212, 2097165954, 'str h2, [x20, #0x1a]'), (4321018252, 237070435, 'fcvtn v3.4h, v3.4s'), (4321018308, 237070435, 'fcvtn v3.4h, v3.4s'), (4321018364, 237070336, 'fcvtn v0.4h, v0.4s'), (4321019468, 759338276, 'ldp s4, s5, [x9, #0x14]'), (4321019472, 505612429, 'fmul s13, s4, s3'), (4321019476, 505743459, 'fmul s3, s3, s5'), (4321019484, 1914503455, 'tst w8, #8'), (4321019488, 506268783, 'fcsel s15, s3, s13, eq'), (4321123428, 4181723881, 'ldr x9, [x23, #0x10]'), (4321123432, 4181733673, 'ldr x9, [x9, #0x60]'), (4321123436, 960504105, 'ldrb w9, [x9, #8]'), (4321123440, 1895826751, 'cmp w9, #1'), (4321123444, 1426062856, 'b.hi #0x1018f1c34'), (4321124164, 3108163852, 'ldr w12, [x8, #0x2d0]'), (4321124248, 3103803372, 'str w12, [sp, #0x44]'), (4321124264, 2432795620, 'add x4, sp, #0x60'), (4321124284, 2550136391, 'bl #0x1018f18d8'), (4321124788, 4181726184, 'ldr x8, [sp, #0x20]'), (4321124792, 4181723400, 'ldr x8, [x8, #0x10]'), (4321124796, 1036007683, 'ldr q3, [x8, #0xe0]'), (4321124800, 1031805923, 'str q3, [sp, #0x60]'), (4321124804, 3107997672, 'ldr w8, [sp, #0x44]'), (4321124808, 923791048, 'tbnz w8, #1, #0x1018f1fa0'), (4321124820, 2432795620, 'add x4, sp, #0x60'), (4321124840, 2550135799, 'bl #0x1018f11c4'), (4321120708, 3175088260, 'ldr s4, [x4]'), (4321120716, 505618560, 'fcmp s4, s3'), (4321120724, 505421960, 'fcmp s4, #0.0'), (4321120744, 520427652, 'fmadd s4, s4, s5, s6'), (4321120748, 507052168, 'fcvtzu w8, s4'), (4321120808, 520295555, 'fmadd s3, s4, s3, s5'), (4321120896, 520427652, 'fmadd s4, s4, s5, s6'), (4321120976, 520295555, 'fmadd s3, s4, s3, s5'), (4321121032, 3103788200, 'str w8, [x5, #0xc]'), (4321122588, 2432725984, 'add x0, sp, #0x1c'), (4321122592, 2852389857, 'mov x1, x4'), (4321122596, 2549495923, 'bl #0x10167faf0'), (4321122604, 3103788648, 'str w8, [x19, #0xc]'), (4321122608, 3103795816, 'str w8, [x19, #0x28]'), (4321122612, 3103802984, 'str w8, [x19, #0x44]'), (4321122616, 3103810152, 'str w8, [x19, #0x60]')]

def verify(image,core):
 witness.pinned(ray.OUTPUT,RAY_SHA256);ray.verify(image,core)
 starts=function_starts(image.data,core['functionStarts']);spans=[]
 for name,start,end,digest in SPANS:
  slot=bisect.bisect_left(starts,start);require(starts[slot:slot+2]==[start,end],'CameraQuad function bounds differ: '+name)
  raw=image.at(start,end-start);require(witness.sha(raw)==digest,'CameraQuad function bytes differ: '+name)
  spans.append({'name':name,'start':hex(start),'next':hex(end),'bytes':len(raw),'sha256':digest,'hex':raw.hex()})
 words=[]
 for pc,word,reading in WORDS:
  require(image.word(pc)==word,'CameraQuad instruction differs: '+reading);words.append({'address':hex(pc),'word':f'{word:08x}','reading':reading})
 image.pair({'name':'VfxPrimitiveCameraQuad','hash':0x96ddbc74,'hashPair':[0x1018d7e54,0x1018d7e58]});image.movz(0x1018d7e5c,7,24)
 require(image.branch(0x1018d7e60)==0x10169e674,'CameraQuad registry target differs')
 require(image.adr(0x1018d7e2c,2)==0x10193aadc and image.adr(0x1018d7e3c,4)==0x10193ab20,'CameraQuad constructor callbacks differ')
 for pc in [0x10193aaf0,0x10193ab24,0x1018ac8a8]:require(image.page_pointer(pc,pc+4,8)==0x102481ef8,'CameraQuad constructor vptr differs')
 slot=0x102481ef8+40;target=struct.unpack('<Q',image.at(slot,8))[0];require(target==0x1018d7f34,'CameraQuad virtual method differs')
 require(image.branch(0x1018d805c)==0x10167faf0,'CameraQuad color helper differs')
 require(image.branch(0x1018f1fbc)==0x1018f18d8 and image.branch(0x1018f21e8)==0x1018f11c4 and image.branch(0x1018f1924)==0x10167faf0,'Optimized packet branch differs')
 require(bit_branch(image,0x1018f21c8)==(8,1,0x1018f1fa0),'Optimized orientation selection differs')
 require(conditional_branch(image,0x1018f1c74)==(8,0x1018f1c34),'Optimized primitive filter differs')
 return {'functionSpans':spans,'selectedInstructions':words,'primitive':{'candidate':'VfxPrimitiveCameraQuad','hash':'96ddbc74','kind':0,'objectBytes':24,'vptr':'0x102481ef8','virtualSlotOffset':40,'virtualSlotAddress':hex(slot),'virtualMethod':hex(target),'slotBytes':image.at(slot,8).hex()}}

def bit_branch(image,pc):
 word=image.word(pc);require(word&0x7f000000==0x37000000,'Expected TBNZ')
 immediate=(word>>5)&0x3fff
 if immediate&0x2000:immediate-=0x4000
 return word&31,((word>>19)&31)+((word>>31)<<5),pc+immediate*4

def conditional_branch(image,pc):
 word=image.word(pc);require(word&0xff000010==0x54000000,'Expected conditional branch')
 immediate=(word>>5)&0x7ffff
 if immediate&0x40000:immediate-=0x80000
 return word&15,pc+immediate*4

def observe():
 core=json.loads(witness.pinned(ray.defaults.CORE,ray.defaults.CORE_SHA256));raw=witness.restored.checked(Path(core['native']['path']).read_bytes(),core['native']);witness.pinned(witness.PARSER,witness.PARSER_SHA256)
 data,sections=runpy.run_path(str(witness.PARSER))['arm64_sections'](raw,core['native']['architecture']);layout=json.loads(witness.pinned(FORMAT_PIN,FORMAT_SHA256))
 return {'format':1,'native':core['native'],'constructorWitness':{'path':str(ray.defaults.CORE),'sha256':ray.defaults.CORE_SHA256},'rayWitness':{'path':str(ray.OUTPUT),'sha256':RAY_SHA256},'vertexFormatWitness':{'path':str(FORMAT_PIN),'sha256':FORMAT_SHA256},'firstLayoutFormats':[r['metalFormat']for r in layout['firstParticleLayout']],**verify(witness.Image(data,sections),core),
 'reading':{'legacyColor':'The CameraQuad virtual builder multiplies definition modulationFactor at +0xe0 with draw-record RGBA at +4. If (blendMode | 2) == 2 it premultiplies RGB and sets A=1, then calls the previously pinned truncating helper 10167faf0. Four vertices receive the same BGRA word at +12 in 28-byte packets.',
 'optimizedPackets':'The optimized quad routine accepts primitive kinds 0/1 and skips higher kinds, including Ray 2. Definition flags mask 0x2 (bit 1) select local packet 1018f18d8 calling the truncating helper; a clear bit selects billboard packet 1018f11c4 using explicit unit clamps and float32 FMA(value,255,0.5) before conversion. Both receive X4=SP+0x60, copied from the parent +0x10/+0xe0 RGBA block. Its source-curve/texture relationship remains unresolved.',
 'distinctPacker':'The called helper multiplies each float32 component by 255, converts with FCVTZU and retains low bytes. It has no +0.5 addition or explicit unit clamp. Unit .5 produces 127, unlike the ray path 128. Finite out-of-unit cases and conversion saturation remain distinct from rounded/clamped rays.',
 'uv':'Per-corner UV0 float4 converts to half4 and lookup coordinates to half2, matching the first 28-byte declaration conditionally on its draw selection.',
 'uniformScale':'The builder reads draw X/Y size lanes at+20/+24 and applies a shared factor. TST definition flags mask 0x8 (bit 3) at 0x1018d865c chooses S15=Y when absent and S15=X when present. This is a camera-quad height selector, not proof that all primitives copy all scale components.',
 'scope':'Links both CameraQuad constructors and the emitter-default constructor to the virtual builder. The inherited primitive slot dispatch is not actual live Yi dispatch or proof of optimized-path selection.'},
 'nativeExecuted':False,'nativeShaderExecuted':False,'applicationBehaviorChanged':False,'limits':['Bounded native bytes and selected-word checks, not native execution or visual parity.','Field/type names are FNV/layout candidates. Native FPCR, live clocks, actual renderer dispatch and shader selection remain unobserved.','The first Metal 28-byte declaration supplies normalized unsigned-byte color, half4 UV0 and half2 UV1; actual draw-specific declaration/shader selection remains conditional.','Legacy/local packet truncation and optimized billboard rounded/clamped conversion differ within the quad family. Do not apply either policy globally; optimized source-color-curve and shader binding remain unresolved.','No game behavior or historical LLVM/source archives are changed by this witness.']}
if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args();result=observe();write_outputs([(OUTPUT,(json.dumps(result,indent=2,allow_nan=False)+'\n').encode())],args.check);print(json.dumps({'functions':len(result['functionSpans']),'instructions':len(result['selectedInstructions']),'primitive':result['primitive'],'nativeExecuted':False}))
