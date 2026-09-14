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
