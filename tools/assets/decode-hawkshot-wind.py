"""Decode pinned Hawkshot wind SCB 3.2 and TEX sources without losing vertex alpha."""
from pathlib import Path
from io import BytesIO
import hashlib
import json
import struct
from PIL import Image
from cdtb.export import TexConverter

pin_path = Path('docs/reference/hawkshot-effects.json')
pin = json.loads(pin_path.read_text())
emitter = next(e for e in pin['records']['Characters/Ashe/Skins/Skin0/Particles/Ashe_Base_E_mis']['data']['complexEmitterDefinitionData'] if e['emitterName'] == 'WindTunnel')
source_paths = [emitter['primitive']['mMesh']['mSimpleMeshName'], emitter['texture'], emitter['alphaErosionDefinition']['erosionMapName']]
selected = []
for source_path in source_paths:
    relative = source_path.lower()
    record = next(f for f in pin['extraction']['files'] if f['path'] == relative)
    data = (Path('.cache/hawkshot-sources') / relative).read_bytes()
    assert len(data) == record['bytes'] and hashlib.sha256(data).hexdigest() == record['sha256'], relative
    selected.append((record, data))

# Layout follows the pinned LeagueToolkit StaticMesh/StaticMeshFace readers.
# This decoder deliberately accepts only the version/flags present in this source.
mesh = selected[0][1]
assert mesh[:8] == b'r3d2Mesh' and struct.unpack_from('<HH', mesh, 8) == (3, 2)
name = mesh[12:140].split(b'\0')[0].decode('utf-8')
vertex_count, face_count, flags = struct.unpack_from('<III', mesh, 140)
assert flags == 2 and struct.unpack_from('<I', mesh, 176)[0] == 1
cursor = 180
vertices = [struct.unpack_from('<3f', mesh, cursor + i * 12) for i in range(vertex_count)]
cursor += vertex_count * 12
colors = [tuple(mesh[cursor + i * 4:cursor + (i + 1) * 4]) for i in range(vertex_count)]
cursor += vertex_count * 4
pivot = struct.unpack_from('<3f', mesh, cursor)
cursor += 12
assert pivot == (0, 0, 0), 'A nonzero source pivot needs explicit interpretation'
positions, uv, rgba, source_indices, materials = [], [], [], [], set()
for face in range(face_count):
    indices = struct.unpack_from('<3I', mesh, cursor)
    material = mesh[cursor + 12:cursor + 76].split(b'\0')[0].decode('utf-8')
    face_uv = struct.unpack_from('<6f', mesh, cursor + 76)
    materials.add(material)
    for corner, index in enumerate(indices):
        assert index < vertex_count
        positions.extend(vertices[index])
        uv.extend((face_uv[corner], face_uv[corner + 3]))
        b, g, r, a = colors[index]
        rgba.extend((r, g, b, a))
        source_indices.append(index)
    cursor += 100
assert cursor == len(mesh), 'Unexpected trailing SCB payload'
assert materials == {'lambert1'}

output = Path('.cache/hawkshot-wind')
output.mkdir(parents=True, exist_ok=True)
textures = []
for label, (record, data) in zip(['color', 'erosion'], selected[1:]):
    image = Image.open(BytesIO(TexConverter.tex_to_dds(data))).convert('RGBA')
    path = output / f'{label}.png'
    image.save(path)
    decoded = image.tobytes()
    with Image.open(path) as check:
        assert check.convert('RGBA').tobytes() == decoded
    textures.append({'name': label, 'path': str(path), 'source': record['path'], 'size': list(image.size), 'rgbaSha256': hashlib.sha256(decoded).hexdigest(), 'pngSha256': hashlib.sha256(path.read_bytes()).hexdigest()})

result = {'name': name, 'positions': positions, 'uv': uv, 'rgba': rgba, 'sourceIndices': source_indices, 'sourceVertices': vertex_count, 'triangles': face_count, 'pivot': pivot, 'textures': textures, 'sources': [r for r, _ in selected], 'sourceEmitter': emitter, 'definitionsSha256': hashlib.sha256(pin_path.read_bytes()).hexdigest()}
(output / 'decoded.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'vertices': vertex_count, 'triangles': face_count, 'vertexAlphaValues': sorted({c[3] for c in colors}), 'textures': textures}))
