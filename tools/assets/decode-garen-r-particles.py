"""Losslessly decode frozen R SCB 3.2 flag-5 meshes and TEX images.

Meshes retain expanded face corners, RGB bytes, pivot and uninterpreted tail.
This packages source assets; it does not implement a particle runtime.
"""
from pathlib import Path
from io import BytesIO
import hashlib
import json
import math
import struct
from PIL import Image
from cdtb.export import TexConverter

sha = lambda raw: hashlib.sha256(raw).hexdigest()
pin_path = Path('docs/reference/garen-r-particles.json')
pin = json.loads(pin_path.read_text())
root = Path('.cache/garen-r-particle-sources')
meshes, textures = [], []
for source in pin['extraction']['files']:
    suffix = Path(source['path']).suffix
    raw = (root / (source['wadPathHash'] + suffix)).read_bytes()
    assert len(raw) == source['bytes'] and sha(raw) == source['sha256']
    if suffix == '.bin': continue
    if suffix == '.tex':
        image = Image.open(BytesIO(TexConverter.tex_to_dds(raw))).convert('RGBA')
        output = Path('public/assets/effects') / (Path(source['path']).stem + '.png')
        if output.exists():
            existing = Image.open(output).convert('RGBA')
            assert existing.size == image.size and existing.tobytes() == image.tobytes(), output
        else: image.save(output)
        textures.append(dict(source=source, path=str(output), width=image.width, height=image.height,
                             bytes=output.stat().st_size, sha256=sha(output.read_bytes()), rgbaSha256=sha(image.tobytes())))
        continue
    assert suffix == '.scb' and raw[:8] == b'r3d2Mesh' and struct.unpack_from('<HH', raw, 8) == (3, 2)
    vertices, faces, flags = struct.unpack_from('<III', raw, 140)
    assert flags == 5 and struct.unpack_from('<I', raw, 176)[0] == 0
    cursor = 180
    points = [struct.unpack_from('<3f', raw, cursor + i * 12) for i in range(vertices)]
    cursor += vertices * 12
    pivot = struct.unpack_from('<3f', raw, cursor); cursor += 12
    positions, uv, indices, materials, face_materials = [], [], [], set(), []
    for _ in range(faces):
        face = struct.unpack_from('<3I', raw, cursor)
        material = raw[cursor + 12:cursor + 76].split(b'\0')[0].decode('ascii')
        materials.add(material); face_materials.append(material)
        tex = struct.unpack_from('<6f', raw, cursor + 76)
        for corner, index in enumerate(face):
            assert index < vertices
            positions.extend(points[index]); uv.extend([tex[corner], tex[corner + 3]]); indices.append(index)
        cursor += 100
    face_rgb = list(raw[cursor:cursor + faces * 9]); cursor += faces * 9
    assert len(face_rgb) == faces * 9 and len(raw) - cursor == 24
    assert all(math.isfinite(v) for v in positions + uv + list(pivot))
    assert set(indices) == set(range(vertices)), 'Unreferenced vertices require explicit handling'
    assert len(materials) == 1, 'Multiple material groups require explicit handling'
    measured = [min(p[i] for p in points) for i in range(3)] + [max(p[i] for p in points) for i in range(3)]
    bounds = struct.unpack_from('<6f', raw, 152)
    # All four authored headers leave this block zero; derive actual bounds
    # from positions and preserve the raw header instead of treating it as a box.
    assert bounds == (0.0,) * 6
    meshes.append(dict(source=source, sourceName=raw[12:140].split(b'\0')[0].decode('ascii'),
        sourceVertices=vertices, triangles=faces, flags=flags, positions=positions, uv=uv,
        sourceFaceRGB=face_rgb, sourceIndices=indices, materials=sorted(materials), faceMaterials=face_materials,
        centralPoint=pivot, sourceBounds=bounds, measuredMinMax=measured, tailHex=raw[cursor:].hex()))
result = dict(sourcePinSha256=sha(pin_path.read_bytes()), meshes=meshes, textures=textures)
Path('.cache/garen-r-particles-decoded.json').write_text(json.dumps(result) + '\n')
print(json.dumps(dict(meshes=[dict(name=Path(m['source']['path']).stem, vertices=m['sourceVertices'], triangles=m['triangles']) for m in meshes], textures=len(textures), pngBytes=sum(t['bytes'] for t in textures))))
