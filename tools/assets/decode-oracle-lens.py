"""Decode frozen Oracle textures and all three SCB meshes without emitter transforms.

The radar has no face-color block. Preserve that absence, source flags, central
points, bounds and opaque tails rather than fabricating a white source block.
"""
from io import BytesIO
import json
import math
from pathlib import Path
import struct
import subprocess
from PIL import Image
from cdtb.export import TexConverter
from riot_archive import sha

layout = dict(repository='https://github.com/LeagueToolkit/LeagueToolkit',
    revision='76bf57bf4fd195343dec610bf0f912a06b910914',
    files={'StaticMesh.cs': 'eab04b1454081c56f86d93f568f804b812b8e3dbe44f99caea9efd2eff9272da',
           'StaticMeshFace.cs': '053418afb28e627ff0709975ef4d5b363e0e44508a6efba27c5243064fb45a37'})
reader_cache = Path('.cache/garen-w-particle-readers')
reader_cache.mkdir(exist_ok=True)
for name, expected in layout['files'].items():
    path = reader_cache/name
    if not path.exists():
        url = f"https://raw.githubusercontent.com/LeagueToolkit/LeagueToolkit/{layout['revision']}/src/LeagueToolkit/Core/Mesh/{name}"
        subprocess.run(['curl', '-fLsS', '--max-time', '60', url, '-o', str(path)], check=True)
    assert sha(path.read_bytes()) == expected, f'Layout reference changed: {name}'
pin_path = Path('docs/reference/oracle-lens-source.json')
pin = json.loads(pin_path.read_text())
root = Path('.cache/oracle-lens/original')
meshes, textures = [], []
for source in pin['extraction']['files']:
    raw = (root/source['path']).read_bytes()
    assert len(raw) == source['bytes'] and sha(raw) == source['sha256']
    suffix = Path(source['path']).suffix
    if suffix in ['.skn', '.skl', '.anm']: continue  # separate skinned-rig converter
    if suffix == '.tex':
        image = Image.open(BytesIO(TexConverter.tex_to_dds(raw))).convert('RGBA')
        output = Path('public/assets/effects/oracle-lens')/(Path(source['path']).stem+'.png')
        output.parent.mkdir(parents=True, exist_ok=True)
        if output.exists():
            existing = Image.open(output).convert('RGBA')
            assert existing.size == image.size and existing.tobytes() == image.tobytes(), output
        else: image.save(output)
        textures.append(dict(source=source, path=str(output), width=image.width, height=image.height,
            bytes=output.stat().st_size, sha256=sha(output.read_bytes()), rgbaSha256=sha(image.tobytes())))
        continue
    assert suffix == '.scb' and raw[:8] == b'r3d2Mesh'
    version = struct.unpack_from('<HH', raw, 8)
    assert version == (3, 2)
    vertices, faces, flags = struct.unpack_from('<III', raw, 140)
    # These three inputs have no per-vertex BGRA block. Bit 0 controls the
    # optional per-face RGB block in the referenced reader; other flags remain raw.
    assert flags in [2, 5] and struct.unpack_from('<I', raw, 176)[0] == 0
    cursor = 180
    points = [struct.unpack_from('<3f', raw, cursor+i*12) for i in range(vertices)]
    cursor += vertices*12
    pivot = struct.unpack_from('<3f', raw, cursor); cursor += 12
    positions, uv, indices, materials, face_materials = [], [], [], set(), []
    for _ in range(faces):
        face = struct.unpack_from('<3I', raw, cursor)
        material = raw[cursor+12:cursor+76].split(b'\0')[0].decode('ascii')
        materials.add(material); face_materials.append(material)
        tex = struct.unpack_from('<6f', raw, cursor+76)
        for corner, index in enumerate(face):
            assert index < vertices
            positions.extend(points[index]); uv.extend([tex[corner], tex[corner+3]]); indices.append(index)
        cursor += 100
    face_rgb = None
    if flags & 1:
        face_rgb = list(raw[cursor:cursor+faces*9]); cursor += faces*9
        assert len(face_rgb) == faces*9
    assert len(raw)-cursor == (24 if flags == 5 else 0)
    assert all(math.isfinite(v) for v in positions+uv+list(pivot))
    assert set(indices) == set(range(vertices)), 'Unreferenced source vertices require explicit handling'
    assert len(materials) == 1, 'Multiple material groups require explicit handling'
    meshes.append(dict(source=source, sourceName=raw[12:140].split(b'\0')[0].decode('ascii'),
        sourceVertices=vertices, triangles=faces, version=version, flags=flags,
        positions=positions, uv=uv, sourceFaceRGB=face_rgb, sourceIndices=indices,
        materials=sorted(materials), faceMaterials=face_materials, centralPoint=pivot,
        sourceBounds=struct.unpack_from('<6f', raw, 152),
        measuredMinMax=[min(p[i] for p in points) for i in range(3)]+
                       [max(p[i] for p in points) for i in range(3)], tailHex=raw[cursor:].hex()))
result = dict(sourcePinSha256=sha(pin_path.read_bytes()), layoutReference=layout,
    meshes=meshes, textures=textures)
Path('.cache/oracle-lens/decoded.json').write_text(json.dumps(result)+'\n')
print(json.dumps(dict(meshes=[dict(name=Path(m['source']['path']).stem, vertices=m['sourceVertices'],
    triangles=m['triangles'], faceColors=m['sourceFaceRGB'] is not None) for m in meshes],
    textures=len(textures), pngBytes=sum(t['bytes'] for t in textures))))
