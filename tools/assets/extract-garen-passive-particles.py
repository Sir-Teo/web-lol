"""Pin the three base recovery/boost resources from frozen Garen BIN bytes.

Initial labels come from discover-garen-particle-bins.py --ability p. Every selected definition
is re-decoded from frozen Riot BIN bytes; subsequent runs use only this pin.
Long virtual BIN paths use hash-named cache files without changing provenance.
"""
from pathlib import Path
import io
import json
from cdtb import binfile
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive

pin_path = Path('docs/reference/garen-passive-particles.json')
pin = json.loads(pin_path.read_text()) if pin_path.exists() else None
model_path = Path('docs/reference/garen-model.json')
model = json.loads(model_path.read_text())
skin = model['skin']['data']
resources = skin['Characters/Garen/Skins/Skin0/Resources']['resourceMap']
selected = dict((pin or json.loads(Path('.cache/garen-particle-bins/discovered-p.json').read_text()))['resources'])
assert set(selected) == {'Garen_P_Heal', 'Garen_P_Boost', 'Garen_Heal'}
fields, types, names, assets = {}, {}, {}, {}
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
        assets[xxh64_intdigest(value.lower())] = value
collect(selected)
for table, mapping in [(binfile.hashfile_binfields, fields), (binfile.hashfile_bintypes, types),
                       (binfile.hashfile_binhashes, names), (binfile.hashfile_binentries, names),
                       (binfile.hashfile_binpaths, assets)]:
    table.hashes = mapping

def strings(value):
    if isinstance(value, dict):
        for child in value.values(): yield from strings(child)
    elif isinstance(value, list):
        for child in value: yield from strings(child)
    elif isinstance(value, str): yield value
asset_paths = sorted({s.lower() for r in selected.values() for s in strings(r['definition']) if s.lower().startswith('assets/')})
assert all(p.endswith(('.tex', '.scb')) for p in asset_paths)
bins = sorted({r['sourceBin'] for r in selected.values()})
assert set(bins).issubset({p.lower() for p in skin['__linked']} | {'data/characters/garen/skins/skin0.bin'})
paths = [*bins, *asset_paths]
archive = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in [*paths, 'data/final/champions/garen.wad.subchunktoc']},
                      pin['extraction'] if pin else None, archive_name='DATA/FINAL/Champions/Garen.wad.client')
root = Path('.cache/garen-passive-particle-sources')
assert set(paths).issubset(archive.entries), f'Missing dependencies: {set(paths)-set(archive.entries)}'
archive.extract(paths, root, flat=True)
parsed = {p: json.loads(json.dumps(binfile.BinFile(io.BytesIO((root / f'{xxh64_intdigest(p):016x}.bin').read_bytes())).to_serializable())) for p in bins}
for key, r in selected.items():
    assert resources[key] == r['record']
    assert parsed[r['sourceBin']][r['record']] == r['definition'], f'Source definition differs: {key}'
result = dict(resources=selected, extraction=archive.provenance())
if pin: assert result == pin, 'Pinned passive particle source provenance changed'
else: pin_path.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(dict(resources={k: len(r['definition'].get('complexEmitterDefinitionData', [])) for k,r in selected.items()}, bins=len(bins), textures=sum(p.endswith('.tex') for p in paths), meshes=sum(p.endswith('.scb') for p in paths))))
