"""Losslessly decode the pinned Judgment SCB/TEX assets and all six emitter profiles."""
from pathlib import Path
from io import BytesIO
import hashlib
import json
import struct
import argparse
from PIL import Image
from cdtb.export import TexConverter

sha = lambda b: hashlib.sha256(b).hexdigest()
parser = argparse.ArgumentParser()
parser.add_argument('--update-audit', action='store_true', help='Regenerate the derived profile audit after an intentional exporter change')
args = parser.parse_args()
defaults_path = Path('docs/reference/garen-spin-defaults.json')
defaults = json.loads(defaults_path.read_text())['defaults']
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
for index, e in enumerate(emitters):
    assert e['bindWeight']['constantValue'] == 1 and e['blendMode'] in [1, 4]
    assert e.get('uvMode', 0) in [0, 2] and not any(k in e for k in ['texDiv', 'frameRate', 'colorLookUpTypeX', 'colorLookUpTypeY', 'colorLookUpScales', 'colorLookUpOffsets'])
    assert e['primitive']['__type'] == ('VfxPrimitiveMesh' if index < 2 else 'VfxPrimitiveArbitraryQuad')
    life = birth(e['particleLifetime'], 0)
    profiles.append(dict(index=index, name=e['emitterName'], kind='mesh' if index < 2 else 'quad',
        rate=e['rate']['constantValue'], delay=e.get('timeBeforeFirstEmission', 0), emitterLifetime=e.get('lifetime'),
        life=life, linger=e['particleLinger'], offset=e.get('EmitterPosition', {}).get('constantValue', e.get('SpawnShape', {}).get('emitOffset')),
        velocity=birth(e.get('birthVelocity', {}), [0, 0, 0]), rotation=birth(e['birthRotation0'], [0, 0, 0]),
        rotationalVelocity=birth(e.get('birthRotationalVelocity0', {}), [0, 0, 0]), birthScale=e.get('birthScale0', {}).get('constantValue', defaults['birthScale']),
        uniformScale=bool(e.get('isUniformScale', False)),
        scale=e.get('scale0', {'constantValue': defaults['scale']}),
        color=e.get('Color', {}).get('dynamics', {'times': [0.0], 'values': [e.get('Color', {}).get('constantValue', defaults['color'])]}),
        colorLookup=dict(texture=textures[e['particleColorTexture'].lower()]['path'].removeprefix('public/') if e.get('particleColorTexture') else None,
            lookupTypes=defaults['lookupTypes'], lookupScales=defaults['lookupScales'], lookupOffsets=defaults['lookupOffsets']),
        scroll=birth(e.get('birthUvScrollRate', {}), [0, 0]), blend=e['blendMode'], renderOrder=e['pass'],
        texture=textures[e['texture'].lower()]['path'].removeprefix('public/')))
profile_path = Path('src/content/garen-spin.json')
profile_path.write_text(json.dumps(profiles, indent=2) + '\n')
base = Image.open('public/assets/effects/garen_base_w_ground_glow.png').convert('RGBA')
lookup = Image.open('public/assets/effects/garen_color-rampdown.png').convert('RGBA')
samples = []
for x in [0, 8, 32, 63]:
    point, shifted, at = [32, 128], [128, 128], [x, 32]
    samples.append(dict(sourcePixel=point, sourceRgba=base.getpixel(tuple(point)),
        shiftedSourcePixel=shifted, shiftedSourceRgba=base.getpixel(tuple(shifted)),
        lookupPixel=at, lookupRgba=lookup.getpixel(tuple(at))))
audit = dict(modelPinSha256=sha(model_path.read_bytes()), record=record, sourceEmitters=emitters,
    implementedIndices=list(range(6)), deferredIndices=[], defaultsEvidenceSha256=sha(defaults_path.read_bytes()),
    profile=dict(path=str(profile_path), sha256=sha(profile_path.read_bytes())),
    textures=list(textures.values()), lookupIdenticalRows=len({lookup.crop((0, y, lookup.width, y+1)).tobytes() for y in range(lookup.height)}) == 1,
    gpuSamples=samples, mesh={k: v for k, v in decoded.items() if k not in ['positions', 'uv', 'sourceFaceRGB']},
    note='Exact source packaging; runtime adapter and native composition parity remain separate.')
audit_path = Path('docs/reference/garen-spin.json')
if audit_path.exists() and not args.update_audit: assert json.loads(audit_path.read_text()) == json.loads(json.dumps(audit)), 'Judgment export changed'
else: audit_path.write_text(json.dumps(audit, indent=2) + '\n')
print(json.dumps(dict(mesh=mesh_source, textures=len(textures), profiles=len(profiles), pivot=pivot)))
