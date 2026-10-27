"""Bounded native per-axis ray birth-scale preparation; static evidence only."""
from pathlib import Path
import bisect,json,runpy
import native_constructor_witness as witness
import native_ray_draw_data as draw
from native_atlas_runtime import function_starts
from masteryi_audio_graph import write_outputs
OUTPUT=Path('docs/reference/native-ray-birth-scale.json')
DRAW_SHA256='62af9657abc0ab9697f8098a91aaf3462033b099223e0390453556b4cf226da4'
SOURCE=Path('docs/reference/masteryi/primary-hit-particles.json')
SOURCE_SHA256='30e017180fd0778afec27ba6f2ea03f83317040e4ec51992e51472a211417301'
require=witness.require
SPANS=[('birthPreparation',0x1018f6cac,0x1018f8d84,'d68f5987cfc42959377808830848affabd2b996841f86e8509f2ef6ea4343752')]
WORDS=[
 (0x1018f6fd0,0x910fa101,'add x1, x8, #0x3e8'),
 (0x1018f6fd4,0xf941fd00,'ldr x0, [x8, #0x3f8]'),
 (0x1018f6fd8,0xb4000160,'cbz x0, #0x1018f7004'),
 (0x1018f6fdc,0xf9011bff,'str xzr, [sp, #0x230]'),
 (0x1018f6fe0,0xb9023bff,'str wzr, [sp, #0x238]'),
 (0x1018f6fe4,0xf9400008,'ldr x8, [x0]'),
 (0x1018f6fe8,0xf9402908,'ldr x8, [x8, #0x50]'),
 (0x1018f6fec,0x9108c3e2,'add x2, sp, #0x230'),
 (0x1018f6ff0,0x1e2041e0,'fmov s0, s15'),
 (0x1018f6ff4,0xd63f0100,'blr x8'),
 (0x1018f6ff8,0xf9400668,'ldr x8, [x19, #8]'),
 (0x1018f6ffc,0xf9400908,'ldr x8, [x8, #0x10]'),
 (0x1018f7000,0x14000005,'b #0x1018f7014'),
 (0x1018f7004,0xf9400029,'ldr x9, [x1]'),
 (0x1018f7008,0xf9011be9,'str x9, [sp, #0x230]'),
 (0x1018f700c,0xb9400829,'ldr w9, [x1, #8]'),
 (0x1018f7010,0xb9023be9,'str w9, [sp, #0x238]'),
 (0x1018f7014,0xfd411be0,'ldr d0, [sp, #0x230]'),
 (0x1018f7018,0xfd006fe0,'str d0, [sp, #0xd8]'),
 (0x1018f701c,0xbd423be0,'ldr s0, [sp, #0x238]'),
 (0x1018f7020,0xbd00d7e0,'str s0, [sp, #0xd4]'),
 (0x1018f7af4,0xf9400668,'ldr x8, [x19, #8]'),
 (0x1018f7af8,0xf9400908,'ldr x8, [x8, #0x10]'),
 (0x1018f7afc,0xfd406fe0,'ldr d0, [sp, #0xd8]'),
 (0x1018f7b00,0xfd018be0,'str d0, [sp, #0x310]'),
 (0x1018f7b04,0xbd40d7e0,'ldr s0, [sp, #0xd4]'),
 (0x1018f7b08,0xbd031be0,'str s0, [sp, #0x318]'),
 (0x1018f7b0c,0xf941fd00,'ldr x0, [x8, #0x3f8]'),
 (0x1018f7b10,0xb4000160,'cbz x0, #0x1018f7b3c'),
 (0x1018f7b14,0xf9011bff,'str xzr, [sp, #0x230]'),
 (0x1018f7b18,0xb9023bff,'str wzr, [sp, #0x238]'),
 (0x1018f7b1c,0xf9400008,'ldr x8, [x0]'),
 (0x1018f7b20,0xf9403108,'ldr x8, [x8, #0x60]'),
 (0x1018f7b24,0x910c43e1,'add x1, sp, #0x310'),
 (0x1018f7b28,0x9108c3e2,'add x2, sp, #0x230'),
 (0x1018f7b2c,0xd63f0100,'blr x8'),
 (0x1018f7b30,0xf9400668,'ldr x8, [x19, #8]'),
 (0x1018f7b34,0xf9400908,'ldr x8, [x8, #0x10]'),
 (0x1018f7b38,0x14000005,'b #0x1018f7b4c'),
 (0x1018f7b3c,0xf9418be9,'ldr x9, [sp, #0x310]'),
 (0x1018f7b40,0xf9011be9,'str x9, [sp, #0x230]'),
 (0x1018f7b44,0xb9431be9,'ldr w9, [sp, #0x318]'),
 (0x1018f7b48,0xb9023be9,'str w9, [sp, #0x238]'),
 (0x1018f7b4c,0xbd4233eb,'ldr s11, [sp, #0x230]'),
 (0x1018f7b50,0xbd4237ec,'ldr s12, [sp, #0x234]'),
 (0x1018f7b54,0xbd423bea,'ldr s10, [sp, #0x238]'),
 (0x1018f8470,0xbd4103e2,'ldr s2, [sp, #0x100]'),
 (0x1018f8474,0x2d4b0ff1,'ldp s17, s3, [sp, #0x58]'),
 (0x1018f8478,0x3dc06fe4,'ldr q4, [sp, #0x1b0]'),
 (0x1018f847c,0x1f030882,'fmadd s2, s4, s3, s2'),
 (0x1018f8480,0xbd430fe3,'ldr s3, [sp, #0x30c]'),
 (0x1018f8484,0x1e2b0a24,'fmul s4, s17, s11'),
 (0x1018f8488,0xbd40b665,'ldr s5, [x19, #0xb4]'),
 (0x1018f848c,0x1e2c0a26,'fmul s6, s17, s12'),
 (0x1018f8490,0x7941b268,'ldrh w8, [x19, #0xd8]'),
 (0x1018f8494,0x1e2809e7,'fmul s7, s15, s8'),
 (0x1018f8498,0xf940ebe9,'ldr x9, [sp, #0x1d0]'),
 (0x1018f849c,0x3dc00130,'ldr q16, [x9]'),
 (0x1018f84a0,0x1e2a0a31,'fmul s17, s17, s10'),
 (0x1018f84a4,0xf9402be9,'ldr x9, [sp, #0x50]'),
 (0x1018f84a8,0x3d800130,'str q16, [x9]'),
 (0x1018f84ac,0xf940e7e9,'ldr x9, [sp, #0x1c8]'),
 (0x1018f84b0,0x3dc00130,'ldr q16, [x9]'),
 (0x1018f84b4,0xf94027e9,'ldr x9, [sp, #0x48]'),
 (0x1018f84b8,0x3d800130,'str q16, [x9]'),
 (0x1018f84bc,0xf940e3e9,'ldr x9, [sp, #0x1c0]'),
 (0x1018f84c0,0x3dc00130,'ldr q16, [x9]'),
 (0x1018f84c4,0xa943a7ea,'ldp x10, x9, [sp, #0x38]'),
 (0x1018f84c8,0x3d800130,'str q16, [x9]'),
 (0x1018f84cc,0x3dc04ed0,'ldr q16, [x22, #0x130]'),
 (0x1018f84d0,0x3d808ff0,'str q16, [sp, #0x230]'),
 (0x1018f84d4,0x3dc06bf0,'ldr q16, [sp, #0x1a0]'),
 (0x1018f84d8,0x3d809ff0,'str q16, [sp, #0x270]'),
 (0x1018f84dc,0xf941a3e9,'ldr x9, [sp, #0x340]'),
 (0x1018f84e0,0xf9000149,'str x9, [x10]'),
 (0x1018f84e4,0xb9434be9,'ldr w9, [sp, #0x348]'),
 (0x1018f84e8,0xb9000949,'str w9, [x10, #8]'),
 (0x1018f84ec,0xfd40cbf0,'ldr d16, [sp, #0x190]'),
 (0x1018f84f0,0xfc05c2d0,'stur d16, [x22, #0x5c]'),
 (0x1018f84f4,0xbd419ff0,'ldr s16, [sp, #0x19c]'),
 (0x1018f84f8,0xbd0297f0,'str s16, [sp, #0x294]'),
 (0x1018f84fc,0xbd029be4,'str s4, [sp, #0x298]'),
 (0x1018f8500,0xbd029fe6,'str s6, [sp, #0x29c]'),
 (0x1018f8504,0xbd02a3f1,'str s17, [sp, #0x2a0]'),
 (0x1018f8980,0x9107e3e3,'add x3, sp, #0x1f8'),
 (0x1018f8984,0xf9405260,'ldr x0, [x19, #0xa0]'),
 (0x1018f8988,0x9108c3e1,'add x1, sp, #0x230'),
 (0x1018f898c,0xaa1c03e2,'mov x2, x28'),
 (0x1018f8990,0x9400029d,'bl #0x1018f9404'),
]

def verify(image,core):
 witness.pinned(draw.OUTPUT,DRAW_SHA256);draw.verify(image,core)
 starts=function_starts(image.data,core['functionStarts']);spans=[]
 for name,start,end,digest in SPANS:
  slot=bisect.bisect_left(starts,start);require(starts[slot:slot+2]==[start,end],'Birth-scale function bounds differ')
  raw=image.at(start,end-start);require(witness.sha(raw)==digest,'Birth-scale function bytes differ')
  spans.append({'name':name,'start':hex(start),'next':hex(end),'bytes':len(raw),'sha256':digest,'hex':raw.hex()})
 words=[]
 for pc,word,reading in WORDS:
  require(image.word(pc)==word,'Birth-scale instruction differs: '+reading);words.append({'address':hex(pc),'word':f'{word:08x}','reading':reading})
 require(image.branch(0x1018f8990)==0x1018f9404,'Birth record initializer call differs')
 return {'functionSpans':spans,'selectedInstructions':words}

def verify_profile(source):
 profile=source['resources']['MasterYi_Crit_tar']['definition']['complexEmitterDefinitionData'][1]
 require(profile.get('primitive')=={'__type':'VfxPrimitiveRay'}and profile.get('emitterName')=='flash','Primary ray identity differs')
 require(profile.get('isUniformScale')==1,'Primary ray uniform flag differs')
 require(profile.get('birthScale0')=={'constantValue':[80.0,180.0,0.0],'__type':'ValueVector3'},'Primary ray birth vector differs')
 scale=profile['scale0']['dynamics'];require(scale['times']==[0.0,0.20000000298023224,1.0]and scale['values']==[[1.0,1.0,1.0],[1.0,1.0,0.0],[2.5,3.0,0.0]],'Primary ray anisotropic scale differs')
 return {'system':'MasterYi_Crit_tar','emitterIndex':1,'emitterName':'flash','primitive':'VfxPrimitiveRay','isUniformScale':True,'birthScale':[80,180,0],'scaleTimes':scale['times'],'scaleValues':scale['values']}

def observe():
 core=json.loads(witness.pinned(draw.ray.defaults.CORE,draw.ray.defaults.CORE_SHA256));raw=witness.restored.checked(Path(core['native']['path']).read_bytes(),core['native']);witness.pinned(witness.PARSER,witness.PARSER_SHA256)
 data,sections=runpy.run_path(str(witness.PARSER))['arm64_sections'](raw,core['native']['architecture']);profile=verify_profile(json.loads(witness.pinned(SOURCE,SOURCE_SHA256)))
 return {'format':1,'native':core['native'],'drawDataWitness':{'path':str(draw.OUTPUT),'sha256':DRAW_SHA256},'sourcePin':{'path':str(SOURCE),'sha256':SOURCE_SHA256},**verify(witness.Image(data,sections),core),'sourceRay':profile,
 'reading':{'birth':'Definition birthScale0 at+0x3e8 supplies a constant or evaluated three-lane value. The prepared value is saved at SP+0xd8 and SP+0xd4, then copied for optional probability sampling into three independent lanes S11,S12,S10.',
 'optionalModifier':'An optional external vector modifier may transform the birth vector before its final writes. Its producer, identity and defaults remain unobserved. It is not an inline copy of X into Y/Z.',
 'input':'One shared factor from SP+0x58 multiplies S11,S12,S10 separately. X/Y/Z are written at SP+0x298/+0x29c/+0x2a0. The initializer receives X1=SP+0x230, placing those fields at input+104/+108/+112.',
 'chain':'The inherited draw-data witness traces those input fields to birth-record+16/+20/+24 and prepared draw+20/+24/+28. Ray consumption assigns X width,Y length,Z near displacement.',
 'uniform':'The serialized primary ray explicitly sets isUniformScale, retains birthScale0[80,180,0] and has distinct X/Y scale curves. The tracked birth/prepared/ray component operations retain all three lanes. A local post-product size.fill(size[0]) does not follow this component path.',
 'scope':'Supports preserving separate source components for this primary ray under the existing local unit-factor/no-external-modifier policy. It does not define isUniformScale for other primitives or replace the local curve/clock/transform policy.'},
 'nativeExecuted':False,'nativeShaderExecuted':False,'limits':['Bounded static native bytes and frozen source data, not native execution, actual Yi dispatch or visual parity.','Optional external vector modifiers and shared factors remain unresolved; the existing local adapter assumes their identity/unit behavior.','Native curve interpolation, RNG, clock production, transform inheritance and FPCR are not established by this component trace.','Do not generalize this ray size path to camera quads, meshes, trails or other families.','Original historical source and LLVM archives remain unchanged.']}
if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args();result=observe();write_outputs([(OUTPUT,(json.dumps(result,indent=2,allow_nan=False)+'\n').encode())],args.check);print(json.dumps({'nativeFunctions':len(result['functionSpans']),'selectedInstructions':len(result['selectedInstructions']),'sourceRay':result['sourceRay'],'nativeExecuted':False}))
