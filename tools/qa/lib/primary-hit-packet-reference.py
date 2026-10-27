"""Independent float32/fmaf/fmodf/binary16 packet calculation on local sampler inputs."""
from pathlib import Path
import ctypes as c,ctypes.util,hashlib,json,struct,sys
pin=Path('docs/reference/native-atlas-runtime.json').read_bytes()
if hashlib.sha256(pin).hexdigest()!='1755709dceba19f907e1f754ba84ecab00206905751d6b9e894cf7e84a7c46d6':raise ValueError('Native atlas witness differs')
libm=c.CDLL(ctypes.util.find_library('m'));fma=libm.fmaf;fma.argtypes=[c.c_float]*3;fma.restype=c.c_float;mod=libm.fmodf;mod.argtypes=[c.c_float]*2;mod.restype=c.c_float
f32=lambda x:struct.unpack('<f',struct.pack('<f',x))[0]
half=lambda x:struct.unpack('<e',struct.pack('<e',f32(x)))[0]
request=json.loads(Path(sys.argv[1]).read_text());output=[]
for row in request:
 uv=row['uv'];animation=f32(f32(row['age'])*f32(uv['frameRate']))if uv['frameRate']>0 else 0
 combined=fma(f32(row['roll']),uv['frames'],animation)if uv['randomStart']else animation
 continuous=f32(uv['startFrame']+mod(combined,uv['frames']));frame=int(half(continuous)//1)
 columns,rows=uv['divisions'];output.append({'cell':[(frame%columns)/columns,(frame//columns)/rows],'lookup':[half(v)for v in row['lookup']],'continuousFrame':continuous,'packedFrame':half(continuous)})
Path(sys.argv[2]).write_text(json.dumps(output,separators=(',',':'))+'\n')
