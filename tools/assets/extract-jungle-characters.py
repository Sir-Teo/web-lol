"""Pin ordinary jungle character records and two base rigs from original Riot bytes.

The initial dictionaries supply hash-verified names only. Reproduction needs the
committed pin, not those mutable discovery dictionaries. These client records do
not prove the server's camp roster, mode selection, scaling or reward modifiers.
"""
import io
import json
from pathlib import Path

from cdtb import binfile
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive, sha

PIN = Path('docs/reference/jungle-character-source.json')
ROOT = Path('.cache/jungle-characters')
CHARACTERS = ['SRU_Blue', 'SRU_Red', 'SRU_Gromp', 'SRU_Murkwolf', 'SRU_MurkwolfMini',
              'SRU_Razorbeak', 'SRU_RazorbeakMini', 'SRU_Krug', 'SRU_KrugMini',
              'SRU_KrugMiniMini', 'Sru_Crab']
MODELS = ['SRU_Blue', 'SRU_Gromp']
old = json.loads(PIN.read_text()) if PIN.exists() else None
fields, types, names, asset_paths = {}, {}, {}, {}


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
        asset_paths[xxh64_intdigest(value.lower())] = value.lower()


if old:
    label_evidence = old['labelEvidence']
    collect(old['records'])
    for item in old['extraction']['files']:
        path = item['path']
        asset_paths[xxh64_intdigest(path)] = path
else:
    dictionaries = []
    for label, table in [('binfields', fields), ('bintypes', types)]:
        path = Path(f'.cache/garen-particle-bins/hashes.{label}.txt')
        raw = path.read_bytes()
        for line in raw.decode().splitlines():
            hashed, name = line.split(' ', 1)
            assert binfile.compute_binhash(name) == int(hashed, 16)
            table[int(hashed, 16)] = name
        dictionaries.append(dict(path=str(path), sha256=sha(raw)))
    seed = Path('docs/reference/garen-character.json')
    collect(json.loads(seed.read_text())['records'])
    # Read once during discovery. Every retained path is independently xxh64
    # checked; only the finite resolved paths enter the committed pin.
    path = ROOT / 'hashes.game.txt'
    raw = path.read_bytes()
    for line in raw.decode().splitlines():
        hashed, name = line.split(' ', 1)
        if name.lower().startswith(tuple(f'assets/characters/{c.lower()}/' for c in MODELS)):
            assert xxh64_intdigest(name.lower()) == int(hashed, 16)
            asset_paths[int(hashed, 16)] = name.lower()
    dictionaries.append(dict(path=str(path), sha256=sha(raw),
        url='https://raw.communitydragon.org/data/hashes/lol/hashes.game.txt'))
    label_evidence = dict(dictionaries=dictionaries,
        seeds=[dict(path=str(seed), sha256=sha(seed.read_bytes()))],
        status='Hash-verified labels identify fields and paths, not runtime behavior.')
for name in CHARACTERS:
    for path in [f'Characters/{name}/CharacterRecords/Root', f'Characters/{name}/Skins/Skin0']:
        names[binfile.compute_binhash(path)] = path
for table, values in [(binfile.hashfile_binfields, fields), (binfile.hashfile_bintypes, types),
                      (binfile.hashfile_binentries, names), (binfile.hashfile_binhashes, names),
                      (binfile.hashfile_binpaths, asset_paths)]:
    table.hashes = values

definitions = [f'data/characters/{c.lower()}/{c.lower()}.bin' for c in CHARACTERS]
definitions += [f'data/characters/{c.lower()}/{folder}/skin0.bin'
                for c in MODELS for folder in ['skins', 'animations']]
paths = json.loads(Path('docs/reference/map-wad-paths.json').read_text())
paths.update({f'{xxh64_intdigest(p):016x}': p for p in definitions})
if old:
    paths.update({item['wadPathHash']: item['path'] for item in old['extraction']['files']})
archive = RiotArchive(paths, old['extraction'] if old else None)
archive.extract(definitions, ROOT)


def align_names(actual, expected):
    # A literal elsewhere can resolve a previously unresolved FNV/xxh64 value.
    # Accept that spelling only when its exact hash matches the pinned value.
    if isinstance(actual, str) and isinstance(expected, str) and expected.startswith('{'):
        if expected in (f'{{{binfile.compute_binhash(actual):08x}}}',
                        f'{{{xxh64_intdigest(actual.lower()):016x}}}'):
            return expected
    if isinstance(actual, dict) and isinstance(expected, dict):
        result = {}
        for key, value in actual.items():
            hashed = f'{{{binfile.compute_binhash(key):08x}}}'
            pinned_key = hashed if key not in expected and hashed in expected else key
            result[pinned_key] = align_names(value, expected.get(pinned_key))
        return result
    if isinstance(actual, list) and isinstance(expected, list) and len(actual) == len(expected):
        return [align_names(a, b) for a, b in zip(actual, expected)]
    return actual


records = {}
for path in definitions:
    decoded = json.loads(json.dumps(binfile.BinFile(io.BytesIO((ROOT / path).read_bytes())).to_serializable()))
    records[path] = align_names(decoded, old['records'][path]) if old else decoded

models, dependencies = {}, set()
for name in MODELS:
    slug = name.lower()
    skin_records = records[f'data/characters/{slug}/skins/skin0.bin']
    animation_records = records[f'data/characters/{slug}/animations/skin0.bin']
    skin_key = f'Characters/{name}/Skins/Skin0'
    skin = skin_records[skin_key]
    graph_key = skin['skinAnimationProperties']['animationGraphData']
    graph = animation_records[graph_key]
    clips = {k: v['mAnimationResourceData']['mAnimationFilePath'].lower()
             for k, v in graph['mClipDataMap'].items() if v['__type'] == 'AtomicClipData'}

    def assets(value):
        if isinstance(value, dict):
            for child in value.values():
                assets(child)
        elif isinstance(value, list):
            for child in value:
                assets(child)
        elif isinstance(value, str) and value.lower().startswith('assets/') and value.lower().endswith(('.skn', '.skl', '.tex', '.dds')):
            dependencies.add(value.lower())

    assets(skin['skinMeshProperties'])
    assert not skin['skinMeshProperties']['texture'].startswith('{'), 'Unresolved base diffuse'
    assert all(not v.get('texture', '').startswith('{') for v in skin['skinMeshProperties'].get('materialOverride', []))
    dependencies.update(clips.values())
    models[name] = dict(skinKey=skin_key, graphKey=graph_key, atomicClips=clips)
dependencies = sorted(dependencies)
# Re-resolve the finite dependency set against the same archive header.
archive.wad.resolve_paths({xxh64_intdigest(p): p for p in dependencies})
archive.entries.update({e.path: e for e in archive.wad.files if e.path})
archive.extract(dependencies, ROOT)
result = dict(extraction=archive.provenance(), labelEvidence=label_evidence,
    characters=CHARACTERS, records=records, models=models,
    status='Original client character variants, spell records and Blue/Gromp base rigs. Camp roster, server scaling/rewards, mode activation, animation dispatch, particles, audio and native rendering require separate evidence.')
if old:
    if result != old:
        (ROOT / 'mismatched-pin.json').write_text(json.dumps(result, indent=2) + '\n')
    assert result == old, 'Pinned jungle character sources changed'
else:
    PIN.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(dict(characters=len(CHARACTERS), models=len(models),
    sourceFiles=len(archive.outputs), repeatMatches=old == result)))
