"""Re-extract and verify the complete pinned Illumination mark and its textures."""
import hashlib
import io
import json
from pathlib import Path
from PIL import Image
from cdtb import binfile
from cdtb.export import TexConverter
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive

pin = json.loads(Path('docs/reference/lux-illumination-vfx.json').read_text())
skin = json.loads(Path('docs/reference/lux-model.json').read_text())['skin']['data']
assert skin['Characters/Lux/Skins/Skin0/Resources']['resourceMap']['Lux_P_debuff'] == pin['record']
assert pin['sourceBin'] in [p.lower() for p in skin['__linked']]
paths = [f['path'] for f in pin['extraction']['files']]
archive = RiotArchive(
    {f'{xxh64_intdigest(p):016x}': p for p in paths + ['data/final/champions/lux.wad.subchunktoc']},
    pin['extraction'], archive_name='DATA/FINAL/Champions/Lux.wad.client')
root = Path('.cache/lux-illumination-sources')
archive.extract(paths, root)
fields, types, names, assets = {}, {}, {}, {}


def collect(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if not key.startswith('{'):
                fields[binfile.compute_binhash(key)] = key
            if key == '__type' and not child.startswith('{'):
                types[binfile.compute_binhash(child)] = child
            collect(child)
    elif isinstance(value, list):
        for child in value:
            collect(child)
    elif isinstance(value, str) and value.isascii() and not value.startswith('{'):
        names[binfile.compute_binhash(value)] = value
        assets[xxh64_intdigest(value.lower())] = value


collect(pin)
for table, mapping in [(binfile.hashfile_binfields, fields), (binfile.hashfile_bintypes, types),
                       (binfile.hashfile_binhashes, names), (binfile.hashfile_binentries, names),
                       (binfile.hashfile_binpaths, assets)]:
    table.hashes = mapping
parsed = json.loads(json.dumps(binfile.BinFile(io.BytesIO((root / pin['sourceBin']).read_bytes())).to_serializable()))
record = parsed[pin['record']]
assert record == pin['definition'], 'Pinned complete mark definition differs from source BIN'
emitters = record['complexEmitterDefinitionData']
assert [e['emitterName'] for e in emitters] == ['luxdebuff1', 'luxdebuff2', 'rays', 'smallball']
for e in emitters:
    assert not e.get('disabled', e.get('{33f36f05}', False))
    assert e['bindWeight']['constantValue'] == 1
for i, e in enumerate(emitters[:2]):
    assert e['isSingleParticle'] == 1 and e['rate']['constantValue'] == 1
    assert e['particleLifetime']['constantValue'] == 6
    assert e['birthScale0']['constantValue'] == [60, 60, 60]
    assert e['birthRotationalVelocity0']['constantValue'] == [(-10 if i == 0 else 10), 0, 0]
    assert e['pass'] == 1
assert emitters[2]['primitive']['__type'] == '{%08x}' % binfile.compute_binhash('VfxPrimitiveRay')
filter_key = '{%08x}' % binfile.compute_binhash('Filtering')
excluded_key = '{%08x}' % binfile.compute_binhash('keywordsExcluded')
assert emitters[3][filter_key] == {
    excluded_key: ['SteelLegionLux'],
    '__type': '{%08x}' % binfile.compute_binhash('VfxEmitterFiltering')}

used_textures = set()


def find_textures(value):
    if isinstance(value, dict):
        for child in value.values(): find_textures(child)
    elif isinstance(value, list):
        for child in value: find_textures(child)
    elif isinstance(value, str) and value.lower().endswith('.tex'):
        used_textures.add(value.lower())


find_textures(record)
assert used_textures == {t['path'] for t in pin['textures']}
for texture in pin['textures']:
    decoded = Image.open(io.BytesIO(TexConverter.tex_to_dds((root / texture['path']).read_bytes()))).convert('RGBA')
    assert list(decoded.size) == [texture['width'], texture['height']]
    assert hashlib.sha256(decoded.tobytes()).hexdigest() == texture['rgbaSHA256']
    # The rainbow multiplier is shared with Final Spark; avoid a duplicate asset.
    output = Path(texture['output'])
    if output.name == 'lux-r-4.png':
        assert Image.open(output).convert('RGBA').tobytes() == decoded.tobytes()
    else:
        decoded.save(output)
        assert Image.open(output).convert('RGBA').tobytes() == decoded.tobytes()
print('Verified complete four-emitter mark, six pinned source files, five exact RGBA textures (one shared).')

# Playback inputs retain birth distributions separately from lifetime curves.
def vector(value):
    return value if isinstance(value, list) else [value]


def birth(value, fallback):
    dynamics = value.get('dynamics')
    if dynamics:
        assert dynamics['times'] == [0] and len(dynamics['values']) == 1
    base = vector(dynamics['values'][0] if dynamics else value.get('constantValue', fallback))
    tables = dynamics.get('probabilityTables') if dynamics else None
    return {'value': base, 'probabilities': [
        {'single': table.get('singleValue', 1), 'times': table.get('keyTimes', []), 'values': table.get('keyValues', [])}
        for table in tables] if tables is not None else None}


def curve(value, fallback):
    dynamics = value.get('dynamics')
    if dynamics:
        assert not dynamics.get('probabilityTables')
        return {'times': dynamics['times'], 'values': dynamics['values']}
    base = vector(value.get('constantValue', fallback))
    return {'times': [0, 1], 'values': [base, base]}


lookup = {t['path']: t['output'].removeprefix('public/') for t in pin['textures']}
profiles = []
for index, emitter in enumerate(emitters):
    mult = emitter.get('textureMult', {})
    profiles.append({
        'name': emitter['emitterName'], 'index': index,
        'primitive': 'ray' if 'primitive' in emitter else 'cameraQuad',
        'rate': emitter['rate']['constantValue'],
        'single': bool(emitter.get('isSingleParticle', False)),
        'emitterLife': emitter['lifetime'],
        'emitterLinger': emitter.get('{3bc59eb6}'),
        'life': birth(emitter['particleLifetime'], 3),
        'size': birth(emitter['birthScale0'], [1, 1, 1]),
        'uniform': bool(emitter.get('isUniformScale', False)),
        'rotation': birth(emitter.get('birthRotation0', {}), [0, 0, 0]),
        'spin': birth(emitter.get('birthRotationalVelocity0', {}), [0, 0, 0]),
        'scale': curve(emitter.get('scale0', {}), [1, 1, 1]),
        'birthColor': birth(emitter.get('birthColor', {}), [1, 1, 1, 1]),
        'color': curve(emitter.get('Color', {}), [1, 1, 1, 1]),
        'multBirth': birth(mult.get('{740ca9c0}', {}), [0, 0]),
        'multScroll': mult.get('birthUvScrollRateMult', {}).get('constantValue', [0, 0]),
        'multScale': mult.get('{cd124686}', {}).get('constantValue', [1, 1]),
        'pass': emitter.get('pass', 0), 'blend': emitter.get('blendMode', 0),
        'miscRenderFlags': emitter.get('{6563bee8}', 0),
        'texture': lookup[emitter['texture'].lower()],
        'lookup': lookup[emitter['particleColorTexture'].lower()] if 'particleColorTexture' in emitter else None,
        'mult': lookup[mult['textureMult'].lower()] if mult else None,
        'excludedKeywords': emitter.get(filter_key, {}).get(excluded_key, []),
    })
Path('src/content/lux-illumination-vfx.ts').write_text(
    '// Generated by tools/assets/export-lux-illumination-vfx.py.\nexport const LUX_ILLUMINATION_VFX = ' +
    json.dumps(profiles, indent=2) + ' as const;\n')
