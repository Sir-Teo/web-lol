"""Frozen prepared particle scale writes and ray component consumers; static only."""
from pathlib import Path
import bisect,json,runpy
import native_constructor_witness as witness
import native_ray_packet as ray
from native_atlas_runtime import function_starts
from masteryi_audio_graph import write_outputs
OUTPUT=Path('docs/reference/native-ray-draw-data.json')
RAY_SHA256='ab9b825f1108ed1e44124ee5f9821753eb73352cbf8738a8eebbb884c892b4ec'
require=witness.require
SPANS=[
 ('birthRecordInitializer',0x1018f9404,0x1018fa0e8,'cc2d8ad788ff8f6cfa03df984084723ebf444633506e1372d14133319eae06ad'),
 ('preparedDrawRecordWriter',0x1018fbd24,0x1018fc7b4,'9003dcd8e3206693289e787ced091a08fc374af6a2b777295261169699341e8a'),
 ('preparedScaleGetter',0x1018f4d74,0x1018f4d94,'6dbe4d77ef9e48658179dc419003ec16fb9eb25fd6097379d2bf5c1e52249f5a'),
 ('scaleRegistrationWrapper',0x10188963c,0x10188967c,'83dbb1ae73c5fcedae9f6772cbe11b162111fee5ef70d28f319975587a461383')]
FIELDS=[('birthScale0',0x1018abbcc,0x3e8),('scale0',0x1018abbe8,0x420)]
WORDS=[
 (0x1018fbf6c,0x5280051c,'Draw cursor starts at byte40'),
 (0x1018fbf94,0x9100b39c,'Draw cursor advances44 bytes'),
 (0x1018fbf98,0x91009273,'Birth cursor advances36 bytes'),
 (0x1018fc058,0xf9404e97,'Component draw array at+0x98'),
 (0x1018fc05c,0xf9402695,'Component birth array at+0x48'),
 (0x1018fc220,0x91108101,'Definition scale0 candidate at+0x420'),
 (0x1018fc224,0xf9421900,'Optional scale evaluator at+0x430'),
 (0x1018fc240,0x1e204100,'Evaluator phase passed from clamped particle age'),
 (0x1018fc248,0xd63f0100,'Evaluate scale vector'),
 (0x1018fc260,0xf9400028,'Constant scale XY'),
 (0x1018fc268,0xb9400828,'Constant scale Z'),
 (0x1018fc304,0x8b1302a8,'Birth record cursor'),
 (0x1018fc308,0xbd401901,'Birth Z from+24'),
 (0x1018fc30c,0x1e210841,'Scale Z times birth Z'),
 (0x1018fc314,0x1e210861,'Scale Z times emitter factor'),
 (0x1018fc318,0xfd400902,'Birth XY from+16'),
 (0x1018fc31c,0x2e22dc00,'Scale XY times birth XY'),
 (0x1018fc320,0x0f839000,'Scale XY times emitter factor'),
 (0x1018fc324,0xfc1ec300,'Store prepared XY at draw+20'),
 (0x1018fc32c,0xbc1f4321,'Store prepared Z at draw+28'),
 (0x1018fc380,0xfc5ec301,'Reload prepared XY for optional external scaling'),
 (0x1018fc384,0x0f809021,'Optional external uniform scale XY'),
 (0x1018fc388,0xfc1ec301,'Write external-scaled XY'),
 (0x1018fc38c,0xbc5f4321,'Reload prepared Z'),
 (0x1018fc390,0x1e210800,'Optional external uniform scale Z'),
 (0x1018fc394,0xbc1f4320,'Write external-scaled Z'),
 (0x1018f9d38,0xbd406a80,'Birth initializer input X at+104'),
 (0x1018f9d3c,0xbd001100,'Birth initializer record X at+16'),
 (0x1018f9d40,0xbd406e80,'Birth initializer input Y at+108'),
 (0x1018f9d44,0xbd001500,'Birth initializer record Y at+20'),
 (0x1018f9d48,0xbd407280,'Birth initializer input Z at+112'),
 (0x1018f9d4c,0xbd001900,'Birth initializer record Z at+24'),
 (0x1018d9248,0xd1005139,'Ray reverse cursor is count44 minus20; last record+24'),
 (0x1018d9770,0x2d7f8d02,'Ray loads draw+20 and+24 to S2/S3'),
 (0x1018d9774,0xbd400504,'Ray loads draw+28 to S4'),
 (0x1018d9860,0x1e250842,'Uniform factor multiplies X in S2'),
 (0x1018d9864,0x1e250863,'Uniform factor multiplies Y in S3'),
 (0x1018d9868,0x1e250884,'Uniform factor multiplies Z in S4'),
 (0x1018d9870,0xad038be3,'Save Y atSP+112 and X atSP+128'),
 (0x1018d9874,0x3d801be4,'Save Z atSP+96'),
 (0x1018d9304,0xad431be5,'Load Z into Q5 and Y into Q6'),
 (0x1018d9308,0x1e2008a1,'Axial near displacement uses Z'),
 (0x1018d9310,0x1e2008c0,'Axial extent uses Y'),
 (0x1018d931c,0x3dc023e7,'Load X into Q7'),
 (0x1018d9320,0x1e2208e2,'Across width uses X'),
 (0x1018d9328,0x1e230842,'Across uses half width'),
 (0x1018f4d88,0x2d428500,'Getter returns draw+20 and+24'),
 (0x1018f4d8c,0xbd401d02,'Getter returns draw+28'),
]

def verify(image,core):
 # The complete existing ray functions and dispatch remain independently pinned.
 witness.pinned(ray.OUTPUT,RAY_SHA256);ray.verify(image,core)
 starts=function_starts(image.data,core['functionStarts']);spans=[]
 for name,start,end,digest in SPANS:
  slot=bisect.bisect_left(starts,start);require(starts[slot:slot+2]==[start,end],'Draw-data function bounds differ: '+name)
  raw=image.at(start,end-start);require(witness.sha(raw)==digest,'Draw-data function bytes differ: '+name)
  spans.append({'name':name,'start':hex(start),'next':hex(end),'bytes':len(raw),'sha256':digest,'hex':raw.hex()})
 selected=[]
 for pc,word,reading in WORDS:
  require(image.word(pc)==word,'Draw-data instruction differs: '+reading)
  selected.append({'address':hex(pc),'word':f'{word:08x}','reading':reading})
 fields=[]
 for name,pc,offset in FIELDS:
  image.pair({'name':name,'hash':witness.fnv(name),'hashPair':[pc,pc+4]});image.movz(pc+8,2,offset)
  require(image.branch(pc+20)==0x10188963c,'Scale registration wrapper differs')
  fields.append({'candidate':name,'hash':f'{witness.fnv(name):08x}','address':hex(pc),'definitionOffset':offset})
 image.movz(0x10188965c,3,0x83);require(image.branch(0x10188966c)==0x10169ebe8,'Scale descriptor registry differs')
 return {'functionSpans':spans,'selectedInstructions':selected,'fieldRegistrations':fields,'scaleDescriptorTag':0x83}

def component_layout():
 # Derived from guarded reverse-loop cursor, loads, spills and reloads. Keep
 # these byte offsets explicit: the temporary vector register order differs.
 cursor=44-20
 loads={'X':cursor-4,'Y':cursor,'Z':cursor+4}
 spills={'X':128,'Y':112,'Z':96}
 return {'drawRecordBytes':44,'birthRecordBytes':36,'drawScaleOffsets':loads,
         'birthScaleOffsets':{'X':16,'Y':20,'Z':24},'rayTemporarySpillOffsets':spills,
         'rayUse':{'width':'X','length':'Y','nearDisplacement':'Z'}}

def observe():
 core=json.loads(witness.pinned(ray.defaults.CORE,ray.defaults.CORE_SHA256));raw=witness.restored.checked(Path(core['native']['path']).read_bytes(),core['native']);witness.pinned(witness.PARSER,witness.PARSER_SHA256)
 data,sections=runpy.run_path(str(witness.PARSER))['arm64_sections'](raw,core['native']['architecture'])
 return {'format':1,'native':core['native'],'constructorWitness':{'path':str(ray.defaults.CORE),'sha256':ray.defaults.CORE_SHA256},'rayWitness':{'path':str(ray.OUTPUT),'sha256':RAY_SHA256},**verify(witness.Image(data,sections),core),**component_layout(),
 'reading':{'preparedScale':'Definition scale0 vector at+0x420, either constant or evaluated at clamped particle phase, multiplies matching birth-record XY/Z components and a shared emitter factor. Stores preserve XY/Z order at draw+20/+24/+28. An optional external uniform factor can multiply all three components afterward.',
 'birthInput':'The initializer copies input floats+104/+108/+112 into birth-record+16/+20/+24. The producer of that input and its relation to authored birthScale0 remain separate evidence.',
 'ray':'The ray reverse-loop cursor points at record+24. Loads at cursor-4, cursor, cursor+4 are X,Y,Z. After a shared factor, Q3(Y) and Q2(X) spill at SP+112/+128 while Q4(Z) spills at SP+96. Reloaded Q5(Z) and Q6(Y) control near and far axial placement; Q7(X) controls half-width.',
 'correction':'The earlier prose reading in NATIVE-RAY-PACKET.md swapped width and axial roles. Full register tracking establishes X width, Y length, Z near displacement. The original immutable ray record remains historical evidence; this new record corrects its interpretation.'},
 'nativeExecuted':False,'nativeShaderExecuted':False,'applicationBehaviorChanged':False,
 'limits':['Bounded static bytes, not native execution or live Yi dispatch.','Candidate field names come from FNV/layout matching and do not exclude hash collisions.','The initializer input producer, shared scale factors, optional external factor, transform/orientation producers and live floating-point environment remain unresolved.','The local ray component mapping agrees with this consumer; that does not establish exact geometry, attachment, axis fallback, UV orientation or visual parity.','Original historical source/LLVM archives remain unchanged and are not restored by this witness.']}

if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args();result=observe();write_outputs([(OUTPUT,(json.dumps(result,indent=2,allow_nan=False)+'\n').encode())],args.check);print(json.dumps({'nativeFunctions':len(result['functionSpans']),'selectedInstructions':len(result['selectedInstructions']),'rayUse':result['rayUse'],'nativeExecuted':False}))
