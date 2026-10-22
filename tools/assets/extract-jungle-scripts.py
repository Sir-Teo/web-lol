"""Pin frozen camp-script evidence. No Lua VM or decompiler is required.

The tiny data-block decoder below accepts only straight-line table construction,
arithmetic and a symbolic Make3DPoint. It cannot follow branches, invoke scripts,
or answer whether these legacy scripts are enabled by the actual game server.
"""
import io
import json
from pathlib import Path

from cdtb import binfile
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive, sha
from lua51 import read_chunk, named_functions, instruction, data_block

PIN = Path('docs/reference/jungle-script-source.json')
ROOT = Path('.cache/jungle-camp-research/sources')
SHARED = 'data/shared/scripts/sr_neutralminionspawn.luabin64'
LEVEL = 'data/shared/scripts/sr_levelscript.luabin64'
FILES = [
    'levels/map11/scripts/levelscript.luabin64',
    'levels/map11/scripts/neutralminionspawn.luabin64',
    'levels/map11/scripts/neutralminionspawn_srx.luabin64',
    'levels/map11/scripts/campspawnmarkers.luabin64',
    'data/characters/sru_gromp/charscriptsru_gromp.luabin64',
    'data/characters/sru_gromp/spells/sru_grompbasicattack.luabin64',
    'data/spells/modules/junglecampspawn.luabin64', SHARED, LEVEL,
]
old = json.loads(PIN.read_text()) if PIN.exists() else None
paths = {f'{xxh64_intdigest(p):016x}': p for p in FILES}
archive = RiotArchive(paths, old['extraction'] if old else None,
                      archive_name='DATA/FINAL/Scripts.wad.client')
archive.extract(FILES, ROOT)
parsed = {p: named_functions(read_chunk((ROOT / p).read_bytes())) for p in FILES}


def window(path, function, first, last):
    proto = parsed[path][function]
    return dict(path=path, function=function, codeSha256=proto['codeSha256'],
                firstPc=first, lastPc=last,
                instructions=[instruction(proto, pc) for pc in range(first, last + 1)])




evidence = {}
for name, function, first, last in [
    ('defaults', 'SetupNeutralMinionSpawnDefaults', 1, 8),
    ('spawnLookups', '<main>', 190, 216),
    ('grompGroup', '<main>', 929, 936),
    ('campDefaults', 'NeutralMinionInit', 53, 113),
    ('orderGromp', 'NeutralMinionInit', 1046, 1091),
    ('chaosGromp', 'NeutralMinionInit', 1092, 1137),
    ('overrideAndDictionaries', 'NeutralMinionInit', 1329, 1380),
    ('nativeBridgeGuard', 'NeutralMinionInit', 1383, 1415),
]:
    evidence[name] = window(SHARED, function, first, last)
evidence['dynamicSpawnScriptSelection'] = window(LEVEL, 'OnLevelInit', 209, 216)
evidence['srxWrapper'] = window(FILES[2], '<main>', 1, 10)

# Decode the literal defaults from adjacent LOADK/SETGLOBAL pairs.
defaults = {}
items = evidence['defaults']['instructions']
for load, store in zip(items[::2], items[1::2]):
    assert load['op'] == 'LOADK' and store['op'] == 'SETGLOBAL'
    assert load['operands'][0] == store['operands'][0]
    defaults[store['operands'][1]['constant']] = load['operands'][1]['constant']
assert defaults == dict(MINION_SPAWN_START_TIME=65, START_OF_GAME_MONSTER_SPAWN_DELAY=22,
                        RED_BLUE_OFFSET=2, CAMP_TIME_OFFSET=1)
group = data_block(evidence['grompGroup']['instructions'],
                   {'CAMPTYPE_OWLBEAR': 'owlbear'}, {0: {}})[0]['owlbear']
assert group == {1: {1: 'SRU_Gromp', 2: 'spawn'}}
respawn_store = next(i for i in evidence['campDefaults']['instructions'] if
                     i['op'] == 'SETTABLE' and i['operands'][1] == {'constant': 'GroupsRespawnTime'})
assert respawn_store['operands'] == [5, {'constant': 'GroupsRespawnTime'}, {'constant': 135}]

globals_ = {**defaults, 'NeutralMinionCamps': {13: {}, 14: {}},
            'CAMPTYPE_OWLBEAR': 'owlbear', 'PredefinedCamps': {'owlbear': group},
            'TEAM_ORDER': 100, 'TEAM_CHAOS': 200, 'Make3DPoint': 'Make3DPoint'}
for key in ['orderGromp', 'chaosGromp']:
    # The four preceding instructions check whether the camp table exists.
    # Decode only the branch body; this does not assert branch reachability.
    data_block(evidence[key]['instructions'][4:], globals_)

# Read original map bytes with a finite set of FNV-verified labels, not a JSON
# mirror or the ambient discovery dictionaries. Keep locator and camp separate.
map_pin_path = Path('docs/reference/jungle-map-source.json')
map_pin = json.loads(map_pin_path.read_text())
labels = ['locators', 'transform', 'name', 'MapLocator']
for table in [binfile.hashfile_binfields, binfile.hashfile_bintypes]:
    table.hashes = {binfile.compute_binhash(s): s for s in labels}
for table in [binfile.hashfile_binentries, binfile.hashfile_binhashes, binfile.hashfile_binpaths]:
    table.hashes = {}
map_file = next(f for f in map_pin['extraction']['files'] if f['path'].endswith('/map11.bin'))
map_path = Path('.cache/jungle-sources') / (map_file['wadPathHash'] + '.bin')
raw = map_path.read_bytes()
assert len(raw) == map_file['bytes'] and sha(raw) == map_file['sha256']
definition = json.loads(json.dumps(binfile.BinFile(io.BytesIO(raw)).to_serializable()))
locators = definition['{a250382e}']['locators']
camps = []
for index, lookup, pc in [(13, 'OrderOwlbear', 192), (14, 'ChaosOwlbear', 197)]:
    proto = parsed[SHARED]['<main>']
    assert instruction(proto, pc)['operands'][1] == {'constant': lookup}
    matched = [v for v in locators if v.get('name', '').lower() == lookup.lower()]
    assert len(matched) == 1 and matched[0]['__type'] == 'MapLocator'
    locator = matched[0]
    camp = globals_['NeutralMinionCamps'][index]
    assert camp['Groups'] == {1: group} and camp['GroupsChance'] == {1: 100}
    anchor = next(v for v in map_pin['records']['campEntities'] if
                  map_pin['records']['identifiers'][v['record']['NeutralCamp']['CampIdentifier']]['CampName'] == camp['Name'])
    camps.append(dict(index=index, name=camp['Name'], group=[dict(character='SRU_Gromp', animation='spawn')],
                      lookup=lookup, locator=locator, anchorEntity=anchor['key'],
                      literalSettings={k: camp[k] for k in ['GroupDelaySpawnTime', 'GroupBuffSide', 'SpawnDuration', 'LeashRadius', 'VisualFacing']},
                      legacyFirstSpawnSeconds=camp['GroupDelaySpawnTime'] + defaults['MINION_SPAWN_START_TIME'],
                      legacyRespawnSeconds=respawn_store['operands'][2]['constant']))

inventory = {p: {name: dict(codeSha256=v['codeSha256'], instructionCount=len(v['words']),
                           constants=v['constants']) for name, v in functions.items()}
             for p, functions in parsed.items() if len(functions) == 1}
result = dict(extraction=archive.provenance(), mapSourcePin=str(map_pin_path),
              mapSourcePinSha256=sha(map_pin_path.read_bytes()), sourceABI='Lua 5.1 LE int4 size_t8 instruction4 number8 float',
              evidence=evidence, smallScriptInventory=inventory, camps=camps,
              status='Static legacy script data. Active mutator selection and RawLSDeprecationNeutralMinions are unknown. The 99-second legacy first spawn conflicts with the published 26.1 67-second baseline; this pin is not an enabled live calendar.')
if old:
    assert old == result, 'Pinned camp script evidence changed'
else:
    PIN.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(dict(files=len(FILES), camps=len(camps), evidenceWindows=len(evidence), repeatMatches=old == result)))
