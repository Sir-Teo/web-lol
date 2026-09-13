"""Rebuild and verify the pinned base Hawkshot effects from Ashe's patch archive.

Run with PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python.
The minimal binary name tables come from the pinned records, not mutable global
hash dictionaries. Unknown names remain explicit hashes.
"""
import io
import json
from pathlib import Path

from cdtb import binfile
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive

pin_path = Path('docs/reference/hawkshot-effects.json')
pin = json.loads(pin_path.read_text())
provenance = pin['extraction']
paths = [item['path'] for item in provenance['files']]
toc = 'data/final/champions/ashe.wad.subchunktoc'
archive = RiotArchive(
    {f'{xxh64_intdigest(p):016x}': p for p in paths + [toc]},
    provenance,
    archive_name='DATA/FINAL/Champions/Ashe.wad.client',
)
output = Path('.cache/hawkshot-sources')
archive.extract(paths, output)

fields, types, values, entries, asset_paths = {}, {}, {}, {}, {}


def collect(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if not key.startswith('{'):
                fields[binfile.compute_binhash(key)] = key
                values[binfile.compute_binhash(key)] = key
            if key == '__type' and not child.startswith('{'):
                types[binfile.compute_binhash(child)] = child
            collect(child)
    elif isinstance(value, list):
        for child in value:
            collect(child)
    elif isinstance(value, str) and value.isascii() and not value.startswith('{'):
        values[binfile.compute_binhash(value)] = value
        if value.startswith('Characters/'):
            entries[binfile.compute_binhash(value)] = value
        asset_paths[xxh64_intdigest(value.lower())] = value


collect(pin['skinDefinition']['data'])
for key in pin['skinDefinition']['data']:
    entries[binfile.compute_binhash(key)] = key
for key, record in pin['records'].items():
    entries[binfile.compute_binhash(key)] = key
    collect(record['data'])
binfile.hashfile_binfields.hashes = fields
binfile.hashfile_bintypes.hashes = types
binfile.hashfile_binhashes.hashes = values
binfile.hashfile_binentries.hashes = entries
binfile.hashfile_binpaths.hashes = asset_paths


def decode(path):
    decoded = binfile.BinFile(io.BytesIO((output / path).read_bytes())).to_serializable()
    return json.loads(json.dumps(decoded))


skin = decode('data/characters/ashe/skins/skin0.bin')
assert skin == pin['skinDefinition']['data'], 'Base skin differs from pinned JSON'
resources = skin['Characters/Ashe/Skins/Skin0/Resources']['resourceMap']
for name in ['Ashe_E_mis', 'Ashe_E_tar_explode', 'Ashe_E_tar_linger']:
    assert resources[name] in pin['records'], f'Missing selected effect: {name}'
decoded = {}
dependencies = set()


def find_assets(value):
    if isinstance(value, dict):
        for child in value.values():
            find_assets(child)
    elif isinstance(value, list):
        for child in value:
            find_assets(child)
    elif isinstance(value, str) and value.lower().startswith('assets/'):
        dependencies.add(value.lower())


for key, record in pin['records'].items():
    source = record['sourceBin']
    if source not in decoded:
        decoded[source] = decode(source)
    assert decoded[source][key] == record['data'], f'Effect differs: {key}'
    assert source in [p.lower() for p in skin['__linked']], 'Effect bin is not linked by base skin'
    find_assets(record['data'])
assert dependencies <= set(paths), 'An effect dependency has not been extracted'
print(f'Verified {len(pin["records"])} selected effects and {len(paths)} source files')
print(f'{sum(item["bytes"] for item in provenance["files"])} source bytes; '
      f'{sum(item["bytes"] for item in archive.reads.values())} compressed patch bytes')
