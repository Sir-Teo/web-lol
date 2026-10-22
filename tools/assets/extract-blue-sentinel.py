"""Pin Blue camp construction, locators, conflicting skin data and script stubs."""
import io
import json
from pathlib import Path
from cdtb import binfile
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive, sha
from lua51 import read_chunk, named_functions, instruction, data_block

PIN = Path('docs/reference/blue-sentinel-source.json')
ROOT = Path('.cache/blue-sentinel')
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
for label in ['locators', 'transform', 'name', 'MapLocator']:
    fields[binfile.compute_binhash(label)] = label
    types[binfile.compute_binhash(label)] = label
skin_key = 'Characters/SRU_Blue/Skins/Skin4'
names[binfile.compute_binhash(skin_key)] = skin_key
for table, values in [(binfile.hashfile_binfields, fields), (binfile.hashfile_bintypes, types),
                      (binfile.hashfile_binentries, names), (binfile.hashfile_binhashes, names),
                      (binfile.hashfile_binpaths, assets)]:
    table.hashes = values
files = ['data/characters/sru_blue/skins/skin4.bin', 'data/characters/sru_blue/animations/skin4.bin']
paths = json.loads(Path('docs/reference/map-wad-paths.json').read_text())
paths.update({f'{xxh64_intdigest(p):016x}': p for p in files})
archive = RiotArchive(paths, old['skinExtraction'] if old else None)
archive.extract(files, ROOT)
records = {p: json.loads(json.dumps(binfile.BinFile(io.BytesIO((ROOT / p).read_bytes())).to_serializable())) for p in files}
scripts = ['data/characters/sru_blue/charscriptsru_blue.luabin64',
           'data/shared/spells/crestoftheancientgolem.luabin64',
           'data/shared/spells/crestoftheancientgolemaura.luabin64']
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


evidence = dict(group=window('<main>', 921, 928), order=window('NeutralMinionInit', 280, 346),
                chaos=window('NeutralMinionInit', 681, 747))
group = data_block(evidence['group']['instructions'], {'CAMPTYPE_BLUEBUFF': 'blue'}, {0: {}})[0]['blue']
assert group == {1: {1: 'SRU_Blue', 2: 'spawn'}}
bindings = dict(START_OF_GAME_MONSTER_SPAWN_DELAY=22, CAMP_TIME_OFFSET=1, TEAM_ORDER=100,
                TEAM_CHAOS=200, CAMPTYPE_BLUEBUFF='blue', PredefinedCamps={'blue': group},
                SkinOverrides={'SRU_Blue': 0}, Make3DPoint='Make3DPoint', NeutralMinionCamps={1: {}, 7: {}})
for key in ['order', 'chaos']:
    data_block(evidence[key]['instructions'], bindings)
map_pin = parent['jungle-map-source']
file = next(f for f in map_pin['extraction']['files'] if f['path'].endswith('/map11.bin'))
raw = (Path('.cache/jungle-sources') / (file['wadPathHash'] + '.bin')).read_bytes()
assert sha(raw) == file['sha256']
definition = json.loads(json.dumps(binfile.BinFile(io.BytesIO(raw)).to_serializable()))
locators = definition['{a250382e}']['locators']
camps = []
for index, lookup in [(1, 'OrderBlueBuff1'), (7, 'ChaosBlueBuff1')]:
    matching = [v for v in locators if v.get('name', '').lower() == lookup.lower()]
    assert len(matching) == 1
    camp = bindings['NeutralMinionCamps'][index]
    assert camp['Groups'] == {1: group} and camp['GroupsRespawnTime'] == 300 and camp['SpawnDuration'] == 1.1
    anchor = next(v for v in map_pin['records']['campEntities'] if
                  map_pin['records']['identifiers'][v['record']['NeutralCamp']['CampIdentifier']]['CampName'] == camp['Name'])
    lookup_pc = next(pc for pc in range(1, len(functions['<main>']['words']) + 1)
                     if instruction(functions['<main>'], pc)['op'] == 'LOADK' and
                     instruction(functions['<main>'], pc)['operands'][1] == {'constant': lookup})
    camps.append(dict(index=index, name=camp['Name'], lookup=lookup, locator=matching[0], anchorEntity=anchor['key'],
                      group=[dict(character='SRU_Blue', animation='spawn')],
                      settings={k: camp[k] for k in ['GroupsRespawnTime', 'SpawnDuration', 'LeashRadius', 'VisualFacing']},
                      lookupEvidence=window('<main>', lookup_pc - 1, lookup_pc + 1)))
skin = records[files[0]][skin_key]
assert skin['championSkinName'] == 'SRU_Blue_Baron'
graph_key = skin['skinAnimationProperties']['animationGraphData']
graph = records[files[1]][graph_key]
selected = {files[0]: {skin_key: skin}, files[1]: {graph_key: {
    '__type': graph['__type'], 'mCascadeBlendValue': graph['mCascadeBlendValue'],
    'atomicSources': {k: v['mAnimationResourceData']['mAnimationFilePath']
                      for k, v in graph['mClipDataMap'].items() if v['__type'] == 'AtomicClipData'}}}}
result = dict(parents={k: dict(path=str(p), sha256=sha(p.read_bytes())) for k, p in parents.items()},
              skinExtraction=archive.provenance(), scriptExtraction=script_archive.provenance(),
              skin4Records=selected, scriptInventory=script_inventory, evidence=evidence, camps=camps,
              providedSkinOverride=0,
              skinSelection=dict(localSkin=0, skin4Name=skin['championSkinName'],
                                 status='Map objects and SpawnableUnits include Skin4, a Baron/Voidborn skin. They do not prove native activation. Local normal-skin selection follows the published removal of Baron corruption, pending native validation.',
                                 url='https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/'),
              status='Legacy membership/locators and Root data only. Active native initialization, absent attack range, buff rules and scaling remain unverified. Supplied SkinOverrides=0 is an analysis binding, not an observed native flag.')
if old:
    assert old == result, 'Blue source pin changed'
else:
    PIN.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(dict(camps=len(camps), scripts=len(scripts), skinDefinitions=len(files), repeatMatches=old == result)))
