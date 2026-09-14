"""Verify the complete pinned Illumination detonation and its shared texture payloads."""
import hashlib
import io
import json
from pathlib import Path
from PIL import Image
from cdtb import binfile
from cdtb.export import TexConverter
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive

pin = json.loads(Path('docs/reference/lux-illumination-trigger-vfx.json').read_text())
skin = json.loads(Path('docs/reference/lux-model.json').read_text())['skin']['data']
assert skin['Characters/Lux/Skins/Skin0/Resources']['resourceMap']['Lux_P_tar'] == pin['record']
assert pin['sourceBin'] in [p.lower() for p in skin['__linked']]
paths = [f['path'] for f in pin['extraction']['files']]
archive = RiotArchive(
    {f'{xxh64_intdigest(p):016x}': p for p in paths + ['data/final/champions/lux.wad.subchunktoc']},
    pin['extraction'], archive_name='DATA/FINAL/Champions/Lux.wad.client')
root = Path('.cache/lux-illumination-trigger-sources')
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
assert record == pin['definition'], 'Pinned complete trigger definition differs from source BIN'
emitters = record['complexEmitterDefinitionData']
assert [e['emitterName'] for e in emitters] == ['innerring', 'outerring', 'sparks', 'motes', 'rays']
assert all(not e.get('disabled', e.get('{33f36f05}', False)) for e in emitters)
assert [e['rate']['constantValue'] for e in emitters] == [1, 1, 20, 100, 60]
assert [bool(e.get('isSingleParticle', False)) for e in emitters] == [False, False, True, False, False]
assert emitters[2]['bindWeight']['dynamics']['values'] == [0.5, 0]
assert emitters[3]['worldAcceleration']['__type'] == 'IntegratedValueVector3'
assert emitters[4]['primitive']['__type'] == 'VfxPrimitiveRay'
assert emitters[4]['isLocalOrientation'] == 0 and emitters[4]['bindWeight']['constantValue'] == 1
for emitter, row, mixer in [(emitters[2], 9, [0, 1, 0, 0]), (emitters[3], 6, [1, 0, 0, 0])]:
    palette = emitter['paletteDefinition']
    assert palette['paletteCount'] == 10
    assert palette['paletteSelector']['constantValue'] == [row, 0, 0]
    assert palette['palleteSrcMixColor']['constantValue'] == mixer
assert record['soundOnCreateDefault'] == 'Play_sfx_Lux_LuxIlluminationPassive_hit'

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
assert {f['path'] for f in pin['extraction']['files']} == used_textures | {pin['sourceBin']}
for texture in pin['textures']:
    decoded = Image.open(io.BytesIO(TexConverter.tex_to_dds((root / texture['path']).read_bytes()))).convert('RGBA')
    assert list(decoded.size) == [texture['width'], texture['height']]
    assert hashlib.sha256(decoded.tobytes()).hexdigest() == texture['rgbaSHA256']
    # These exact images are already shipped for basic impacts/the persistent mark.
    # Verify shared outputs rather than overwriting or duplicating them.
    output = Path(texture['output'])
    existing = Image.open(output).convert('RGBA')
    assert existing.size == decoded.size and existing.tobytes() == decoded.tobytes()
    assert hashlib.sha256(output.read_bytes()).hexdigest() == texture['pngSHA256']
print('Verified five active trigger emitters, eight pinned source files, seven exact shared RGBA textures.')
