"""Independent float32 FMA/modulo/binary16/normalized-byte particle packets."""
from pathlib import Path
import ctypes as c,ctypes.util,hashlib,json,struct,sys
from primary_hit_ray_size_reference import source_ray,sizes
for path,digest in [('docs/reference/native-atlas-runtime.json','1755709dceba19f907e1f754ba84ecab00206905751d6b9e894cf7e84a7c46d6'),('docs/reference/native-ray-packet.json','ab9b825f1108ed1e44124ee5f9821753eb73352cbf8738a8eebbb884c892b4ec'),('docs/reference/native-particle-vertex-format.json','2c45b6fb42a5eea59daa453e96af9f5d49a2afa38a1a84dafaf3be2b8919e1f6')]:
 if hashlib.sha256(Path(path).read_bytes()).hexdigest()!=digest:raise ValueError('Native packet witness differs: '+path)
libm=c.CDLL(ctypes.util.find_library('m'));fma=libm.fmaf;fma.argtypes=[c.c_float]*3;fma.restype=c.c_float;mod=libm.fmodf;mod.argtypes=[c.c_float]*2;mod.restype=c.c_float
f32=lambda x:struct.unpack('<f',struct.pack('<f',x))[0]
half=lambda x:struct.unpack('<e',struct.pack('<e',f32(x)))[0]
def byte_component(value):
 value=f32(value)
 return (0 if value<=0 else 255 if value>=1 else int(fma(value,255,.5)))/255
request=json.loads(Path(sys.argv[1]).read_text());output=[]
if sys.argv[3:]==['--components']:output=[byte_component(v)for v in request]
elif not sys.argv[3:]:
 ray_source=None
 for row in request:
  if row['kind']=='ray':
   packet={'cell':row['cell'],'lookup':[half(v)for v in row['lookup']],'color':[byte_component(v)for v in row['color']]}
   if 'phase'in row:
    if ray_source is None:ray_source=source_ray()
    packet['size']=sizes(ray_source,row['phase'])
   output.append(packet);continue
  uv=row['uv'];animation=f32(f32(row['age'])*f32(uv['frameRate']))if uv['frameRate']>0 else 0
  combined=fma(f32(row['roll']),uv['frames'],animation)if uv['randomStart']else animation
  continuous=f32(uv['startFrame']+mod(combined,uv['frames']));frame=int(half(continuous)//1)
  columns,rows=uv['divisions'];output.append({'cell':[(frame%columns)/columns,(frame//columns)/rows],'lookup':[half(v)for v in row['lookup']],'color':row['color'],'continuousFrame':continuous,'packedFrame':half(continuous)})
else:raise ValueError('Unsupported reference mode')
Path(sys.argv[2]).write_text(json.dumps(output,separators=(',',':'))+'\n')
