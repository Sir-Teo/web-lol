"""Pin and verify the complete Lux Q target VFX, textures and source meshes.

Initial naming seed is cached CDragon JSON; the frozen Riot BIN is authoritative.
Subsequent runs require only the committed pin and verified source archive.
"""
from pathlib import Path
import hashlib
import io
import json
from PIL import Image
from cdtb import binfile
from cdtb.export import TexConverter
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def strings(value):
    if isinstance(value, dict):
        for child in value.values(): yield from strings(child)
    elif isinstance(value, list):
        for child in value: yield from strings(child)
    elif isinstance(value, str): yield value


pin_path = Path('docs/reference/lux-binding-target-vfx.json')
record_name = 'Characters/Lux/Skins/Skin0/Particles/Lux_Base_Q_tar'
base = json.loads(Path('docs/reference/lux-illumination-trigger-vfx.json').read_text())
pin = json.loads(pin_path.read_text()) if pin_path.exists() else None
source_bin = base['sourceBin']
definition = pin['definition'] if pin else json.loads(
    Path('.cache/lux-particle-bins/c5e910e79fc69b35.json').read_text())[record_name]
skin = json.loads(Path('docs/reference/lux-model.json').read_text())['skin']['data']
assert skin['Characters/Lux/Skins/Skin0/Resources']['resourceMap']['Lux_Q_tar'] == record_name
assert source_bin in [p.lower() for p in skin['__linked']]
assets = sorted({s.lower() for s in strings(definition) if s.lower().startswith('assets/')})
assert all(p.endswith(('.tex', '.scb')) for p in assets)
paths = [source_bin, *assets]
archive = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in paths + ['data/final/champions/lux.wad.subchunktoc']},
                     pin['extraction'] if pin else None, archive_name='DATA/FINAL/Champions/Lux.wad.client')
root = Path('.cache/lux-binding-target-sources')
archive.extract(paths, root)
# Cross-check the already pinned shared BIN before interpreting the new record.
expected_bin = next(f for f in base['extraction']['files'] if f['path'] == source_bin)
raw = (root / source_bin).read_bytes()
assert len(raw) == expected_bin['bytes'] and sha(raw) == expected_bin['sha256']
fields, types, names, asset_names = {}, {}, {}, {}


def collect(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if not key.startswith('{'): fields[binfile.compute_binhash(key)] = key
            if key == '__type' and not child.startswith('{'): types[binfile.compute_binhash(child)] = child
            collect(child)
    elif isinstance(value, list):
        for child in value: collect(child)
    elif isinstance(value, str) and value.isascii() and not value.startswith('{'):
        names[binfile.compute_binhash(value)] = value
        asset_names[xxh64_intdigest(value.lower())] = value


collect(definition)
collect(record_name)
for table, mapping in [(binfile.hashfile_binfields, fields), (binfile.hashfile_bintypes, types),
                       (binfile.hashfile_binhashes, names), (binfile.hashfile_binentries, names),
                       (binfile.hashfile_binpaths, asset_names)]:
    table.hashes = mapping
parsed = json.loads(json.dumps(binfile.BinFile(io.BytesIO(raw)).to_serializable()))
assert parsed[record_name] == definition, 'Cached naming seed differs from frozen source BIN'
assert len(definition['complexEmitterDefinitionData']) == 11

# Reuse already verified texture outputs by source path. New textures remain lossless.
shared = {}
for path in sorted(Path('docs/reference').glob('lux-*.json')):
    if path == pin_path: continue
    data = json.loads(path.read_text())
    for texture in data.get('textures', []) if isinstance(data, dict) else []:
        if isinstance(texture, dict) and 'path' in texture and 'output' in texture:
            shared.setdefault(texture['path'].lower(), texture['output'])
textures = []
for path in assets:
    if not path.endswith('.tex'): continue
    decoded = Image.open(io.BytesIO(TexConverter.tex_to_dds((root / path).read_bytes()))).convert('RGBA')
    output = Path(shared.get(path, f'public/assets/effects/lux-binding-target-{Path(path).stem}.png'))
    if pin:
        output = Path(next(t['output'] for t in pin['textures'] if t['path'] == path))
    if output.exists():
        existing = Image.open(output).convert('RGBA')
        assert existing.size == decoded.size and existing.tobytes() == decoded.tobytes(), output
    else:
        output.parent.mkdir(parents=True, exist_ok=True)
        decoded.save(output)
    textures.append(dict(path=path, output=str(output), width=decoded.width, height=decoded.height,
                         rgbaSHA256=sha(decoded.tobytes()), pngSHA256=sha(output.read_bytes())))
meshes = [dict(path=p, bytes=len((root/p).read_bytes()), sha256=sha((root/p).read_bytes()))
          for p in assets if p.endswith('.scb')]
result = dict(record=record_name, sourceBin=source_bin, definition=definition, textures=textures,
              meshes=meshes, extraction=archive.provenance())
if pin: assert result == pin, 'Pinned target VFX or source provenance changed'
else: pin_path.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(dict(emitters=11, textures=len(textures), meshes=len(meshes), sourceFiles=len(paths))))
