"""Software float32 transcription of statically identified generic SCB normals.
No game/shader execution; no inference of actual Leona draw dispatch.
"""
from pathlib import Path
from fractions import Fraction
import math,struct,json,hashlib,sys

def f32(x):return struct.unpack('<f',struct.pack('<f',x))[0]
def bits(x):return struct.unpack('<I',struct.pack('<f',x))[0]
def from_bits(x):return struct.unpack('<f',struct.pack('<I',x))[0]
def require(ok,message):
 if not ok:raise ValueError(message)
def fma32(a,b,c):
 # Compare exact rational distances to the nearest float32 and its neighbors.
 # This also removes potential float64-to-float32 double-rounding at a tie.
 exact=Fraction(a)*Fraction(b)+Fraction(c);approx=f32(float(exact));word=bits(approx)
 choices=[approx]
 for w in [word-1,word+1]:
  if 0<=w<=0xffffffff:
   x=from_bits(w)
   if math.isfinite(x):choices.append(x)
 if approx==0:choices.extend([from_bits(1),from_bits(0x80000001)])
 return min(choices,key=lambda x:(abs(Fraction(x)-exact),bits(x)&1))
EPS_SQUARED=from_bits(0x3089705f)
SNAP=from_bits(0x3a03126f)
def normalized(v):
 x,y,z=v;length2=fma32(z,z,fma32(x,x,f32(y*y)))
 if length2<=EPS_SQUARED:return list(v)
 scale=f32(1/f32(math.sqrt(length2)))
 return [f32(t*scale) for t in v]
def face_normal(a,b,c):
 u=[f32(b[k]-a[k]) for k in range(3)];v=[f32(c[k]-a[k]) for k in range(3)]
 normal=normalized([fma32(u[1],v[2],-f32(u[2]*v[1])),fma32(u[2],v[0],-f32(u[0]*v[2])),fma32(u[0],v[1],-f32(u[1]*v[0]))])
 return [0. if abs(t)<SNAP else t for t in normal]
def normals(points,indices):
 require(points and len(indices)%3==0 and indices,'Invalid mesh extents')
 require(all(len(p)==3 and all(math.isfinite(x) and f32(x)==x for x in p) for p in points),'Require original finite float32 points')
 require(all(type(i) is int and 0<=i<len(points) and i<=65535 for i in indices),'Require source UInt16-compatible indices')
 sums=[[0.,0.,0.] for _ in points];snapped=0;degenerate=0
 for off in range(0,len(indices),3):
  group=indices[off:off+3];normal=face_normal(*(points[i] for i in group));snapped+=sum(x==0 for x in normal);degenerate+=int(not any(normal))
  for i in group:sums[i]=[f32(a+b) for a,b in zip(sums[i],normal)]
 source=[normalized(v) for v in sums]
 return source,[component for i in indices for component in source[i]],dict(zeroFaces=degenerate,zeroFaceComponents=snapped,zeroVertexNormals=sum(not any(v) for v in source))

def self_check():
 require(fma32(f32(1+2**-23),f32(1-2**-23),-1)==-2**-46,'Fused cancellation differs')
 require(normalized([f32(1e-6),0.,0.])==[f32(1e-6),0.,0.],'Short vector must remain unchanged')
 points=[[0.,0.,0.],[1000.,0.,0.],[0.,1000.,0.],[0.,0.,1.],[1.,0.,0.]]
 values,_,_=normals(points,[0,1,2,0,3,4]);half=f32(1/math.sqrt(2))
 require(values[0]==[0.,half,half],'Face contributions must have equal unit weighting')
 split=points+[[0.,0.,0.]];values,_,_=normals(split,[0,1,2,5,3,4])
 require(values[0]==[0.,0.,1.] and values[5]==[0.,1.,0.],'Coincident source indices must remain distinct')
 snap=face_normal([0.,0.,0.],[1.,0.,0.],[0.,f32(.00049),1.])
 require(snap[2]==0 and snap[1]<0 and abs(snap[1])<1,'Snap must occur after normalization without renormalization')
 require(face_normal([0.,0.,0.],[0.,0.,0.],[1.,0.,0.])==[0.,0.,0.],'Degenerate face must have no invented normal')
 return ['fused cancellation','short vector retention','equal face weighting across unequal areas','distinct coincident source indices','post-normalization strict component snapping','degenerate no-fallback']

def emit(path,value):
 raw=(json.dumps(value,indent=2)+'\n').encode()
 if '--check' in sys.argv:require(path.read_bytes()==raw,'Derived bytes differ: '+str(path))
 else:path.write_bytes(raw)
def main():
 checks=self_check();root=Path('.cache/leona-native-mesh-reading-v1-20261024');meta=Path('.cache/leona-e-particles-decoded-v1-20261024.json');decoded=json.loads(meta.read_text());rows=[]
 source_pin=Path('docs/reference/leona-e-particles.json');require(decoded['sourcePinSha256']==hashlib.sha256(source_pin.read_bytes()).hexdigest(),'Canonical source pin differs');extraction=json.loads(source_pin.read_text())['extraction']['files']
 for m in decoded['meshes']:
  raw_path=Path('.cache/leona-e-particle-sources-v2-20261024')/(m['source']['wadPathHash']+'.scb');raw=raw_path.read_bytes();require(hashlib.sha256(raw).hexdigest()==m['source']['sha256'],'SCB hash differs')
  require(any(row==m['source'] for row in extraction),'SCB source declaration differs')
  require(raw[:8]==b'r3d2Mesh' and struct.unpack_from('<HH',raw,8)==(3,2),'Require SCB3.2')
  count,faces=struct.unpack_from('<II',raw,140);require(count==m['sourceVertices'] and faces==m['triangles'],'Source counts differ');points=[list(struct.unpack_from('<3f',raw,180+i*12)) for i in range(count)]
  flags=struct.unpack_from('<I',raw,148)[0];has_colors=struct.unpack_from('<I',raw,176)[0];require(flags in [1,2] and has_colors in [0,1],'Unsupported source flags')
  face_start=180+count*12+has_colors*count*4+12
  original_indices=[i for face in range(faces) for i in struct.unpack_from('<3I',raw,face_start+face*100)]
  require(original_indices==m['sourceIndices'],'Decoded indices differ from original SCB')
  require(face_start+faces*100+(faces*9 if flags&1 else 0)==len(raw),'Unparsed SCB tail')
  require([v for i in original_indices for v in points[i]]==m['positions'],'Decoded original corner positions differ')
  source,expanded,stats=normals(points,m['sourceIndices']);require(stats['zeroVertexNormals']==0,'Source mesh has unsupported zero normals')
  out=root/(Path(m['source']['path']).stem+'-normals.json');record=dict(classification='Derived from bounded generic native static algorithm; no native target/shader/frame execution. Software float32/FMA transcription, not measured GPU parity.',source=m['source'],sourceIndices=m['sourceIndices'],sourceVertexNormals=source,expandedCornerNormals=expanded,statistics=stats)
  emit(out,record);packed=struct.pack('<'+'f'*len(expanded),*expanded);rows.append(dict(path=str(out),bytes=out.stat().st_size,sha256=hashlib.sha256(out.read_bytes()).hexdigest(),sourceVertices=count,triangles=faces,corners=len(expanded)//3,expandedFloat32Sha256=hashlib.sha256(packed).hexdigest(),statistics=stats))
 report=dict(method='Exact-rational FMA32 and float32 operation-order transcription of991730/167c54c/991fa8. f32 sqrt/divide use ordinary host binary64 then binary32 rounding; no target execution or numerical native GPU parity claim.',checks=checks,decodedInputSha256=hashlib.sha256(meta.read_bytes()).hexdigest(),meshes=rows)
 emit(root/'derived-normal-streams.json',report);print('PASS derived normals:',len(rows),'SCB streams;',len(checks),'independent mathematical controls; no target execution')
if __name__=='__main__':main()
