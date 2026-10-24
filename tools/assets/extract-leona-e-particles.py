"""Pin every standard-game Zenith Blade system and its linked dependencies.

Initial labels come from the retained Leona skin-linked BIN discovery. Every selected definition
is re-decoded from frozen Riot BIN bytes; subsequent runs use only this pin.
Long virtual BIN paths use hash-named cache files without changing provenance.
"""
from pathlib import Path
import io
import json
from cdtb import binfile
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive

pin_path = Path('docs/reference/leona-e-particles.json')
pin = json.loads(pin_path.read_text()) if pin_path.exists() else None
model_path = Path('docs/reference/leona-model.json')
model = json.loads(model_path.read_text())
skin = model['skin']['data']
resources = skin['Characters/Leona/Skins/Skin0/Resources']['resourceMap']
selected = {k:v for k,v in (pin or json.loads(Path('.cache/leona-particle-research-20261023/discovered.json').read_text()))['resources'].items() if k.startswith('Leona_E_')}
assert set(selected) == {k for k in resources if k.startswith('Leona_E_')}
assert set(selected) == {'Leona_E_cas_arrive', 'Leona_E_mis_dash', 'Leona_E_mis_weapon', 'Leona_E_tar', 'Leona_E_ZB_sfx_01'}
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
# The raw field is a BinType.PATH, not an ordinary name hash. Retain its raw
# spelling in the definitions and resolve the dependency independently.
path_resolutions = [dict(system='Leona_E_mis_dash', field='materialOverrideDefinitions[0].baseTexture',
    raw='{97d68dc062eb5dfa}', path='assets/characters/leona/skins/base/particles/leona_base_z_empty32.tex',
    wadPathHash='97d68dc062eb5dfa', binType='PATH (18)',
    method='Retained hash-dictionary candidate; exact lowercase UTF-8 XXH64 and native field identity rechecked')]
for resolution in path_resolutions:
    assert f"{xxh64_intdigest(resolution['path']):016x}" == resolution['wadPathHash']
asset_paths = sorted({s.lower() for r in selected.values() for s in strings(r['definition']) if s.lower().startswith('assets/')} |
                     {r['path'] for r in path_resolutions})
assert all(p.endswith(('.tex', '.scb')) for p in asset_paths)
bins = sorted({r['sourceBin'] for r in selected.values()})
# Some standard W definitions live directly in the skin root, not a linked BIN.
assert model['skin']['url'].endswith('/game/data/characters/leona/skins/skin0.bin.json')
assert set(bins).issubset({p.lower() for p in skin['__linked']} | {'data/characters/leona/skins/skin0.bin'})
paths = [*bins, *asset_paths]
archive = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in [*paths, 'data/final/champions/leona.wad.subchunktoc']},
                      pin['extraction'] if pin else None, archive_name='DATA/FINAL/Champions/Leona.wad.client')
root = Path('.cache/leona-e-particle-sources-v2-20261024')
assert set(paths).issubset(archive.entries), f'Missing dependencies: {set(paths)-set(archive.entries)}'
archive.extract(paths, root, flat=True)
native = {p: binfile.BinFile(io.BytesIO((root / f'{xxh64_intdigest(p):016x}.bin').read_bytes())) for p in bins}
parsed = {p: json.loads(json.dumps(b.to_serializable())) for p, b in native.items()}
r = selected['Leona_E_mis_dash']
entry = next(e for e in native[r['sourceBin']].entries if e.path.h == binfile.compute_binhash(r['record']))
field = entry.get('materialOverrideDefinitions').value.values[0].get('baseTexture')
assert field.type == binfile.BinType.PATH and isinstance(field.value, binfile.BinPathValue)
assert field.value.h == int(path_resolutions[0]['wadPathHash'], 16)
for key, r in selected.items():
    assert resources[key] == r['record']
    assert parsed[r['sourceBin']][r['record']] == r['definition'], f'Source definition differs: {key}'
result = dict(resources=selected, pathResolutions=path_resolutions, extraction=archive.provenance())
if pin: assert result == pin, 'Pinned Zenith Blade particle source provenance changed'
else: pin_path.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(dict(resources={k: len(r['definition'].get('complexEmitterDefinitionData', [])) for k,r in selected.items()}, bins=len(bins), textures=sum(p.endswith('.tex') for p in paths), meshes=sum(p.endswith('.scb') for p in paths))))
