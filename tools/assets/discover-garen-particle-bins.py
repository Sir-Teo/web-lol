"""Inspect frozen skin-linked BINs for a selected Garen spell's base particles.

Names from existing verified pins and hash-checked CDragon field/type dictionaries
are labels only. Definitions and asset paths are decoded from frozen Riot bytes.
Each discovery cache feeds a narrower repeatable spell extraction pipeline.
"""
from pathlib import Path
import hashlib
import io
import json
import subprocess
import argparse
from cdtb import binfile
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive

parser = argparse.ArgumentParser()
parser.add_argument('--ability', choices=['p', 'q', 'w', 'r'], default='r')
ability = parser.parse_args().ability
skin = json.loads(Path('docs/reference/garen-model.json').read_text())['skin']['data']
resources = {k: v for k, v in skin['Characters/Garen/Skins/Skin0/Resources']['resourceMap'].items() if (k in ['Garen_P_Heal', 'Garen_P_Boost', 'Garen_Heal'] if ability == 'p' else k.startswith(f'Garen_{ability.upper()}_'))}
paths = [p.lower() for p in skin['__linked'] if '/garen_multi_' in p.lower()]
cache = Path('.cache/garen-particle-bins'); cache.mkdir(exist_ok=True)
fields, types, names, assets = {}, {}, {}, {}
for label, table in [('binfields', fields), ('bintypes', types)]:
    path = cache / f'hashes.{label}.txt'
    if not path.exists():
        subprocess.check_call(['curl', '-fLsS', '--max-time', '60', f'https://raw.communitydragon.org/data/hashes/lol/{path.name}', '-o', str(path)])
    for line in path.read_text().splitlines():
        hashed, name = line.split(' ', 1)
        assert binfile.compute_binhash(name) == int(hashed, 16)
        table[int(hashed, 16)] = name

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
for p in Path('docs/reference').glob('*.json'):
    collect(json.loads(p.read_text()))
collect(resources)
for table, mapping in [(binfile.hashfile_binfields, fields), (binfile.hashfile_bintypes, types), (binfile.hashfile_binhashes, names), (binfile.hashfile_binentries, names), (binfile.hashfile_binpaths, assets)]:
    table.hashes = mapping
archive = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in paths + ['data/final/champions/garen.wad.subchunktoc']}, archive_name='DATA/FINAL/Champions/Garen.wad.client')
archive.extract(paths, cache, flat=True)
selected = {}
for path in paths:
    key = f'{xxh64_intdigest(path):016x}'
    data = json.loads(json.dumps(binfile.BinFile(io.BytesIO((cache / f'{key}.bin').read_bytes())).to_serializable()))
    matches = {k: dict(record=v, definition=data[v]) for k, v in resources.items() if v in data}
    for k in matches: assert k not in selected, k
    selected.update({k: dict(sourceBin=path, **v) for k, v in matches.items()})
    if matches: print(json.dumps(dict(key=key, resources=list(matches))))
(cache / ('discovered.json' if ability == 'r' else f'discovered-{ability}.json')).write_text(json.dumps(dict(resources=selected, extraction=archive.provenance()), indent=2) + '\n')
print(f'Located {len(selected)} {ability.upper()} records in {len(paths)} frozen skin-linked BINs.')
