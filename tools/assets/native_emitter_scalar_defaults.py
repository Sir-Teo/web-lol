"""Native atlas/flag defaults from frozen ARM64 bytes; no disassembler needed."""
from pathlib import Path
import json,runpy,struct
import native_constructor_witness as witness
from masteryi_audio_graph import write_outputs
CORE=Path('docs/reference/native-constructor-witness.json')
CORE_SHA256='613708926130a286adc8ad170d2769ee5cbf56b012c8815fa771a934564f5c97'
BIN_READER=Path('.tools/cdtb/cdtb/binfile.py')
BIN_READER_SHA256='0c1825135763c98f705535eecf2b4b1a8e667c53181e9e1d43ad7a83d1d844fd'
OUTPUT=Path('docs/reference/native-emitter-scalar-defaults.json')
require=witness.require
SPANS=[('registration', 4320833436, 3912, '5e0ede5819fbf40590348b9fb87767271b547af3a6acf124e7e08b25e87ac60e'),
 ('constructor', 4320839724, 1064, '2dcad45a377031f968f1853db3115140f15b014a00aa7ff3ea035bbf219b1684'),
 ('floatWrapper', 4295484180, 60, 'e06b32c3e5a0c6b667332c5d907d786abfd2d93e10ea408a3d1e947833379bbb'),
 ('uint16Wrapper', 4295519868, 60, '02dee7aec1568992e67cd382182e307e1ee7d505573a4977d4cc4af6b37c237b'),
 ('packedFlagWrapper', 4318686656, 148, 'e7adf6cdd94293791245c1498f2adf77907a40ccda41da25e8443430c92c8601')]
SCALARS=[('frameRate', 4320836696), ('numFrames', 4320836752), ('startFrame', 4320836780)]
FLAGS=[('HasVariableStartTime', '538effa4', 4320833644, 524288),
 ('isSingleParticle', '42bd7f6b', 4320833784, 1048576),
 ('doesLifetimeScale', '79a8b75b', 4320834008, 1073741824),
 ('doesParticleLifetimeScale', '10ea55cd', 4320834092, 536870912),
 ('IsEmitterSpace', 'a786282d', 4320834708, 131072),
 (None, 'd1ee8634', 4320835800, 1),
 ('particleIsLocalOrientation', '37ddb774', 4320835828, 2),
 ('isDirectionOriented', 'ddfca826', 4320835856, 4),
 ('isUniformScale', '3559e15b', 4320835884, 8),
 ('hasPostRotateOrientation', 'ed87335c', 4320835912, 16),
 ('isRandomStartFrame', 'e09d5ebb', 4320835940, 32),
 ('doesCastShadow', 'b5158067', 4320835968, 128),
 ('isRotationEnabled', '8d2e2474', 4320835996, 256),
 ('uvScrollClamp', 'a6630e0a', 4320836024, 512),
 ('isFollowingTerrain', 'baa6e0c9', 4320836052, 2048),
 ('isGroundLayer', '27d40903', 4320836080, 4096),
 ('useEmissionMeshNormalForBirth', '7ba817e9', 4320836108, 8192),
 ('useNavmeshMask', 'dddde180', 4320836136, 16384),
 ('ParticlesShareRandomValue', '676949a1', 4320836164, 32768),
 ('SortEmittersByPos', 'bd9b83c7', 4320836192, 65536),
 ('WriteAlphaOnly', '51af37d2', 4320836220, 2147483648),
 ('isLocalOrientation', '2ae335b2', 4320836360, 2097152)]

def mov_value(image,address,register,keep=False):
 word=image.word(address)
 require(word&0xff80001f==((0x72800000 if keep else 0x52800000)|register),'Expected scalar MOVZ/MOVK W register')
 shift=((word>>21)&3)*16
 require(shift<32,'Invalid scalar move shift')
 return ((word>>5)&65535)<<shift

def store(image,address,register,offset,width):
 word=image.word(address)
 require(width in (4,8),'Unsupported scalar store width')
 opcode=0xb9000000 if width==4 else 0xf9000000
 require(word&0xffc003ff==(opcode|(19<<5)|register),'Expected unsigned scalar store through saved this')
 require(((word>>10)&4095)*width==offset,'Scalar constructor store offset differs')

def verify(image):
 spans=[]
 for name,start,count,digest in SPANS:
  raw=image.at(start,count);require(witness.sha(raw)==digest,'Native scalar function bytes differ: '+name)
  spans.append({'name':name,'start':hex(start),'next':hex(start+count),'bytes':count,'sha256':digest,'hex':raw.hex()})
 require(image.word(0x1018ac84c)==0xaa0003f3,'Constructor saved-this register differs')
 packed=mov_value(image,0x1018ac9f0,11);store(image,0x1018ac9f4,11,0x260,8)
 start,frames,rate=struct.unpack('<HHf',struct.pack('<Q',packed))
 flags=mov_value(image,0x1018aca5c,10)|mov_value(image,0x1018aca60,10,True)
 store(image,0x1018aca64,10,0x2d0,4)
 require((start,frames,rate,flags)==(0,1,0.0,0x202000),'Native scalar constructor values differ')
 registrations=[]
 for name,address in SCALARS:
  offset={'startFrame':0x260,'numFrames':0x262,'frameRate':0x264}[name]
  wrapper=0x10007e314 if name=='frameRate' else 0x100086e7c
  tagpc=0x10007e32c if name=='frameRate' else 0x100086e94
  tag=10 if name=='frameRate' else 5
  image.pair({'name':name,'hash':witness.fnv(name),'hashPair':[address,address+4]})
  image.movz(address+8,2,offset)
  require(image.word(address+12)==0xd2800003 and image.word(address+16)==0xd2800004,'Scalar registration optional arguments differ')
  require(image.branch(address+20)==wrapper,'Scalar registration wrapper differs')
  image.movz(tagpc,3,tag)
  require(image.branch(tagpc+20)==0x10169ebe8,'Scalar descriptor registry differs')
  registrations.append({'candidate':name,'hash':f'{witness.fnv(name):08x}','address':hex(address),'offset':offset,'wrapper':hex(wrapper),'descriptorTag':tag,'storage':'float32'if tag==10 else'uint16'})
 flagrows=[];masks=set()
 for name,hashed,address,mask in FLAGS:
  if name:image.pair({'name':name,'hash':int(hashed,16),'hashPair':[address,address+4]})
  else:require(mov_value(image,address,1)|mov_value(image,address+4,1,True)==int(hashed,16),'Unknown flag hash differs')
  image.movz(address+8,2,0x2d0);image.movz(address+12,3,mask)
  require(image.word(address+16)==0xd2800004 and image.branch(address+20)==0x10169edc0,'Flag wrapper registration differs')
  require(mask and not mask&(mask-1) and mask not in masks,'Invalid or repeated native flag mask');masks.add(mask)
  flagrows.append({'candidate':name,'hash':hashed,'address':hex(address),'definitionOffset':0x2d0,'mask':mask,'constructorSet':bool(flags&mask)})
 require(len(flagrows)==22 and sum(r['mask']for r in flagrows if r['constructorSet'])==flags,'Native constructor flag closure differs')
 return {'atlas':{'startFrame':start,'numFrames':frames,'frameRate':rate},'flagWord':flags,'flags':flagrows,'scalarRegistrations':registrations,'functionSpans':spans}

def observe():
 core=json.loads(witness.pinned(CORE,CORE_SHA256));native=core['native']
 witness.pinned(BIN_READER,BIN_READER_SHA256)
 raw=witness.restored.checked(Path(native['path']).read_bytes(),native)
 witness.pinned(witness.PARSER,witness.PARSER_SHA256)
 data,sections=runpy.run_path(str(witness.PARSER))['arm64_sections'](raw,native['architecture'])
 return {'format':1,'nativeWitness':{'path':str(CORE),'sha256':CORE_SHA256},'binReader':{'path':str(BIN_READER),'sha256':BIN_READER_SHA256},'native':native,**verify(witness.Image(data,sections)),'nativeExecuted':False,'limits':['Exact bounded static bytes and selected registration/constructor instruction decoding only; no native game or shader execution.','Field names are FNV/layout candidates; hashes do not exclude collisions or authenticate native literal names.','Native descriptor tags 5 and 10 align with uint16 and float32 in the pinned BIN reader. Packed flag masks identify constructor bits, without certifying later overrides or runtime orientation semantics.','Full constructor bytes include exception cleanup. The normal return is at 0x1018acbb0; later cleanup is not a successful construction path.','This record neither replaces historical LLVM text nor establishes actual Yi dispatch, shader behavior or native visual parity.']}

if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
 result=observe();write_outputs([(OUTPUT,(json.dumps(result,indent=2,allow_nan=False)+'\n').encode())],args.check)
 print(json.dumps({'scalarRegistrations':len(result['scalarRegistrations']),'flagRegistrations':len(result['flags']),'atlas':result['atlas'],'flagWord':hex(result['flagWord']),'nativeExecuted':False}))
