"""Pin both wolf base rigs, three-member camp construction and named locators."""
import io
import json
from pathlib import Path
from cdtb import binfile
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive, sha
from lua51 import read_chunk, named_functions, instruction, data_block

PIN = Path('docs/reference/wolf-camps-source.json')
ROOT = Path('.cache/wolf-camps')
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
            if path.startswith(('assets/characters/sru_murkwolf/', 'assets/characters/sru_murkwolfmini/')):
                assert xxh64_intdigest(path.lower()) == int(h, 16)
                selected[int(h, 16)] = path.lower()
    assets.update(selected)
    label_evidence = dict(dictionarySha256=sha(dictionary.read_bytes()),
                          dictionaryUrl='https://raw.communitydragon.org/data/hashes/lol/hashes.game.txt',
                          status='Discovery labels only; every retained path is xxh64 checked. Reproduction uses pinned finite paths.')
for label in ['locators', 'transform', 'name', 'MapLocator']:
    fields[binfile.compute_binhash(label)] = label
    types[binfile.compute_binhash(label)] = label
for character in ['SRU_Murkwolf', 'SRU_MurkwolfMini']:
    key = f'Characters/{character}/Skins/Skin0'
    names[binfile.compute_binhash(key)] = key
for table, values in [(binfile.hashfile_binfields, fields), (binfile.hashfile_bintypes, types),
                      (binfile.hashfile_binentries, names), (binfile.hashfile_binhashes, names),
                      (binfile.hashfile_binpaths, assets)]:
    table.hashes = values
definitions = [f'data/characters/{name.lower()}/{folder}/skin0.bin'
               for name in ['SRU_Murkwolf', 'SRU_MurkwolfMini'] for folder in ['skins', 'animations']]
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
models = {}
dependencies = set()


def dependencies_in(v):
    if isinstance(v, dict):
        for x in v.values():
            dependencies_in(x)
    elif isinstance(v, list):
        for x in v:
            dependencies_in(x)
    elif isinstance(v, str) and v.lower().startswith('assets/') and v.lower().endswith(('.skn', '.skl', '.tex', '.dds')):
        dependencies.add(v.lower())


for name in ['SRU_Murkwolf', 'SRU_MurkwolfMini']:
    skin_key = f'Characters/{name}/Skins/Skin0'
    skin = records[f'data/characters/{name.lower()}/skins/skin0.bin'][skin_key]
    graph_key = skin['skinAnimationProperties']['animationGraphData']
    graph = records[f'data/characters/{name.lower()}/animations/skin0.bin'][graph_key]
    clips = {k: v['mAnimationResourceData']['mAnimationFilePath'].lower()
             for k, v in graph['mClipDataMap'].items() if v['__type'] == 'AtomicClipData'}
    dependencies.update(clips.values())
    dependencies_in(skin['skinMeshProperties'])
    assert not skin['skinMeshProperties']['texture'].startswith('{')
    models[name] = dict(skinKey=skin_key, graphKey=graph_key, atomicClips=clips)
archive.wad.resolve_paths({xxh64_intdigest(p): p for p in dependencies})
archive.entries.update({e.path: e for e in archive.wad.files if e.path})
archive.extract(sorted(dependencies), ROOT)

shared = 'data/shared/scripts/sr_neutralminionspawn.luabin64'
raw = (Path('.cache/jungle-camp-research/sources') / shared).read_bytes()
expected = next(f for f in parent['jungle-script-source']['extraction']['files'] if f['path'] == shared)
assert sha(raw) == expected['sha256']
functions = named_functions(read_chunk(raw))


def window(function, first, last):
    proto = functions[function]
    return dict(function=function, codeSha256=proto['codeSha256'], firstPc=first, lastPc=last,
                instructions=[instruction(proto, pc) for pc in range(first, last + 1)])


evidence = dict(orderGroup=window('<main>', 889, 904), chaosGroup=window('<main>', 905, 920),
                order=window('NeutralMinionInit', 351, 397), chaos=window('NeutralMinionInit', 752, 798))
groups = {}
for key, tag in [('order', 'CAMPTYPE_WOLVES'), ('chaos', 'CAMPTYPE_WOLVES2')]:
    groups[key] = data_block(evidence[key + 'Group']['instructions'], {tag: key}, {0: {}})[0][key]
    assert [groups[key][i][1] for i in [1, 2, 3]] == ['SRU_Murkwolf', 'SRU_MurkwolfMini', 'SRU_MurkwolfMini']
bindings = dict(START_OF_GAME_MONSTER_SPAWN_DELAY=22, CAMP_TIME_OFFSET=1, TEAM_ORDER=100,
                TEAM_CHAOS=200, CAMPTYPE_WOLVES='order', CAMPTYPE_WOLVES2='chaos',
                PredefinedCamps=groups, Make3DPoint='Make3DPoint', NeutralMinionCamps={2: {}, 8: {}})
for key in ['order', 'chaos']:
    data_block(evidence[key]['instructions'], bindings)
map_pin = parent['jungle-map-source']
file = next(f for f in map_pin['extraction']['files'] if f['path'].endswith('/map11.bin'))
raw = (Path('.cache/jungle-sources') / (file['wadPathHash'] + '.bin')).read_bytes()
assert sha(raw) == file['sha256']
definition = json.loads(json.dumps(binfile.BinFile(io.BytesIO(raw)).to_serializable()))
locators = definition['{a250382e}']['locators']
camps = []
for index, prefix, key in [(2, 'OrderWolves', 'order'), (8, 'ChaosWolves', 'chaos')]:
    camp = bindings['NeutralMinionCamps'][index]
    assert camp['Groups'] == {1: groups[key]}
    members = []
    for slot in [1, 2, 3]:
        lookup = prefix + str(slot)
        matching = [v for v in locators if v.get('name', '').lower() == lookup.lower()]
        assert len(matching) == 1
        lookup_pc = next(pc for pc in range(1, len(functions['<main>']['words']) + 1)
                         if instruction(functions['<main>'], pc)['op'] == 'LOADK' and
                         instruction(functions['<main>'], pc)['operands'][1] == {'constant': lookup})
        members.append(dict(character=groups[key][slot][1], spawnClip=groups[key][slot][2].lower(),
                            lookup=lookup, locator=matching[0], lookupEvidence=window('<main>', lookup_pc - 1, lookup_pc + 1)))
    anchor = next(v for v in map_pin['records']['campEntities'] if
                  map_pin['records']['identifiers'][v['record']['NeutralCamp']['CampIdentifier']]['CampName'] == camp['Name'])
    camps.append(dict(index=index, name=camp['Name'], anchorEntity=anchor['key'], members=members,
                      settings={k: camp[k] for k in ['SpawnDuration', 'VisualFacing']},
                      inheritedRespawnSeconds=next(i['operands'][2]['constant'] for i in parent['jungle-script-source']['evidence']['campDefaults']['instructions']
                        if i['op'] == 'SETTABLE' and i['operands'][1] == {'constant': 'GroupsRespawnTime'})))
result = dict(parents={k: dict(path=str(p), sha256=sha(p.read_bytes())) for k, p in parents.items()},
              extraction=archive.provenance(), labelEvidence=label_evidence, records=records,
              models=models, evidence=evidence, camps=camps,
              status='Original base rigs and legacy three-member construction. Active native initialization, scaling, patience, missing mini damage/CS and effects/audio remain unverified.')
if old:
    if old != result:
        (ROOT / 'mismatched-pin.json').write_text(json.dumps(result, indent=2) + '\n')
    assert old == result, 'Wolf source pin changed'
else:
    PIN.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(dict(camps=len(camps), files=len(archive.outputs), models=list(models), settings=[c['settings'] for c in camps], repeatMatches=old == result)))
