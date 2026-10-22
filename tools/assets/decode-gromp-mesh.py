"""Decode the pinned legacy paper SCB, preserving every source face corner."""
import hashlib
import json
import math
import struct
import subprocess
from pathlib import Path

sha = lambda raw: hashlib.sha256(raw).hexdigest()
pin_path = Path('docs/reference/gromp-effects.json')
pin = json.loads(pin_path.read_text())
source = next(f for f in pin['extraction']['files'] if f['path'].endswith('/paper01.scb'))
raw = (Path('.cache/gromp-effects-sources') / source['path']).read_bytes()
assert sha(raw) == source['sha256'] and len(raw) == source['bytes']
layout = dict(repository='https://github.com/LeagueToolkit/LeagueToolkit',
    revision='76bf57bf4fd195343dec610bf0f912a06b910914',
    files={'StaticMesh.cs': 'eab04b1454081c56f86d93f568f804b812b8e3dbe44f99caea9efd2eff9272da',
           'StaticMeshFace.cs': '053418afb28e627ff0709975ef4d5b363e0e44508a6efba27c5243064fb45a37'})
cache = Path('.cache/garen-w-particle-readers')
cache.mkdir(exist_ok=True)
for name, expected in layout['files'].items():
    path = cache / name
    if not path.exists():
        url = f"https://raw.githubusercontent.com/LeagueToolkit/LeagueToolkit/{layout['revision']}/src/LeagueToolkit/Core/Mesh/{name}"
        subprocess.run(['curl', '-fLsS', '--max-time', '60', url, '-o', str(path)], check=True)
    assert sha(path.read_bytes()) == expected

assert raw[:8] == b'r3d2Mesh' and struct.unpack_from('<HH', raw, 8) == (3, 2)
vertices, faces, flags = struct.unpack_from('<III', raw, 140)
assert (vertices, faces, flags) == (44, 42, 1)
assert struct.unpack_from('<I', raw, 176)[0] == 0  # no per-vertex BGRA block
cursor = 180
points = [struct.unpack_from('<3f', raw, cursor + i * 12) for i in range(vertices)]
cursor += vertices * 12
pivot = struct.unpack_from('<3f', raw, cursor)
cursor += 12
positions, uv, indices, materials = [], [], [], set()
for _ in range(faces):
    face = struct.unpack_from('<3I', raw, cursor)
    material = raw[cursor + 12:cursor + 76].split(b'\0')[0].decode('ascii')
    materials.add(material)
    tex = struct.unpack_from('<6f', raw, cursor + 76)
    for corner, index in enumerate(face):
        assert index < vertices
        positions.extend(points[index])
        uv.extend([tex[corner], tex[corner + 3]])
        indices.append(index)
    cursor += 100
face_rgb = list(raw[cursor:cursor + faces * 9])
cursor += faces * 9
assert len(face_rgb) == faces * 9 and cursor == len(raw)
assert set(indices) == set(range(vertices)) and materials == {''}
assert all(math.isfinite(v) for v in positions + uv + list(pivot))
result = dict(sourcePinSha256=sha(pin_path.read_bytes()), layoutReference=layout,
    source=source, sourceName=raw[12:140].split(b'\0')[0].decode('ascii'),
    sourceVersion=[3, 2], sourceVertices=vertices, triangles=faces, flags=flags,
    positions=positions, uv=uv, sourceIndices=indices, sourceFaceRGB=face_rgb,
    centralPoint=pivot, sourceBounds=struct.unpack_from('<6f', raw, 152),
    measuredMinMax=[min(p[i] for p in points) for i in range(3)] +
                   [max(p[i] for p in points) for i in range(3)],
    materials=sorted(materials), tailHex='')
Path('.cache/gromp-effects-mesh.json').write_text(json.dumps(result) + '\n')
print(json.dumps(dict(vertices=vertices, triangles=faces, corners=len(indices), faceRgbValues=sorted(set(face_rgb)))))
