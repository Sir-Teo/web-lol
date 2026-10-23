"""Decode the pinned SCB 3.2 flag-2 E perimeter, retaining face UVs exactly."""
import hashlib
import json
import math
import struct
from pathlib import Path
pin = json.loads(Path('docs/reference/lux-e-vfx.json').read_text())
p = 'assets/characters/lux/skins/base/particles/lux_base_e_indicator.scb'
s = next(f for f in pin['extraction']['files'] if f['path'] == p)
r = (Path('.cache/lux-e-vfx-sources') / p).read_bytes()
assert len(r) == s['bytes'] and hashlib.sha256(r).hexdigest() == s['sha256']
assert r[:8] == b'r3d2Mesh' and struct.unpack_from('<HH', r, 8) == (3, 2)
vertices, faces, flags = struct.unpack_from('<III', r, 140)
assert flags == 2 and struct.unpack_from('<I', r, 176)[0] == 0
points = [struct.unpack_from('<3f', r, 180+i*12) for i in range(vertices)]
assert all(v[1] == 0 for v in points)
cursor = 180 + vertices*12
pivot = struct.unpack_from('<3f', r, cursor); cursor += 12
positions, uv, materials, used = [], [], set(), set()
for _ in range(faces):
    face = struct.unpack_from('<3I', r, cursor)
    tex = struct.unpack_from('<6f', r, cursor+76)
    materials.add(r[cursor+12:cursor+76].split(b'\0')[0].decode('ascii'))
    for corner, index in enumerate(face):
        assert index < vertices
        used.add(index); positions.extend(points[index]); uv.extend([tex[corner],tex[corner+3]])
    cursor += 100
assert cursor == len(r) and len(materials) == 1 and len(used) == vertices
assert all(math.isfinite(v) for v in positions+uv)
result = dict(source=s, vertices=vertices, triangles=faces, flags=flags, pivot=pivot,
              headerBounds=struct.unpack_from('<6f', r, 152), materials=sorted(materials), positions=positions, uv=uv)
Path('.cache/lux-e-indicator-decoded.json').write_text(json.dumps(result)+'\n')
print(json.dumps(dict(vertices=vertices, triangles=faces, flags=flags)))
