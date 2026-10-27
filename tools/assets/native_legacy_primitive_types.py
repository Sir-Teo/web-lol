"""Bounded legacy p-type conversion to the current Ray class; no target execution."""
from pathlib import Path
import bisect,json,runpy,struct
import native_constructor_witness as witness
import native_ray_packet as ray
from native_atlas_runtime import function_starts
from masteryi_audio_graph import write_outputs
require=witness.require
OUTPUT=Path('docs/reference/native-legacy-primitive-types.json')
GROMP=Path('docs/reference/gromp-effects.json')
GROMP_SHA256='3cb54cd774fbfd66cc52846bb8775d17ab0adb473a570600e274e5f2ae0a1033'
RAY_SHA256='ab9b825f1108ed1e44124ee5f9821753eb73352cbf8738a8eebbb884c892b4ec'
FORMAT=Path('docs/reference/native-particle-vertex-format.json')
FORMAT_SHA256='2c45b6fb42a5eea59daa453e96af9f5d49a2afa38a1a84dafaf3be2b8919e1f6'
SPANS=[('legacyPrimitiveFactory',0x10189bad8,0x10189be6c,'884e17435457cbef7ffd10a09d55b450f61a2e4b18ab4bc423c632fb921482e8'),('legacyEmitterLoader',0x1018a15ec,0x1018a3ae8,'b104094c229197171277658232c81c3290b8b88543ae001cb8481d97ae801426')]
WORDS=[(4320794188, 3489681059, 'adrp x3, #0x102277000'), (4320794192, 2436302947, 'add x3, x3, #0xdc2'), (4320794196, 2433508321, 'add x1, sp, #0x318'), (4320794204, 1384120324, 'mov w4, #0'), (4320794208, 2549495895, 'bl #0x10162f7bc'), (4320794212, 961307616, 'ldrb w0, [sp, #0x318]'), (4320794216, 2433508328, 'add x8, sp, #0x318'), (4320794220, 2550130971, 'bl #0x10189bad8'), (4320794244, 4181823464, 'ldr x8, [sp, #0x318]'), (4320794248, 4177539720, 'str x8, [x20, #0x60]'), (4320770788, 2852127721, 'mov x9, x0'), (4320770792, 2852652019, 'mov x19, x8'), (4320770800, 1895838015, 'cmp w9, #0xc'), (4320770804, 1409286824, 'b.hi #0x10189bb48'), (4320770812, 2415936713, 'adrp x9, #0x102133000'), (4320770816, 2433789225, 'add x9, x9, #0x42b'), (4320770820, 268435594, 'adr x10, #0x10189bb14'), (4320770824, 946366763, 'ldrb w11, [x9, x8]'), (4320770828, 2332756298, 'add x10, x10, x11, lsl #2'), (4320770832, 3592356160, 'br x10'), (4320770904, 1384121088, 'mov w0, #0x18'), (4320770908, 2549603933, 'bl #0x1016934d0'), (4320770912, 1384120392, 'mov w8, #2'), (4320770916, 956309512, 'strb w8, [x0, #8]'), (4320770920, 4026556200, 'adrp x8, #0x102482000'), (4320770924, 2433261832, 'add x8, x8, #0x228'), (4320770928, 335544504, 'b #0x10189be50'), (4320771664, 4177526792, 'str x8, [x0]'), (4320771668, 2433057032, 'add x8, x8, #0x160'), (4320771672, 4177528840, 'str x8, [x0, #0x10]'), (4320771676, 4177527392, 'str x0, [x19]'), (4320801836, 2432868993, 'add x1, x20, #0xa8'), (4320801844, 2952810147, 'adrp x3, #0x102278000'), (4320801848, 2432863331, 'add x3, x3, #0xa3'), (4320801852, 2952810148, 'adrp x4, #0x102278000'), (4320801856, 2432870532, 'add x4, x4, #0xaa'), (4320801864, 2549494693, 'bl #0x1016302dc'), (4320801868, 2432885377, 'add x1, x20, #0xb8'), (4320801876, 2952810147, 'adrp x3, #0x102278000'), (4320801880, 2432915555, 'add x3, x3, #0xd6'), (4320801884, 2952810148, 'adrp x4, #0x102278000'), (4320801888, 2432934020, 'add x4, x4, #0xe8'), (4320801896, 2549494685, 'bl #0x1016302dc')]
TABLE_HEX='000611183245587e8f960daec9'

def verify(image,core):
 witness.pinned(ray.OUTPUT,RAY_SHA256);ray.verify(image,core)
 starts=function_starts(image.data,core['functionStarts']);spans=[]
 for name,start,end,digest in SPANS:
  slot=bisect.bisect_left(starts,start);require(starts[slot:slot+2]==[start,end],'Legacy function bounds differ: '+name)
  raw=image.at(start,end-start);require(witness.sha(raw)==digest,'Legacy function bytes differ: '+name);spans.append({'name':name,'start':hex(start),'next':hex(end),'bytes':len(raw),'sha256':digest,'hex':raw.hex()})
 selected=[]
 for pc,word,reading in WORDS:
  require(image.word(pc)==word,'Legacy selected word differs: '+reading);selected.append({'address':hex(pc),'word':f'{word:08x}','reading':reading})
 table=image.at(0x10213342b,13);require(table.hex()==TABLE_HEX,'Legacy primitive switch bytes differ')
 entries=[{'pType':i,'entry':v,'target':hex(0x10189bb14+v*4)}for i,v in enumerate(table)];require(entries[2]['target']=='0x10189bb58','Legacy type2 branch differs')
 require(image.page_pointer(0x10189bafc,0x10189bb00,9)==0x10213342b,'Legacy switch pointer differs')
 require(image.adr(0x10189bb04,10)==0x10189bb14,'Legacy switch base differs')
 require(image.branch(0x1018a166c)==0x10189bad8 and image.branch(0x10189bb5c)==0x1016934d0 and image.branch(0x10189bb70,False)==0x10189be50,'Legacy factory targets differ')
 require(image.page_pointer(0x10189bb68,0x10189bb6c,8)==0x102482228,'Legacy type2 Ray vptr differs')
 require(struct.unpack('<Q',image.at(0x102482250,8))[0]==0x1018d9178,'Legacy Ray virtual builder differs')
 literals=[]
 for address,value in [(0x102277dc2,'p-type'),(0x1022780a3,'p-rgba'),(0x1022780aa,'DATA/Particles/DefaultColorOverLifetime.dds'),(0x1022780e8,'DATA/Particles/DefaultFalloff.dds')]:
  require(image.at(address,len(value)+1)==value.encode()+b'\0','Legacy literal differs');literals.append({'address':hex(address),'value':value})
 for pc,target in [(0x1018a3434,0x1022780a3),(0x1018a343c,0x1022780aa),(0x1018a345c,0x1022780e8)]:require(image.page_pointer(pc,pc+4,3 if pc==0x1018a3434 else 4)==target,'Legacy texture argument pointer differs')
 return {'functionSpans':spans,'selectedInstructions':selected,'switch':{'address':'0x10213342b','base':'0x10189bb14','hex':table.hex(),'entries':entries},'literals':literals,'ray':{'legacyPType':2,'kind':2,'objectBytes':24,'vptr':'0x102482228','virtualSlotOffset':40,'virtualSlotAddress':'0x102482250','vertexBuilder':'0x1018d9178'}}

def source_rows(pin,compiled):
 require(compiled['sourcePinSha256']==GROMP_SHA256,'Gromp compiled source binding differs');rows=[]
 for i,p in enumerate(compiled['profiles']):
  if p['kind']!='ray':continue
  definition=pin['records'][p['sourceRecord']]['decoded']['values'][p['sourceSection']]
  require(definition['p-type']==2,'Gromp legacy Ray p-type differs')
  rows.append({'profileIndex':i,'name':p['name'],'sourceRecord':p['sourceRecord'],'sourceSection':p['sourceSection'],'sourceIndex':p['sourceIndex'],'pType':definition['p-type']})
 require([r['profileIndex']for r in rows]==[5,7],'Gromp Ray scope differs');return rows

def observe():
 core=json.loads(witness.pinned(ray.defaults.CORE,ray.defaults.CORE_SHA256));raw=witness.restored.checked(Path(core['native']['path']).read_bytes(),core['native']);witness.pinned(witness.PARSER,witness.PARSER_SHA256)
 data,sections=runpy.run_path(str(witness.PARSER))['arm64_sections'](raw,core['native']['architecture']);layout=json.loads(witness.pinned(FORMAT,FORMAT_SHA256));pin=json.loads(witness.pinned(GROMP,GROMP_SHA256));compiled=json.loads(Path('src/content/gromp-death.json').read_bytes())
 return {'format':1,'native':core['native'],'inputs':[{'path':str(GROMP),'sha256':GROMP_SHA256},{'path':str(ray.OUTPUT),'sha256':RAY_SHA256},{'path':str(FORMAT),'sha256':FORMAT_SHA256}],**verify(witness.Image(data,sections),core),'firstLayoutFormats':[r['metalFormat']for r in layout['firstParticleLayout']],'grompRays':source_rows(pin,compiled),'reading':{'loader':'The loader supplies literal p-type to reader10162f7bc with default0, loads its returned low byte into W0, calls primitive factory10189bad8 with X8=SP318, and stores the returned pointer at definition+60.','factory':'The checked13-byte table maps p-type2 to10189bb58, allocating24B and storing kind2 at+8, vptr102482228 and the common +10 initializer. Its vtable slot+40 points to the previously pinned Ray builder1018d9178.','textureArguments':'The loader also supplies literal p-rgba and DATA/Particles/DefaultColorOverLifetime.dds as key/fallback arguments for destination definition+A8, plus DATA/Particles/DefaultFalloff.dds for destination+B8. Fallback resource contents and actual material selection remain unresolved.','source':'The retained SDBM-labeled Troy source pin supplies p-type2 for Gromp pop and popshards. This incremental check uses that decoded source pin; it does not reconstruct missing original Troy archives.'},'nativeExecuted':False,'nativeShaderExecuted':False,'applicationBehaviorChanged':False,'limits':['Static factory/caller/table/vtable linkage, not native execution or proof of actual live Gromp loader/shader selection.','Native legacy defaults, fallback texture contents, sampler state, prepared-color producers and exact UV dispatch require further evidence before a complete native composition claim.','The existing local Gromp curves, color policy and byte streams are unchanged by this witness.','Historical LLVM/source archives are not replaced or certified by fresh bounded byte checks.']}
if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');parser.add_argument('--output',type=Path,default=OUTPUT);args=parser.parse_args();result=observe();write_outputs([(args.output,(json.dumps(result,indent=2,allow_nan=False)+'\n').encode())],args.check);print(json.dumps({'functions':len(result['functionSpans']),'instructions':len(result['selectedInstructions']),'legacyRay':result['ray'],'nativeExecuted':False}))
