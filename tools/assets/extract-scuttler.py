"""Pin Scuttler base rig, both river regions and coordinated camp source and named locators."""
import io
import json
from pathlib import Path
from cdtb import binfile
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive, sha
from lua51 import read_chunk, named_functions, instruction, data_block

PIN = Path('docs/reference/scuttler-source.json')
ROOT = Path('.cache/scuttler')
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
            if path.startswith(('assets/characters/sru_crab/',)):
                assert xxh64_intdigest(path.lower()) == int(h, 16)
                selected[int(h, 16)] = path.lower()
    assets.update(selected)
    label_evidence = dict(dictionarySha256=sha(dictionary.read_bytes()),
                          dictionaryUrl='https://raw.communitydragon.org/data/hashes/lol/hashes.game.txt',
                          status='Discovery labels only; every retained path is xxh64 checked. Reproduction uses pinned finite paths.')
for label in ['locators', 'transform', 'name', 'MapLocator']:
    fields[binfile.compute_binhash(label)] = label
    types[binfile.compute_binhash(label)] = label
for character in ['Sru_Crab']:
    key = f'Characters/{character}/Skins/Skin0'
    names[binfile.compute_binhash(key)] = key
for table, values in [(binfile.hashfile_binfields, fields), (binfile.hashfile_bintypes, types),
                      (binfile.hashfile_binentries, names), (binfile.hashfile_binhashes, names),
                      (binfile.hashfile_binpaths, assets)]:
    table.hashes = values
definitions = [f'data/characters/{name.lower()}/{folder}/skin0.bin'
               for name in ['Sru_Crab'] for folder in ['skins', 'animations']]
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


for name in ['Sru_Crab']:
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

scripts = ['data/characters/sru_crab/charscriptsru_crab.luabin64',
           *[f'data/characters/sru_crab/spells/sru_crab{n}.luabin64' for n in
             ['attach', 'dash', 'dashlong', 'nimbleness', 'sight', 'speedboost', 'speedmarker', 'speedshrine', 'visionmarker']],
           'data/scripts/rivercrab.luabin64', 'data/scripts/slimerivercrab.luabin64',
           'data/shared/scripts/riverregions.luabin64', 'data/shared/scripts/aicomponentsystem.luabin64',
           *[f'data/shared/scripts/aicomponents/aicomponent{n}.luabin64' for n in
             ['lockmovementtoriver', 'outofcombatregen', 'skittishmonster', 'wanderandgraze']]]
script_archive = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in scripts},
                            old['scriptExtraction'] if old else None,
                            archive_name='DATA/FINAL/Scripts.wad.client')
script_archive.extract(scripts, ROOT / 'scripts')

def inventory(proto):
    # Preserve every nested closure, including table methods and state callbacks.
    return dict(codeSha256=proto['codeSha256'], firstLine=proto['firstLine'], lastLine=proto['lastLine'],
                constants=proto['constants'], instructions=[instruction(proto, pc) for pc in range(1, len(proto['words']) + 1)],
                children=[inventory(child) for child in proto['children']])

script_inventory = {p: inventory(read_chunk((ROOT / 'scripts' / p).read_bytes())) for p in scripts}

shared = 'data/shared/scripts/sr_neutralminionspawn.luabin64'
raw = (Path('.cache/jungle-camp-research/sources') / shared).read_bytes()
expected = next(f for f in parent['jungle-script-source']['extraction']['files'] if f['path'] == shared)
assert sha(raw) == expected['sha256']
functions = named_functions(read_chunk(raw))


def window(function, first, last):
    proto = functions[function]
    return dict(function=function, codeSha256=proto['codeSha256'], firstPc=first, lastPc=last,
                instructions=[instruction(proto, pc) for pc in range(first, last + 1)])


evidence = dict(group=window('<main>', 949, 956),
                order=window('NeutralMinionInit', 1142, 1152), orderSettings=window('NeutralMinionInit', 1179, 1201),
                chaos=window('NeutralMinionInit', 1211, 1221), chaosSettings=window('NeutralMinionInit', 1248, 1270),
                orderSelection=window('NeutralMinionInit', 1153, 1178), chaosSelection=window('NeutralMinionInit', 1222, 1247),
                orderSkinOverride=window('NeutralMinionInit', 1202, 1206), chaosSkinOverride=window('NeutralMinionInit', 1271, 1275),
                defaults=window('SetupNeutralMinionSpawnDefaults', 15, 47),
                deathSelection=window('NeutralMinionDeath', 191, 256),
                deathCoordination=window('NeutralMinionDeath', 277, 323))
group = data_block(evidence['group']['instructions'], {'CAMPTYPE_CRAB': 'crab'}, {0: {}})[0]['crab']
assert group == {1: {1: 'Sru_Crab', 2: 'crab_hide'}}
bindings = dict(START_OF_GAME_MONSTER_SPAWN_DELAY=22, START_OF_GAME_ADDITIONAL_DELAY_CRAB=124,
                CAMPTYPE_CRAB='crab', PredefinedCamps={'crab': group}, Make3DPoint='Make3DPoint',
                NeutralMinionCamps={15: {}, 16: {}})
for key in ['order', 'orderSettings', 'chaos', 'chaosSettings']:
    data_block(evidence[key]['instructions'], bindings)
river_proto = named_functions(read_chunk((ROOT / 'scripts/data/shared/scripts/riverregions.luabin64').read_bytes()))['CreateRiverRegions']
center_registers = data_block([instruction(river_proto, pc) for pc in range(1, 11)], {'Make3DPoint': 'Make3DPoint'})
rivers = {}
for side, first, last, initial in [('baron', 23, 123, {1: [4200, 0, 9800]}), ('dragon', 125, 235, {0: [10500, 0, 5000]})]:
    center_register = 1 if side == 'baron' else 0
    assert initial[center_register] == center_registers[center_register], 'River center differs from literal prefix'
    items = [instruction(river_proto, pc) for pc in range(first, last + 1)]
    globals_ = {'Make3DPoint': 'Make3DPoint'}
    assert items[-1]['op'] == 'SETGLOBAL' and items[-1]['operands'] == [2, {'constant': 'River'}]
    registers = data_block(items[:-1], globals_, initial)
    rivers[side] = dict(region=registers[2], evidence=dict(function='CreateRiverRegions',
                       codeSha256=river_proto['codeSha256'], firstPc=first, lastPc=last, instructions=items))
map_pin = parent['jungle-map-source']
file = next(f for f in map_pin['extraction']['files'] if f['path'].endswith('/map11.bin'))
raw = (Path('.cache/jungle-sources') / (file['wadPathHash'] + '.bin')).read_bytes()
assert sha(raw) == file['sha256']
definition = json.loads(json.dumps(binfile.BinFile(io.BytesIO(raw)).to_serializable()))
locators = definition['{a250382e}']['locators']
camps = []
for index, lookup, side, key in [(15, 'DragonEelCamp', 'dragon', 'order'), (16, 'BaronEelCamp', 'baron', 'chaos')]:
    camp = bindings['NeutralMinionCamps'][index]
    assert camp['Groups'] == {1: group}
    matching = [v for v in locators if v.get('name', '').lower() == lookup.lower()]
    assert len(matching) == 1
    lookup_pc = next(pc for pc in range(1, len(functions['<main>']['words']) + 1)
                     if instruction(functions['<main>'], pc)['op'] == 'LOADK' and
                     instruction(functions['<main>'], pc)['operands'][1] == {'constant': lookup})
    anchor = next(v for v in map_pin['records']['campEntities'] if
                  map_pin['records']['identifiers'][v['record']['NeutralCamp']['CampIdentifier']]['CampName'] == camp['Name'])
    camps.append(dict(index=index, name=camp['Name'], side=side, anchorEntity=anchor['key'],
                      members=[dict(character='Sru_Crab', spawnClip='crab_hide', lookup=lookup, locator=matching[0],
                                    lookupEvidence=window('<main>', lookup_pc - 1, lookup_pc + 1))],
                      settings={k: camp[k] for k in ['SpawnDuration', 'VisualFacing', 'GroupsRespawnTime', 'GroupDelaySpawnTime', 'AIScript']}))
result = dict(parents={k: dict(path=str(p), sha256=sha(p.read_bytes())) for k, p in parents.items()},
              extraction=archive.provenance(), labelEvidence=label_evidence, records=records,
              models=models, scriptExtraction=script_archive.provenance(), scriptInventory=script_inventory, evidence=evidence, camps=camps, rivers=rivers,
              status='Original base rigs and legacy coordinated Scuttler construction and full recursive river/component script inventory. SkinOverrides is an unresolved external global; base skin 0 is a local selection. Active native initialization, scaling, patience, full reward formulas and effects/audio remain unverified.')
# Numeric Lua literal table keys become JSON strings; compare canonical carriers.
result = json.loads(json.dumps(result))
if old:
    if old != result:
        (ROOT / 'mismatched-pin.json').write_text(json.dumps(result, indent=2) + '\n')
    assert old == result, 'Scuttler source pin changed'
else:
    PIN.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(dict(camps=len(camps), files=len(archive.outputs), models=list(models), settings=[c['settings'] for c in camps], repeatMatches=old == result)))
