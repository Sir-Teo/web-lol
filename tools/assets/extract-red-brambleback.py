"""Pin Red's base rig, legacy camp construction and conflicting Skin3 metadata."""
import io
import json
from pathlib import Path
from cdtb import binfile
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive, sha
from lua51 import read_chunk, named_functions, instruction, data_block

PIN = Path('docs/reference/red-brambleback-source.json')
ROOT = Path('.cache/red-brambleback')
old = json.loads(PIN.read_text()) if PIN.exists() else None
parents = {name: Path(f'docs/reference/{name}.json') for name in
           ['jungle-character-source', 'jungle-script-source', 'jungle-map-source']}
parent = {k: json.loads(p.read_text()) for k, p in parents.items()}
fields, types, names, assets = {}, {}, {}, {}


def collect(v):
    if isinstance(v, dict):
        for k, x in v.items():
            if not k.startswith('{'):
                fields[binfile.compute_binhash(k)] = k
            if k == '__type' and not x.startswith('{'):
                types[binfile.compute_binhash(x)] = x
            collect(x)
    elif isinstance(v, list):
        for x in v:
            collect(x)
    elif isinstance(v, str) and v.isascii() and not v.startswith('{'):
        names[binfile.compute_binhash(v)] = v
        assets[xxh64_intdigest(v.lower())] = v.lower()


collect(parent['jungle-character-source']['records'])
if old:
    collect(old['records'])
    label_evidence = old['labelEvidence']
    for item in old['extraction']['files']:
        assets[int(item['wadPathHash'], 16)] = item['path']
else:
    dictionary = Path('.cache/jungle-characters/hashes.game.txt')
    selected = {}
    with dictionary.open() as f:
        for line in f:
            h, _, path = line.rstrip('\n').partition(' ')
            if path.startswith('assets/characters/sru_red/'):
                assert xxh64_intdigest(path.lower()) == int(h, 16)
                selected[int(h, 16)] = path.lower()
    assets.update(selected)
    label_evidence = dict(dictionarySha256=sha(dictionary.read_bytes()),
                          dictionaryUrl='https://raw.communitydragon.org/data/hashes/lol/hashes.game.txt',
                          status='Discovery labels only; every retained path is xxh64 checked. Reproduction uses pinned finite paths.')
for label in ['locators', 'transform', 'name', 'MapLocator']:
    fields[binfile.compute_binhash(label)] = label
    types[binfile.compute_binhash(label)] = label
for skin in [0, 3]:
    key = f'Characters/SRU_Red/Skins/Skin{skin}'
    names[binfile.compute_binhash(key)] = key
for table, values in [(binfile.hashfile_binfields, fields), (binfile.hashfile_bintypes, types),
                      (binfile.hashfile_binentries, names), (binfile.hashfile_binhashes, names),
                      (binfile.hashfile_binpaths, assets)]:
    table.hashes = values
definitions = [f'data/characters/sru_red/{folder}/skin{skin}.bin'
               for skin in [0, 3] for folder in ['skins', 'animations']]
paths = json.loads(Path('docs/reference/map-wad-paths.json').read_text())
paths.update({f'{xxh64_intdigest(p):016x}': p for p in definitions})
paths.update({f'{h:016x}': p for h, p in assets.items()})
archive = RiotArchive(paths, old['extraction'] if old else None)
archive.extract(definitions, ROOT)


def align_names(actual, expected):
    # New literals can resolve older hash labels. Preserve pinned spellings only
    # after checking exact FNV/xxh64 equality; never mask a source-value change.
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
for p in definitions:
    decoded = json.loads(json.dumps(binfile.BinFile(io.BytesIO((ROOT / p).read_bytes())).to_serializable()))
    records[p] = align_names(decoded, old['records'][p]) if old else decoded
skin_key = 'Characters/SRU_Red/Skins/Skin0'
skin = records[definitions[0]][skin_key]
graph_key = skin['skinAnimationProperties']['animationGraphData']
graph = records[definitions[1]][graph_key]
clips = {k: v['mAnimationResourceData']['mAnimationFilePath'].lower()
         for k, v in graph['mClipDataMap'].items() if v['__type'] == 'AtomicClipData'}
dependencies = set(clips.values())


def dependencies_in(v):
    if isinstance(v, dict):
        for x in v.values():
            dependencies_in(x)
    elif isinstance(v, list):
        for x in v:
            dependencies_in(x)
    elif isinstance(v, str) and v.lower().startswith('assets/') and v.lower().endswith(('.skn', '.skl', '.tex', '.dds')):
        dependencies.add(v.lower())


dependencies_in(skin['skinMeshProperties'])
assert not skin['skinMeshProperties']['texture'].startswith('{'), 'Unresolved Red base diffuse'
archive.wad.resolve_paths({xxh64_intdigest(p): p for p in dependencies})
archive.entries.update({e.path: e for e in archive.wad.files if e.path})
archive.extract(sorted(dependencies), ROOT)

scripts = ['data/characters/sru_red/charscriptsru_red.luabin64']
script_archive = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in scripts},
                            old['scriptExtraction'] if old else None,
                            archive_name='DATA/FINAL/Scripts.wad.client')
script_archive.extract(scripts, ROOT / 'scripts')
script_inventory = {}
for p in scripts:
    proto = read_chunk((ROOT / 'scripts' / p).read_bytes())
    script_inventory[p] = dict(constants=proto['constants'], codeSha256=proto['codeSha256'],
                               instructions=[instruction(proto, pc) for pc in range(1, len(proto['words']) + 1)])
shared = 'data/shared/scripts/sr_neutralminionspawn.luabin64'
raw = (Path('.cache/jungle-camp-research/sources') / shared).read_bytes()
expected = next(f for f in parent['jungle-script-source']['extraction']['files'] if f['path'] == shared)
assert sha(raw) == expected['sha256']
functions = named_functions(read_chunk(raw))


def window(function, first, last):
    proto = functions[function]
    return dict(function=function, codeSha256=proto['codeSha256'], firstPc=first, lastPc=last,
                instructions=[instruction(proto, pc) for pc in range(first, last + 1)])


evidence = dict(group=window('<main>', 881, 888), order=window('NeutralMinionInit', 458, 524),
                chaos=window('NeutralMinionInit', 859, 925))
group = data_block(evidence['group']['instructions'], {'CAMPTYPE_REDBUFF': 'red'}, {0: {}})[0]['red']
assert group == {1: {1: 'SRU_Red', 2: 'spawn'}}
bindings = dict(START_OF_GAME_MONSTER_SPAWN_DELAY=22, CAMP_TIME_OFFSET=1, TEAM_ORDER=100,
                TEAM_CHAOS=200, CAMPTYPE_REDBUFF='red', PredefinedCamps={'red': group},
                SkinOverrides={'SRU_Red': 0}, Make3DPoint='Make3DPoint', NeutralMinionCamps={4: {}, 10: {}})
for key in ['order', 'chaos']:
    data_block(evidence[key]['instructions'], bindings)
map_pin = parent['jungle-map-source']
file = next(f for f in map_pin['extraction']['files'] if f['path'].endswith('/map11.bin'))
raw = (Path('.cache/jungle-sources') / (file['wadPathHash'] + '.bin')).read_bytes()
assert sha(raw) == file['sha256']
definition = json.loads(json.dumps(binfile.BinFile(io.BytesIO(raw)).to_serializable()))
locators = definition['{a250382e}']['locators']
camps = []
for index, lookup in [(4, 'OrderRedBuff1'), (10, 'ChaosRedBuff1')]:
    matching = [v for v in locators if v.get('name', '').lower() == lookup.lower()]
    assert len(matching) == 1
    camp = bindings['NeutralMinionCamps'][index]
    assert camp['Groups'] == {1: group}
    anchor = next(v for v in map_pin['records']['campEntities'] if
                  map_pin['records']['identifiers'][v['record']['NeutralCamp']['CampIdentifier']]['CampName'] == camp['Name'])
    lookup_pc = next(pc for pc in range(1, len(functions['<main>']['words']) + 1)
                     if instruction(functions['<main>'], pc)['op'] == 'LOADK' and
                     instruction(functions['<main>'], pc)['operands'][1] == {'constant': lookup})
    camps.append(dict(index=index, name=camp['Name'], lookup=lookup, locator=matching[0], anchorEntity=anchor['key'],
                      group=[dict(character='SRU_Red', animation='spawn')],
                      settings={k: camp[k] for k in ['GroupsRespawnTime', 'SpawnDuration', 'LeashRadius', 'VisualFacing']},
                      lookupEvidence=window('<main>', lookup_pc - 1, lookup_pc + 1)))
skin3 = records[definitions[2]]['Characters/SRU_Red/Skins/Skin3']
result = dict(parents={k: dict(path=str(p), sha256=sha(p.read_bytes())) for k, p in parents.items()},
              extraction=archive.provenance(), labelEvidence=label_evidence, records=records,
              models={'SRU_Red': dict(skinKey=skin_key, graphKey=graph_key, atomicClips=clips)},
              scriptExtraction=script_archive.provenance(), scriptInventory=script_inventory,
              evidence=evidence, camps=camps, providedSkinOverride=0,
              skinSelection=dict(localSkin=0, skin3Name=skin3['championSkinName'],
                                 status='Placed Skin3 and legacy static data do not prove native activation. Normal skin 0 is the local choice following removal of Baron corruption.',
                                 url='https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/'),
              status='Pinned base rig and legacy camp construction. Native initialization, scaling, animation/skin selection, buff behavior and effects/audio remain unverified.')
if old:
    if old != result:
        (ROOT / 'mismatched-pin.json').write_text(json.dumps(result, indent=2) + '\n')
    assert old == result, 'Red source pin changed'
else:
    PIN.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(dict(camps=len(camps), files=len(archive.outputs), scripts=len(scripts),
                     clips=len(clips), settings=[c['settings'] for c in camps], repeatMatches=old == result)))
