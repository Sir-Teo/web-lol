"""Verify two legacy DDS fallbacks against frozen archive metadata; no target execution."""
from pathlib import Path
from io import BytesIO
import hashlib,json,struct
from PIL import Image,__version__ as pillow_version
from xxhash import xxh64_intdigest,xxh3_64_intdigest
from cdtb.tools import zstd_decompress
from riot_archive import RiotArchive
import native_constructor_witness as witness
from masteryi_audio_graph import write_outputs
OUTPUT=Path('docs/reference/legacy-particle-default-textures.json')
SOURCE=Path('docs/reference/gromp-effects.json')
SOURCE_SHA256='3cb54cd774fbfd66cc52846bb8775d17ab0adb473a570600e274e5f2ae0a1033'
LEGACY=Path('docs/reference/native-legacy-primitive-types.json')
LEGACY_SHA256='2e56236915d08ec883f89de2848a0571dc2085081b837d75e5a412ef8cdfda61'
ROOT=Path('.cache/native-legacy-default-textures')
EXTRA={'id':'DB536396C2D43D58','url':'https://lol.dyn.riotcdn.net/channels/public/bundles/6859BDE6E142DF38.bundle','offset':9837393,'bytes':453,'sha256':'c744931f8a602fa1b7fffee95dbcf262fbf614b2f40e3f3b7ce0a044574903a4','decodedBytes':443}
RESOURCES=[('data/particles/defaultcoloroverlifetime.dds',136,'3860afa00c25245d4a8dd0893089b7ba67d2bb16b8ca83cb96103617932abdef'),('data/particles/defaultfalloff.dds',2192,'5a3513bdd4b8d5499d7533eab7a052aede226993e6722add45c854fee51bcec2')]
def require(ok,message):
 if not ok:raise ValueError(message)
def rgb565(value):
 r=(value>>11)&31;g=(value>>5)&63;b=value&31
 return[(r<<3)|(r>>2),(g<<2)|(g>>4),(b<<3)|(b>>2)]
def block(raw,bc3):
 color=raw[8:]if bc3 else raw
 a,b,bits=struct.unpack('<HHI',color);c0,c1=rgb565(a),rgb565(b)
 if bc3 or a>b:palette=[c0,c1,[(2*x+y)//3 for x,y in zip(c0,c1)],[(x+2*y)//3 for x,y in zip(c0,c1)]]
 else:palette=[c0,c1,[(x+y)//2 for x,y in zip(c0,c1)],[0,0,0]]
 alpha=[255]*16
 if bc3:
  x,y=raw[:2];table=[x,y]
  if x>y:table += [((7-i)*x+i*y)//7 for i in range(1,7)]
  else:table += [((5-i)*x+i*y)//5 for i in range(1,5)]+[0,255]
  selectors=int.from_bytes(raw[2:8],'little');alpha=[table[(selectors>>(i*3))&7]for i in range(16)]
 result=[]
 for i in range(16):
  index=(bits>>(i*2))&3
  result.append(palette[index]+[0 if not bc3 and a<=b and index==3 else alpha[i]])
 return result

def decode(raw):
 require(len(raw)>=128 and raw[:4]==b'DDS 'and struct.unpack_from('<I',raw,4)[0]==124,'DDS header differs')
 height,width=struct.unpack_from('<II',raw,12);mips=struct.unpack_from('<I',raw,28)[0]or 1;fourcc=raw[84:88]
 require(fourcc in (b'DXT1',b'DXT5')and 1<=width<=256 and 1<=height<=4 and 1<=mips<=9,'DDS shape/format outside bounded fallback scope')
 offset=128;rows=[];bc3=fourcc==b'DXT5';stride=16 if bc3 else 8
 for level in range(mips):
  data=bytearray(width*height*4);start=offset
  for by in range((height+3)//4):
   for bx in range((width+3)//4):
    require(offset+stride<=len(raw),'Truncated DDS mip');pixels=block(raw[offset:offset+stride],bc3);offset+=stride
    for y in range(4):
     for x in range(4):
      px=bx*4+x;py=by*4+y
      if px<width and py<height:data[(py*width+px)*4:(py*width+px)*4+4]=bytes(pixels[y*4+x])
  rows.append({'level':level,'width':width,'height':height,'offset':start,'compressedBytes':offset-start,'rgba':bytes(data)})
  width=max(1,width//2);height=max(1,height//2)
 require(offset==len(raw),'DDS trailing payload differs');return rows

class FrozenArchive(RiotArchive):
 def __init__(self,pin,restore=False):
  self.expected={**pin['chunks'],EXTRA['id']:EXTRA};self.restore=restore;self.receipts=[]
  paths=[row[0]for row in RESOURCES]
  super().__init__({f'{xxh64_intdigest(p):016x}':p for p in paths},pin,archive_name=pin['archive'])
 def path(self,key):return (ROOT if key==EXTRA['id']else Path('.cache/riot-reference'))/(key+'.chunk')
 def verify_chunk(self,chunk,data):
  key=f'{chunk.chunk_id:016X}';row=self.expected.get(key)
  require(row is not None and row['offset']==chunk.offset and row['bytes']==chunk.size and row['url']==f'https://lol.dyn.riotcdn.net/channels/public/bundles/{chunk.bundle.bundle_id:016X}.bundle','Fallback manifest chunk binding differs')
  require(len(data)==chunk.size and hashlib.sha256(data).hexdigest()==row['sha256'],'Fallback chunk bytes differ: '+key)
 def prefetch(self,ranges):
  for offset,size in ranges:
   for _,chunk in self.chunks_for(offset,size):
    key=f'{chunk.chunk_id:016X}';path=self.path(key);row=self.expected.get(key);require(row is not None,'Unpinned fallback chunk')
    if not path.exists()and self.restore:
     data,receipt=witness.restored.fetch({**row,'path':str(path),'range':[chunk.offset,chunk.offset+chunk.size-1]});path.parent.mkdir(parents=True,exist_ok=True)
     with path.open('xb')as stream:stream.write(data)
     self.receipts.append(receipt)
    self.verify_chunk(chunk,path.read_bytes())
 def read_at(self,start,size):
  self.prefetch([(start,size)]);end=start+size;parts=[]
  for i,chunk in self.chunks_for(start,size):
   key=f'{chunk.chunk_id:016X}';raw=self.path(key).read_bytes();self.verify_chunk(chunk,raw);data=zstd_decompress(raw);require(len(data)==chunk.target_size,'Fallback chunk decoded size differs')
   row=self.expected[key];self.reads[key]={k:row[k]for k in ['url','offset','bytes','sha256']};parts.append(data[max(0,start-self.offsets[i]):min(chunk.target_size,end-self.offsets[i])])
  result=b''.join(parts);require(len(result)==size,'Fallback archive extent differs');return result

def observe(restore=False):
 pin=json.loads(witness.pinned(SOURCE,SOURCE_SHA256));legacy=json.loads(witness.pinned(LEGACY,LEGACY_SHA256));manifest=Path('.cache/riot-reference/29CE6E781C3B6368.manifest')
 if not manifest.exists()and restore:
  row={**pin['extraction']['manifest'],'path':str(manifest),'bytes':16683525};data,_=witness.restored.fetch(row);manifest.parent.mkdir(parents=True,exist_ok=True)
  with manifest.open('xb')as stream:stream.write(data)
 witness.pinned(manifest,pin['extraction']['manifest']['sha256']);archive=FrozenArchive(pin['extraction'],restore);resources=[]
 for path,length,digest in RESOURCES:
  entry=archive.entries[path];require(entry.type==3,'Fallback WAD compression differs');compressed=archive.read_at(entry.offset,entry.compressed_size);require(xxh3_64_intdigest(compressed)==entry.sha256,'Fallback compressed WAD checksum differs');raw=entry.read_data(archive,archive.toc)
  require(len(raw)==length and hashlib.sha256(raw).hexdigest()==digest,'Fallback DDS source differs');mips=[]
  for mip in decode(raw):
   header=bytearray(raw[:128]);struct.pack_into('<II',header,12,mip['height'],mip['width']);struct.pack_into('<I',header,28,1)
   image=Image.open(BytesIO(bytes(header)+raw[mip['offset']:mip['offset']+mip['compressedBytes']])).convert('RGBA');rgba=mip['rgba'];require(image.tobytes()==rgba,'Independent fallback mip decode differs')
   mips.append({k:v for k,v in mip.items()if k!='rgba'}|{'rgbaSha256':hashlib.sha256(rgba).hexdigest(),'extrema':[[min(rgba[i::4]),max(rgba[i::4])]for i in range(4)],'nonwhiteTexels':sum(rgba[i:i+4]!=b'\xff\xff\xff\xff'for i in range(0,len(rgba),4))})
  resources.append({'path':path,'wadPathHash':f'{entry.path_hash:016x}','offset':entry.offset,'compressedBytes':entry.compressed_size,'compressedXxh3':f'{entry.sha256:016x}','compressedSha256':hashlib.sha256(compressed).hexdigest(),'bytes':len(raw),'sha256':digest,'ddsHex':raw.hex(),'fourCC':raw[84:88].decode(),'mips':mips})
 require([len(r['mips'])for r in resources]==[1,9],'Fallback mip counts differ');require(resources[0]['mips'][0]['extrema']==[[255,255]]*4,'Color fallback is not white')
 return {'format':1,'inputs':[{'path':str(SOURCE),'sha256':SOURCE_SHA256},{'path':str(LEGACY),'sha256':LEGACY_SHA256}],'manifest':archive.manifest,'archive':archive.file.name,'chunks':archive.reads,'newObservedChunk':EXTRA,'resources':resources,'decoder':{'independent':'bounded BC1/BC3 block decoder','comparison':'Pillow','version':pillow_version},'reading':{'color':'The exact legacy DATA/Particles/DefaultColorOverLifetime.dds source decodes to4x4 opaque white at its only mip.','falloff':'The exact legacy DATA/Particles/DefaultFalloff.dds declares9 mips. Its256x1 base has opaque alpha and30 nonwhite RGB texels at its end. Smaller declared mips are recorded individually; native selection and usage remain unobserved.','binding':'The earlier static legacy loader witness supplies these two literal paths as fallback arguments. This resource check does not prove actual live Gromp texture binding, UV routing or sampler state.'},'nativeExecuted':False,'applicationBehaviorChanged':False,'limits':['Archive resource bytes and independent mip decoding only. No native game or Metal execution.','The453-byte falloff RMAN chunk was newly observed and checked against its xxh3 checksum in the already SHA-bound WAD header, then frozen by SHA256. It is not part of the older Gromp chunk certificate.','DDS decoded pixels do not establish color space, filtering, selected mip, UV routing, actual shader selection or complete native composition.']}
if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');parser.add_argument('--restore',action='store_true');parser.add_argument('--output',type=Path,default=OUTPUT);args=parser.parse_args();result=observe(args.restore);write_outputs([(args.output,(json.dumps(result,indent=2,allow_nan=False)+'\n').encode())],args.check);print(json.dumps({'resources':len(result['resources']),'mips':sum(len(r['mips'])for r in result['resources']),'nativeExecuted':False}))
