"""Decode the three pinned SCB 3.2 target meshes without welding UV seams."""
from pathlib import Path
import hashlib
import json
import math
import struct
import subprocess

REVISION = '76bf57bf4fd195343dec610bf0f912a06b910914'
assert subprocess.check_output(['git', '-C', '.tools/league-toolkit', 'rev-parse', 'HEAD'], text=True).strip() == REVISION
pin_path = Path('docs/reference/lux-binding-target-vfx.json')
pin = json.loads(pin_path.read_text())
results = []
for source in pin['meshes']:
    raw = (Path('.cache/lux-binding-target-sources') / source['path']).read_bytes()
    assert len(raw) == source['bytes'] and hashlib.sha256(raw).hexdigest() == source['sha256']
    assert raw[:8] == b'r3d2Mesh' and struct.unpack_from('<HH', raw, 8) == (3, 2)
    vertex_count, face_count, flags = struct.unpack_from('<III', raw, 140)
    assert flags == 2 and struct.unpack_from('<I', raw, 176)[0] == 0
    cursor = 180
    vertices = [struct.unpack_from('<3f', raw, cursor + i * 12) for i in range(vertex_count)]
    cursor += vertex_count * 12
    center = struct.unpack_from('<3f', raw, cursor); cursor += 12
    positions, uv, indices, materials, face_materials = [], [], [], set(), []
    for _ in range(face_count):
        face = struct.unpack_from('<3I', raw, cursor)
        material = raw[cursor + 12:cursor + 76].split(b'\0')[0].decode('ascii')
        materials.add(material); face_materials.append(material)
        tex = struct.unpack_from('<6f', raw, cursor + 76)
        for corner, index in enumerate(face):
            assert index < vertex_count
            positions.extend(vertices[index]); uv.extend([tex[corner], tex[corner + 3]]); indices.append(index)
        cursor += 100
    assert cursor == len(raw), 'Unexpected vertex colors or unparsed trailing payload'
    assert all(math.isfinite(v) for v in positions + uv + list(center))
    assert len(set(indices)) == vertex_count, 'Unreferenced source vertices require explicit handling'
    assert len(materials) == 1, 'Multiple source material groups require explicit handling'
    measured = [min(p[i] for p in vertices) for i in range(3)] + [max(p[i] for p in vertices) for i in range(3)]
    bounds = struct.unpack_from('<6f', raw, 152)
    # These exact source files empirically store minimum plus extent, not min/max.
    expected = measured[:3] + [measured[i+3]-measured[i] for i in range(3)]
    assert all(abs(a-b) < 1e-4 for a,b in zip(bounds, expected)), (bounds, measured)
    results.append(dict(source=source, sourceName=raw[12:140].split(b'\0')[0].decode('ascii'),
        sourceVertices=vertex_count, triangles=face_count, flags=flags, sourceBounds=bounds,
        centralPoint=center, measuredMinMax=measured, positions=positions, uv=uv, sourceIndices=indices,
        materials=sorted(materials), faceMaterials=face_materials))
result = dict(sourcePinSha256=hashlib.sha256(pin_path.read_bytes()).hexdigest(),
    layoutReference=dict(repository='https://github.com/LeagueToolkit/LeagueToolkit', revision=REVISION,
        files={name:hashlib.sha256((Path('.tools/league-toolkit/src/LeagueToolkit/Core/Mesh')/name).read_bytes()).hexdigest()
               for name in ['StaticMesh.cs', 'StaticMeshFace.cs']}), meshes=results)
out=Path('.cache/lux-binding-target-meshes.json')
out.write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps([dict(name=Path(m['source']['path']).stem, vertices=m['sourceVertices'], triangles=m['triangles']) for m in results]))
