"""Pin Lux E's six base resources directly from the frozen Riot archive.

Field names come from already committed source records. Unknown hashes stay
explicit; no CommunityDragon naming cache is required. PNGs are lossless decodes.
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
        for child in value.values():
            yield from strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from strings(child)
    elif isinstance(value, str):
        yield value


pin_path = Path('docs/reference/lux-e-vfx.json')
pin = json.loads(pin_path.read_text()) if pin_path.exists() else None
skin = json.loads(Path('docs/reference/lux-model.json').read_text())['skin']['data']
resources = skin['Characters/Lux/Skins/Skin0/Resources']['resourceMap']
keys = ['Lux_E_mis', 'Lux_E_tar_aoe_green', 'Lux_E_tar_aoe_red',
        'Lux_E_tar_aoe_sound', 'Lux_E_tar_hit', 'Lux_E_tar_nova']
records = {key: resources[key] for key in keys}
root = Path('.cache/lux-e-vfx-sources')
fields, types, names, asset_names = {}, {}, {}, {}


def collect(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if not key.startswith('{'):
                fields[binfile.compute_binhash(key)] = key
            if key == '__type' and isinstance(child, str) and not child.startswith('{'):
                types[binfile.compute_binhash(child)] = child
            collect(child)
    elif isinstance(value, list):
        for child in value:
            collect(child)
    elif isinstance(value, str) and value.isascii() and not value.startswith('{'):
        names[binfile.compute_binhash(value)] = value
        asset_names[xxh64_intdigest(value.lower())] = value


# Full retained definitions provide names only; source bytes remain authoritative.
for p in sorted(Path('docs/reference').glob('*.json')):
    collect(json.loads(p.read_text()))
collect(records)
for table, mapping in [(binfile.hashfile_binfields, fields), (binfile.hashfile_bintypes, types),
                       (binfile.hashfile_binhashes, names), (binfile.hashfile_binentries, names),
                       (binfile.hashfile_binpaths, asset_names)]:
    table.hashes = mapping
linked = [p.lower() for p in skin['__linked'] if '/lux_multi_' in p.lower()]
toc = 'data/final/champions/lux.wad.subchunktoc'
if pin:
    sources = pin['sourceBins']
else:
    discovery = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in [*linked, toc]},
                            archive_name='DATA/FINAL/Champions/Lux.wad.client')
    discovery.extract(linked, root, flat=True)
    sources = {}
    for path in linked:
        raw = (root / f'{xxh64_intdigest(path):016x}.bin').read_bytes()
        parsed = json.loads(json.dumps(binfile.BinFile(io.BytesIO(raw)).to_serializable()))
        for key, name in records.items():
            if name in parsed:
                assert key not in sources, key
                sources[key] = path
    assert set(sources) == set(keys), sources
    (root / 'discovery.json').write_text(json.dumps(dict(sourceBins=sources,
        extraction=discovery.provenance()), indent=2) + '\n')
    print(json.dumps(dict(sourceBins=sources)), flush=True)
assert set(sources) == set(keys) and set(sources.values()) <= set(linked)
paths = sorted(set(sources.values()))
if pin:
    paths += [f['path'] for f in pin['extraction']['files']]
archive = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in [*paths, toc]},
                     pin['extraction'] if pin else None,
                     archive_name='DATA/FINAL/Champions/Lux.wad.client')
archive.extract(sorted(set(sources.values())), root, flat=True)
definitions = {}
for key, path in sources.items():
    raw = (root / f'{xxh64_intdigest(path):016x}.bin').read_bytes()
    parsed = json.loads(json.dumps(binfile.BinFile(io.BytesIO(raw)).to_serializable()))
    definitions[key] = parsed[records[key]]
assets = sorted({s.lower() for s in strings(definitions) if s.lower().startswith('assets/')})
assert all(p.endswith(('.tex', '.scb')) for p in assets), assets
archive.wad.resolve_paths({xxh64_intdigest(p): p for p in assets})
archive.entries = {e.path: e for e in archive.wad.files if e.path}
archive.extract(assets, root)
shared = {}
for p in sorted(Path('docs/reference').glob('lux-*.json')):
    if p == pin_path:
        continue
    data = json.loads(p.read_text())
    for t in data.get('textures', []) if isinstance(data, dict) else []:
        if isinstance(t, dict) and 'path' in t and 'output' in t:
            shared.setdefault(t['path'].lower(), t['output'])
textures = []
for path in assets:
    if not path.endswith('.tex'):
        continue
    decoded = Image.open(io.BytesIO(TexConverter.tex_to_dds((root / path).read_bytes()))).convert('RGBA')
    output = Path(shared.get(path, f'public/assets/effects/lux-e-{Path(path).stem}.png'))
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
meshes = [dict(path=p, bytes=len((root / p).read_bytes()), sha256=sha((root / p).read_bytes()))
          for p in assets if p.endswith('.scb')]
result = dict(resources=records, sourceBins=sources, definitions=definitions,
              textures=textures, meshes=meshes, extraction=archive.provenance())
if pin:
    assert result == pin, 'Pinned E definitions, assets or provenance changed'
else:
    pin_path.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(dict(records=len(definitions), textures=len(textures), meshes=len(meshes),
                     emitters={k: len(v.get('complexEmitterDefinitionData', [])) for k, v in definitions.items()})))
