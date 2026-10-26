"""Frozen selected native-client payloads; static parsing only, no target execution."""
from pathlib import Path
import hashlib,io,json,plistlib,re,runpy,sys
from urllib.parse import urlparse
from urllib.request import Request,urlopen
ROOT=Path(__file__).resolve().parents[2]
PIN=ROOT/'docs/reference/leona-native-matching.json'
PIN_SHA256='57a8cf95b813290d512bc0d99dc7ced639709b02d206e2a6bb3fab7034d8168e'
VERIFIER=ROOT/'tools/assets/verify-leona-native-matching.py'
VERIFIER_SHA256='05d9ee04bded7fd98f7baf771c8f0286fa1335c75fd69eab16fab6578e18f643'
HOSTS={'lol.secure.dyn.riotcdn.net','lol.dyn.riotcdn.net'}
def require(ok,message):
 if not ok:raise ValueError(message)
def sha(raw):return hashlib.sha256(raw).hexdigest()
def checked(raw,row):
 require(len(raw)==row['bytes']and sha(raw)==row['sha256'],'Frozen native bytes differ: '+row['path']);return raw
def target(row):
 path=(ROOT/row['path']).resolve();require(path.is_relative_to(ROOT/'.cache')and '..'not in Path(row['path']).parts,'Invalid native cache path');return path
def rows(pin):return[pin['officialManifest'],pin['frozenAssetsManifest'],*pin['chunks'],*pin['selectedFiles']]
def load(path=PIN):
 raw=Path(path).read_bytes();require(sha(raw)==PIN_SHA256,'Frozen native pin differs');pin=json.loads(raw)
 require(pin['matchingVersion']=='16.18.8175716'and pin['nativeExecuted']is False and pin['nativeInstalled']is False,'Native scope differs')
 require(len(rows(pin))==21 and len({r['path']for r in rows(pin)})==21 and len(pin['chunks'])==14 and len(pin['selectedFiles'])==5,'Selected native closure differs')
 for row in pin['readers']['files']:checked((ROOT/row['path']).read_bytes(),row)
 require(sha(VERIFIER.read_bytes())==VERIFIER_SHA256,'Static verifier source differs')
 return pin

def preflight(pin):
 for row in rows(pin):
  path=target(row)
  if path.exists():checked(path.read_bytes(),row)

def fetch(row,opener=urlopen):
 """Bound response size and validate range framing before accepting any bytes."""
 url=row['url'];parsed=urlparse(url);require(parsed.scheme=='https'and parsed.netloc in HOSTS,'Unexpected native CDN origin')
 headers={'Accept-Encoding':'identity','User-Agent':'web-lol-frozen-native-restore/1'}
 if'range'in row:headers['Range']='bytes=%d-%d'%tuple(row['range'])
 with opener(Request(url,headers=headers),timeout=45)as response:
  final=urlparse(response.geturl());require(final.scheme=='https'and final.netloc in HOSTS,'Unexpected native CDN redirect')
  status=response.status;content_range=response.headers.get('Content-Range')
  if'range'in row:
   require(status==206,'Native CDN ignored byte range');match=re.fullmatch(r'bytes (\d+)-(\d+)/(\d+)',content_range or'')
   require(match is not None and [int(match[1]),int(match[2])]==row['range']and int(match[3])>int(match[2]),'Native CDN content range differs')
  else:require(status==200,'Unexpected native manifest status')
  length=response.headers.get('Content-Length');require(length is None or length.isdecimal()and int(length)==row['bytes'],'Native CDN content length differs')
  raw=response.read(row['bytes']+1);checked(raw,row)
  return raw,{'url':url,'finalUrl':response.geturl(),'range':row.get('range'),'status':status,'contentRange':content_range,'contentLength':length,'bytes':len(raw),'sha256':sha(raw)}

def validate_manifests(pin,payloads):
 helper=runpy.run_path(str(VERIFIER));sys.path.insert(0,str(ROOT/'.tools/cdtb'))
 from cdtb.patcher import PatcherManifest
 from cdtb.tools import zstd_decompress
 manifests=[]
 for row in [pin['officialManifest'],pin['frozenAssetsManifest']]:
  raw=checked(payloads[row['path']],row);header=helper['rman_header'](raw);require(header==row['header'],'Native RMAN header differs')
  body=zstd_decompress(raw[header['offset']:header['offset']+header['compressedBodyBytes']]);require(len(body)==header['decodedBodyBytes'],'Native RMAN decoded size differs')
  manifest=PatcherManifest();manifest.parse_body(io.BytesIO(body));require(len(manifest.files)==row['fileCount'],'Native RMAN file count differs');manifests.append(manifest)
 matching,assets=manifests
 for row in pin['chunks']:
  c=matching.chunks[int(row['id'],16)]
  require(row['url']==f'https://lol.secure.dyn.riotcdn.net/channels/public/bundles/{c.bundle.bundle_id:016X}.bundle'and row['range']==[c.offset,c.offset+c.size-1]and row['bytes']==c.size and row['decodedBytes']==c.target_size,'Native RMAN range binding differs')
 used=set()
 for row in pin['selectedFiles']:
  file=matching.files[row['name']];keys=[f'{c.chunk_id:016X}'for c in file.chunks]
  require(keys==row['chunks']and file.size==row['bytes']and row['path']==pin['nativeRoot']+'/'+row['name'],'Native selected file binding differs');used.update(keys)
 require(used=={r['id']for r in pin['chunks']},'Native chunk closure differs')
 for row in pin['matchingContent']:
  a,b=matching.files[row['name']],assets.files[row['name']]
  require(a.size==b.size==row['bytes']and helper['sequence'](a)==helper['sequence'](b)and len(a.chunks)==row['chunkCount']and helper['sequence_sha'](a)==row['sequenceSha256'],'Frozen ordered content sequence differs')
 return helper

def reconstruct(pin,payloads):
 from cdtb.tools import zstd_decompress
 decoded={}
 for row in pin['chunks']:
  raw=checked(payloads[row['path']],row);plain=zstd_decompress(raw)
  require(len(plain)==row['decodedBytes']and sha(plain)==row['decodedSha256'],'Native decoded chunk differs');decoded[row['id']]=plain
 return{row['path']:checked(b''.join(decoded[k]for k in row['chunks']),row)for row in pin['selectedFiles']}

def verify(pin,payloads):
 helper=validate_manifests(pin,payloads);rebuilt=reconstruct(pin,payloads)
 for row in pin['selectedFiles']:require(checked(payloads[row['path']],row)==rebuilt[row['path']],'Native ordered reconstruction differs')
 for name,expected in pin['versions'].items():require(json.loads(payloads[pin['nativeRoot']+'/'+name])==expected,'Native code/content version differs')
 require(plistlib.loads(payloads[pin['nativeRoot']+'/'+pin['plistName']])==pin['plist'],'Native plist differs')
 executable=payloads[pin['nativeRoot']+'/'+pin['executableName']];require(helper['macho'](executable)==pin['macho'],'Native architecture headers/slices differ')
 return{'version':pin['matchingVersion'],'selectedFiles':5,'rangeChunks':14,'compressedChunkBytes':sum(r['bytes']for r in pin['chunks']),'executableBytes':len(executable),'executableSha256':sha(executable),'architectures':[r['architecture']for r in pin['macho']['architectures']],'matchingArchives':len(pin['matchingContent']),'nativeExecuted':False,'nativeInstalled':False,'historicalEvidenceFilesRestored':False}

def publish(pin,payloads):
 # Verify the complete staged closure before preflighting every existing output.
 result=verify(pin,payloads);preflight(pin)
 for row in rows(pin):
  path=target(row)
  if path.exists():continue
  path.parent.mkdir(parents=True,exist_ok=True)
  with path.open('xb')as out:out.write(payloads[row['path']])
 return result
