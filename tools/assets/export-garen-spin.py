"""Losslessly decode the pinned Judgment SCB/TEX assets and four emitter profiles."""
from pathlib import Path
from io import BytesIO
import hashlib
import json
import struct
from PIL import Image
from cdtb.export import TexConverter

sha = lambda b: hashlib.sha256(b).hexdigest()
model_path = Path('docs/reference/garen-model.json')
model = json.loads(model_path.read_text())
pin = json.loads(Path('docs/reference/garen-spin-extraction.json').read_text())
record = 'Characters/Garen/Skins/Skin0/Particles/Garen_Base_E_Spin'
emitters = model['skin']['data'][record]['complexEmitterDefinitionData']
textures = {}
for source in pin['files']:
    raw = (Path('.cache/garen-spin-sources') / source['path']).read_bytes()
    assert len(raw) == source['bytes'] and sha(raw) == source['sha256']
    if source['path'].endswith('.scb'):
        mesh, mesh_source = raw, source
        continue
    image = Image.open(BytesIO(TexConverter.tex_to_dds(raw))).convert('RGBA')
    output = Path('public/assets/effects') / (Path(source['path']).stem + '.png')
    image.save(output)
    assert Image.open(output).convert('RGBA').tobytes() == image.tobytes()
    textures[source['path']] = dict(path=str(output), bytes=output.stat().st_size,
        sha256=sha(output.read_bytes()), size=list(image.size), rgbaSha256=sha(image.tobytes()), source=source)

assert mesh[:8] == b'r3d2Mesh' and struct.unpack_from('<HH', mesh, 8) == (3, 2)
vertices, faces, flags = struct.unpack_from('<III', mesh, 140)
assert (vertices, faces, flags) == (612, 1224, 5)
assert struct.unpack_from('<I', mesh, 176)[0] == 0
cursor = 180
points = [struct.unpack_from('<3f', mesh, cursor + i * 12) for i in range(vertices)]
cursor += vertices * 12
pivot = struct.unpack_from('<3f', mesh, cursor); cursor += 12
positions, uv, materials = [], [], set()
for face in range(faces):
    indices = struct.unpack_from('<3I', mesh, cursor)
    materials.add(mesh[cursor + 12:cursor + 76].split(b'\0')[0].decode())
    tex = struct.unpack_from('<6f', mesh, cursor + 76)
    for corner, index in enumerate(indices):
        assert index < vertices
        positions.extend(points[index]); uv.extend([tex[corner], tex[corner + 3]])
    cursor += 100
face_rgb = list(mesh[cursor:cursor + faces * 9]); cursor += faces * 9
assert len(face_rgb) == faces * 9 and len(mesh) - cursor == 24
decoded = dict(positions=positions, uv=uv, sourceFaceRGB=face_rgb, pivot=pivot,
    bounds=struct.unpack_from('<6f', mesh, 152), materials=sorted(materials),
    tailHex=mesh[cursor:].hex(), source=mesh_source, vertices=vertices, triangles=faces, flags=flags)
cache = Path('.cache/garen-spin'); cache.mkdir(exist_ok=True)
(cache / 'mesh.json').write_text(json.dumps(decoded) + '\n')

def birth(value, default):
    dynamics = value.get('dynamics')
    result = dict(value=dynamics['values'][0] if dynamics else value.get('constantValue', default), probabilities=None)
    if dynamics:
        assert dynamics['times'] == [0.0]
        result['probabilities'] = [dict(times=t.get('keyTimes', []), values=t.get('keyValues', []), single=t.get('singleValue', 1))
            for t in dynamics.get('probabilityTables', [])]
    return result
profiles = []
for index, e in enumerate(emitters[:4]):
    assert e['bindWeight']['constantValue'] == 1 and e['blendMode'] in [1, 4]
    assert e.get('uvMode', 0) in [0, 2] and not any(k in e for k in ['texDiv', 'frameRate', 'particleColorTexture'])
    assert e['primitive']['__type'] == ('VfxPrimitiveMesh' if index < 2 else 'VfxPrimitiveArbitraryQuad')
    life = birth(e['particleLifetime'], 0)
    profiles.append(dict(index=index, name=e['emitterName'], kind='mesh' if index < 2 else 'quad',
        rate=e['rate']['constantValue'], delay=e.get('timeBeforeFirstEmission', 0),
        life=life, linger=e['particleLinger'], offset=e.get('EmitterPosition', {}).get('constantValue', e.get('SpawnShape', {}).get('emitOffset')),
        velocity=birth(e.get('birthVelocity', {}), [0, 0, 0]), rotation=birth(e['birthRotation0'], [0, 0, 0]),
        rotationalVelocity=birth(e['birthRotationalVelocity0'], [0, 0, 0]), birthScale=e['birthScale0']['constantValue'],
        scale=e.get('scale0', {'constantValue': [1, 1, 1]}), color=e['Color']['dynamics'],
        scroll=birth(e.get('birthUvScrollRate', {}), [0, 0]), blend=e['blendMode'], renderOrder=e['pass'],
        texture=textures[e['texture'].lower()]['path'].removeprefix('public/')))
profile_path = Path('src/content/garen-spin.json')
profile_path.write_text(json.dumps(profiles, indent=2) + '\n')
audit = dict(modelPinSha256=sha(model_path.read_bytes()), record=record, sourceEmitters=emitters,
    implementedIndices=[0, 1, 2, 3], deferredIndices=[4, 5],
    profile=dict(path=str(profile_path), sha256=sha(profile_path.read_bytes())),
    textures=list(textures.values()), mesh={k: v for k, v in decoded.items() if k not in ['positions', 'uv', 'sourceFaceRGB']},
    note='Exact source packaging; runtime adapter and native composition parity remain separate.')
audit_path = Path('docs/reference/garen-spin.json')
if audit_path.exists(): assert json.loads(audit_path.read_text()) == json.loads(json.dumps(audit)), 'Judgment export changed'
else: audit_path.write_text(json.dumps(audit, indent=2) + '\n')
print(json.dumps(dict(mesh=mesh_source, textures=len(textures), profiles=len(profiles), pivot=pivot)))
