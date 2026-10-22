"""Pin legacy Gromp particles from the frozen DATA archive, including raw typed rows."""
import json
import sys
from pathlib import Path
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive, sha
from legacy_troy import read, decode, ihash

PIN = Path('docs/reference/gromp-effects.json')
ROOT = Path('.cache/gromp-effects-sources')
old = json.loads(PIN.read_text()) if PIN.exists() else None
names = ['ba1_mis', 'ba_mouth', 'ba_tar', 'death_pop', 'death_spores', 'death_sound',
         'idle_a2n_sound', 'idle_aggro2_sound', 'idle_aggro3_sound', 'idle_n2a_sound',
         'idle_normal2_sound', 'idle_normal3_sound', 'idle_normal4_sound', 'idle_normal6_sound',
         'spawn_readyflash', 'spawn_sound']
paths = [f'data/particles/sru_gromp_{name}.troybin' for name in names]
if old:
    paths = [f['path'] for f in old['extraction']['files']]
archive = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in paths},
    old['extraction'] if old else None, archive_name='DATA/FINAL/DATA.wad.client')
archive.extract(paths, ROOT)
if old:
    naming = old['naming']
else:
    sys.path.insert(0, '.tools/lolpytools')
    from lolpytools import inibin2, troybin_fix
    naming = dict(repository='https://github.com/moonshadow565/lolpytools',
        revision='cd778cb1b2ace6557bbf9f7c3395b3f6f2f5a2b9',
        files={name: sha(Path('.tools/lolpytools/lolpytools', name).read_bytes())
               for name in ['inibin2.py', 'troybin_fix.py']})
records, assets = {}, set()
for path in [p for p in paths if p.endswith('.troybin')]:
    parsed = read((ROOT / path).read_bytes())
    if old:
        labels = old['records'][path]['labels']
    else:
        with (ROOT / path).open('rb') as f:
            oracle = inibin2.read(f)
        expected = {f'{key:08x}': value for key, value in oracle['UNKNOWN_HASHES'].items()}
        assert json.loads(json.dumps({r['hash']: r['value'] for r in parsed['rows']})) == json.loads(json.dumps(expected))
        troybin_fix.fix(oracle)
        labels = {ihash(section, field): [section, field]
                  for section, fields in oracle['Values'].items() for field in fields}
    decoded = decode(parsed, labels)
    records[path] = dict(typed=parsed, labels=labels, decoded=decoded)
    for row in parsed['rows']:
        value = row['raw']
        if isinstance(value, str) and value.lower().startswith('data/') and value.lower().endswith(('.dds', '.scb')):
            assets.add(value.lower())
if not old:
    dependencies = sorted(assets)
    archive.wad.resolve_paths({xxh64_intdigest(p): p for p in dependencies})
    archive.entries.update({e.path: e for e in archive.wad.files if e.path})
    assert set(dependencies).issubset(archive.entries), f'Missing legacy dependencies: {set(dependencies)-set(archive.entries)}'
    archive.extract(dependencies, ROOT)
result = dict(extraction=archive.provenance(), naming=naming, records=records,
    status='Original typed Troybin v2 fields with SDBM-verified labels and all declared DDS/SCB dependencies. Unknown fields are retained; native renderer defaults, dispatch and complete composition remain separate evidence.')
if old:
    assert result == old, 'Pinned Gromp effects or provenance changed'
else:
    PIN.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(dict(particleFiles=len(records), dependencies=len(assets),
    sourceFiles=len(archive.outputs), repeatMatches=old == result)))
