"""Decode the exact pinned crescent SCB profile, retaining unresolved source fields."""
from pathlib import Path
import hashlib,json,struct
pin=json.loads(Path('docs/reference/lux-basic-attack.json').read_text())
path='assets/particles/voidcrescent.scb'
b=(Path('.cache/lux-basic-attack-sources')/path).read_bytes()
source=next(f for f in pin['extraction']['files'] if f['path']==path)
assert hashlib.sha256(b).hexdigest()==source['sha256'] and len(b)==source['bytes']
assert b[:8]==b'r3d2Mesh' and struct.unpack_from('<HH',b,8)==(3,2)
vertices,faces,flags=struct.unpack_from('<III',b,140)
assert (vertices,faces,flags)==(62,120,5)
assert struct.unpack_from('<I',b,176)[0]==0 # no per-vertex BGRA block
cursor=180
points=[struct.unpack_from('<3f',b,cursor+i*12) for i in range(vertices)]
cursor+=vertices*12
center=struct.unpack_from('<3f',b,cursor);cursor+=12
positions,uv,indices,materials=[],[],[],set()
for face in range(faces):
    ids=struct.unpack_from('<3I',b,cursor)
    materials.add(b[cursor+12:cursor+76].split(b'\0')[0].decode())
    tex=struct.unpack_from('<6f',b,cursor+76)
    for i,index in enumerate(ids):
        assert index<vertices
        positions.extend(points[index]);uv.extend([tex[i],tex[i+3]]);indices.append(index)
    cursor+=100
# HasVcp: preserve RGB for each face corner; its runtime use is unresolved.
colors=list(b[cursor:cursor+faces*9]);cursor+=faces*9
assert len(colors)==faces*9
assert len(b)-cursor==24
trailing=b[cursor:]
result={'sourceName':b[12:140].split(b'\0')[0].decode(),'sourceBounds':struct.unpack_from('<6f',b,152),'positions':positions,'uv':uv,'sourceIndices':indices,'sourceFaceRGB':colors,'sourceVertices':vertices,
    'triangles':faces,'flags':flags,'materials':sorted(materials),'centralPoint':center,
    'uninterpretedTailHex':trailing.hex(),'tailFloat32':struct.unpack('<6f',trailing),'source':source}
out=Path('.cache/lux-basic-attack');out.mkdir(exist_ok=True)
(out/'crescent.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['sourceVertices','triangles','flags','centralPoint','tailFloat32']}))
