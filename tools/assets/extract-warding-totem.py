"""Pin Stealth Ward item/spell metadata and the original base SightWard rig.

Dictionary labels are hash-checked discovery aids, never executable evidence.
Reproduction uses finite committed names and the frozen Riot archive manifest.
"""
import io
import json
from pathlib import Path
from cdtb import binfile
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive, sha
from lua51 import read_chunk, named_functions, instruction

PIN = Path('docs/reference/warding-totem-source.json')
ROOT = Path('.cache/warding-totem')
old = json.loads(PIN.read_text()) if PIN.exists() else None
parent_path = Path('docs/reference/jungle-character-source.json')
parent = json.loads(parent_path.read_text())
items_path = Path('.cache/jungle-quest/items.json')
shared_path = Path('.cache/smite/shared.json')
strings_path = Path('.cache/smite/strings.json')
dd_path = Path('.cache/jungle-quest/dd-items.json')
items = json.loads(items_path.read_text())
shared = json.loads(shared_path.read_text())
strings = json.loads(strings_path.read_text())['entries']
item_parent = json.loads(Path('docs/reference/jungle-companions-source.json').read_text())
smite_parent = json.loads(Path('docs/reference/summoner-smite-source.json').read_text())
assert sha(items_path.read_bytes()) == item_parent['itemSource']['sha256']
assert sha(dd_path.read_bytes()) == item_parent['dataDragon']['sha256']
assert sha(shared_path.read_bytes()) == smite_parent['shared']['sha256']
assert sha(strings_path.read_bytes()) == smite_parent['strings']['sha256']
item_keys = ['Items/3340', 'Items/ItemGroups/Trinket', 'Items/Spells/TrinketTotemLvl1']
shared_keys = ['Shared/Spells/SightWardStealth', 'Shared/Spells/TrinketTotemTravel',
               'Shared/Spells/TrinketTotemTravelGreen', 'Shared/Spells/WardDisable']
item_records = {k: items[k] for k in item_keys}
shared_records = {k: shared[k] for k in shared_keys}
fields, types, names, assets = {}, {}, {}, {}
def collect(v):
    if isinstance(v, dict):
        for k, child in v.items():
            if not k.startswith('{'): fields[binfile.compute_binhash(k)] = k
            if k == '__type' and not child.startswith('{'): types[binfile.compute_binhash(child)] = child
            collect(child)
    elif isinstance(v, list):
        for child in v: collect(child)
    elif isinstance(v, str) and v.isascii() and not v.startswith('{'):
        names[binfile.compute_binhash(v)] = v
        assets[xxh64_intdigest(v.lower())] = v.lower()
collect(parent['records']); collect(item_records); collect(shared_records)
if old:
    collect(old['records'])
    labels = old['labelEvidence']
    for f in old['extraction']['files']: assets[int(f['wadPathHash'], 16)] = f['path']
else:
    dictionaries = []
    for label, table in [('binfields', fields), ('bintypes', types)]:
        p = Path(f'.cache/garen-particle-bins/hashes.{label}.txt')
        for line in p.read_text().splitlines():
            h, value = line.split(' ', 1)
            assert binfile.compute_binhash(value) == int(h, 16)
            table[int(h, 16)] = value
        dictionaries.append(dict(path=str(p), sha256=sha(p.read_bytes())))
    p = Path('.cache/jungle-characters/hashes.game.txt')
    for line in p.open():
        h, _, value = line.rstrip('\n').partition(' ')
        if value.startswith('assets/characters/sightward/'):
            assert xxh64_intdigest(value.lower()) == int(h, 16)
            assets[int(h, 16)] = value.lower()
    dictionaries.append(dict(path=str(p), sha256=sha(p.read_bytes()), url='https://raw.communitydragon.org/data/hashes/lol/hashes.game.txt'))
    labels = dict(dictionaries=dictionaries, status='Discovery names only; exact FNV and xxh64 checks. No runtime behavior inferred from naming.')
for key in ['Characters/SightWard/CharacterRecords/Root', 'Characters/SightWard/Skins/Skin0']:
    names[binfile.compute_binhash(key)] = key
for table, values in [(binfile.hashfile_binfields, fields), (binfile.hashfile_bintypes, types),
                      (binfile.hashfile_binentries, names), (binfile.hashfile_binhashes, names),
                      (binfile.hashfile_binpaths, assets)]: table.hashes = values
files = ['data/characters/sightward/sightward.bin', 'data/characters/sightward/skins/skin0.bin', 'data/characters/sightward/animations/skin0.bin']
paths = json.loads(Path('docs/reference/map-wad-paths.json').read_text())
paths.update({f'{xxh64_intdigest(p):016x}': p for p in files})
if old: paths.update({f['wadPathHash']: f['path'] for f in old['extraction']['files']})
a = RiotArchive(paths, old['extraction'] if old else None)
a.extract(files, ROOT)
def align(actual, expected):
    if isinstance(actual, str) and isinstance(expected, str) and expected.startswith('{') and expected in (f'{{{binfile.compute_binhash(actual):08x}}}', f'{{{xxh64_intdigest(actual.lower()):016x}}}'): return expected
    if isinstance(actual, dict) and isinstance(expected, dict):
        out = {}
        for k, value in actual.items():
            h = f'{{{binfile.compute_binhash(k):08x}}}'
            key = h if k not in expected and h in expected else k
            out[key] = align(value, expected.get(key))
        return out
    if isinstance(actual, list) and isinstance(expected, list) and len(actual) == len(expected): return [align(v, e) for v, e in zip(actual, expected)]
    return actual
records = {}
for path in files:
    decoded = json.loads(json.dumps(binfile.BinFile(io.BytesIO((ROOT/path).read_bytes())).to_serializable()))
    records[path] = align(decoded, old['records'][path]) if old else decoded
skin = records[files[1]]['Characters/SightWard/Skins/Skin0']
graph_key = skin['skinAnimationProperties']['animationGraphData']
graph = records[files[2]][graph_key]
clips = {k: v['mAnimationResourceData']['mAnimationFilePath'].lower() for k, v in graph['mClipDataMap'].items() if v['__type'] == 'AtomicClipData'}
dependencies = set(clips.values())
def deps(v):
    if isinstance(v, dict):
        for child in v.values(): deps(child)
    elif isinstance(v, list):
        for child in v: deps(child)
    elif isinstance(v, str) and v.lower().startswith('assets/') and v.lower().endswith(('.skn', '.skl', '.dds', '.tex')): dependencies.add(v.lower())
deps(skin['skinMeshProperties'])
assert not skin['skinMeshProperties']['texture'].startswith('{')
a.wad.resolve_paths({xxh64_intdigest(p): p for p in dependencies}); a.entries.update({e.path: e for e in a.wad.files if e.path})
a.extract(sorted(dependencies), ROOT)
script_files = ['data/items/3340.luabin64'] + [f'data/spells/{s}.luabin64' for s in ['trinkettotemlvl1', 'sightward', 'sightwardstealth', 'trinkettotemtravel', 'trinkettotemtravelgreen']] + ['data/characters/sightward/charscriptsightward.luabin64']
b = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in script_files}, old['scriptExtraction'] if old else None, archive_name='DATA/FINAL/Scripts.wad.client')
b.extract(script_files, ROOT/'scripts')
inventory = {p: {n: dict(constants=f['constants'], codeSha256=f['codeSha256'], children=len(f['children']), instructions=[instruction(f, pc) for pc in range(1, len(f['words'])+1)]) for n, f in named_functions(read_chunk((ROOT/'scripts'/p).read_bytes())).items()} for p in script_files}
text_keys = ['item_3340_name', 'generatedtip_item_3340_description', 'item_3340_inventoryonlytext', 'game_buff_tooltip_sightward', 'game_buff_tooltip_stealth']
result = dict(referenceVersion='16.18.8175716', parent=dict(path=str(parent_path), sha256=sha(parent_path.read_bytes())), extraction=a.provenance(), labelEvidence=labels, records=records, model=dict(skinKey='Characters/SightWard/Skins/Skin0', graphKey=graph_key, atomicClips=clips), scriptExtraction=b.provenance(), scriptInventory=inventory,
    items=dict(url=item_parent['itemSource']['url'], sha256=sha(items_path.read_bytes()), records=item_records), shared=dict(url=smite_parent['shared']['url'], sha256=sha(shared_path.read_bytes()), records=shared_records), strings=dict(url=smite_parent['strings']['url'], sha256=sha(strings_path.read_bytes()), entries={k: strings[k] for k in text_keys if k in strings}), dataDragon=dict(url=item_parent['dataDragon']['url'], sha256=sha(dd_path.read_bytes()), item=json.loads(dd_path.read_text())['data']['3340']),
    icon=next(f for f in json.loads(Path('public/assets/reference-manifest.json').read_text())['assets'] if f['path'] == '/assets/icons/3340.png'),
    published=dict(recharge=dict(url='https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-3-notes/', earlySeconds=210, lateSeconds=90, scope='Level scaling published; exact runtime average, update curve and phase remain unverified.'), legacyWardGold=dict(url='https://www.leagueoflegends.com/en-gb/news/game-updates/patch-11-17-notes/', gold=10, scope='Historical clone ward-kill fix supports a candidate override. Current trinket-specific native binding is not recovered.'), faelights=dict(url='https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/', status='Required vision extension; not inferred from the base ward.')),
    limits=['Static item/spell records do not prove active native scripts, startup ammo, recharge scaling, stealth/reveal timing, placement nudges, attack rules or reward dispatch.', 'The selected normal SightWard skin is a local default; cosmetic ward selection and native animation graph dispatch remain unverified.'])
if old:
    if old != result: (ROOT/'mismatched-pin.json').write_text(json.dumps(result, indent=2)+'\n')
    assert old == result, 'Stealth Ward source differs from pin'
else: PIN.write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(dict(files=len(a.outputs), clips=len(clips), scripts=len(b.outputs), repeatMatches=old==result)))
