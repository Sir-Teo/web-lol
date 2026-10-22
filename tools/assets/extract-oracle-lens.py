"""Pin Oracle Lens metadata, original visual dependencies and static Lua chunks.

The frozen export supplies item/spell/VFX records. It does not establish native
callback dispatch. Reproduction needs finite names, not discovery dictionaries.
"""
import json
from pathlib import Path
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive, sha
from lua51 import read_chunk, named_functions, instruction

PIN = Path('docs/reference/oracle-lens-source.json')
ROOT = Path('.cache/oracle-lens')
old = json.loads(PIN.read_text()) if PIN.exists() else None
ward_path = Path('docs/reference/warding-totem-source.json')
ward = json.loads(ward_path.read_text())
paths = dict(items=Path('.cache/jungle-quest/items.json'),
             shared=Path('.cache/smite/shared.json'),
             strings=Path('.cache/smite/strings.json'),
             dataDragon=Path('.cache/jungle-quest/dd-items.json'))
for name, path in paths.items():
    assert sha(path.read_bytes()) == ward[name]['sha256'], f'Frozen {name} export differs'
items = json.loads(paths['items'].read_text())
shared = json.loads(paths['shared'].read_text())
strings = json.loads(paths['strings'].read_text())['entries']
keys = ['Items/3364', 'Items/ItemGroups/Trinket', 'Items/Spells/TrinketSweeperLvl3']
vfx = sorted(items['Items/3364']['mVFXResourceResolver']['resourceMap'].values())
records = {k: items[k] for k in keys + vfx}
dependencies = set()
def collect(value):
    if isinstance(value, dict):
        for child in value.values(): collect(child)
    elif isinstance(value, list):
        for child in value: collect(child)
    elif isinstance(value, str) and value.lower().startswith('assets/') and value.lower().endswith(('.skn', '.skl', '.anm', '.scb', '.tex', '.dds')):
        dependencies.add(value.lower())
for key in vfx: collect(records[key])
assert len(dependencies) == 21, 'Review changed visual dependency scope'
toc = 'data/final/global.wad.subchunktoc'
names = {f'{xxh64_intdigest(p):016x}': p for p in sorted(dependencies) + [toc]}
a = RiotArchive(names, old['extraction'] if old else None,
                archive_name='DATA/FINAL/Global.wad.client')
a.extract(sorted(dependencies), ROOT/'original')
script_files = ['data/items/3364.luabin64'] + [f'data/spells/{name}.luabin64' for name in
    ['trinketsweeperlvl3', 'trinketsweeperpersist', 'trinketsweeperpersistvfx',
     'relicminorspotter', 'relicgreaterspotter', 'warddisable']]
b = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in script_files},
                old['scriptExtraction'] if old else None,
                archive_name='DATA/FINAL/Scripts.wad.client')
present = [p for p in script_files if p in b.entries]
missing = [p for p in script_files if p not in b.entries]
b.extract(present, ROOT/'scripts')
inventory = {p: {name: dict(constants=f['constants'], codeSha256=f['codeSha256'],
    children=len(f['children']), instructions=[instruction(f, pc) for pc in range(1, len(f['words'])+1)])
    for name, f in named_functions(read_chunk((ROOT/'scripts'/p).read_bytes())).items()}
    for p in present}
shared_keys = ['Shared/Spells/RelicMinorSpotter', 'Shared/Spells/RelicGreaterSpotter',
               'Shared/Spells/WardDisable', 'Shared/Spells/SightWardStealth']
text_keys = ['item_3364_name', 'item_3364_active', 'item_3364_activeextended',
    'item_3364_inventoryonlytext', 'item_3364_activeexternal',
    'generatedtip_item_3364_description', 'generatedtip_item_3364_externaldescription',
    'generatedtip_item_3364_tooltipinventoryextended', 'game_buff_tooltip_trinketsweeperlvl3']
result = dict(referenceVersion='16.18.8175716',
    parent=dict(path=str(ward_path), sha256=sha(ward_path.read_bytes())),
    extraction=a.provenance(), scriptExtraction=b.provenance(), scriptInventory=inventory,
    missingScriptPaths=missing,
    items=dict(url=ward['items']['url'], sha256=sha(paths['items'].read_bytes()), records=records),
    shared=dict(url=ward['shared']['url'], sha256=sha(paths['shared'].read_bytes()),
                records={k: shared[k] for k in shared_keys}),
    strings=dict(url=ward['strings']['url'], sha256=sha(paths['strings'].read_bytes()),
                 entries={k: strings[k] for k in text_keys}),
    dataDragon=dict(url=ward['dataDragon']['url'], sha256=sha(paths['dataDragon'].read_bytes()),
                    item=json.loads(paths['dataDragon'].read_text())['data']['3364']),
    icon=next(f for f in json.loads(Path('public/assets/reference-manifest.json').read_text())['assets']
              if f['path'] == '/assets/icons/3364.png'),
    published=dict(duration=dict(url='https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/', seconds=8),
        charges=dict(url='https://www.leagueoflegends.com/en-us/news/game-updates/patch-13-10-notes/',
            maxCharges=2, earlyRechargeSeconds=160, lateRechargeSeconds=100,
            ownerAttackVisionSeconds=2,
            scope='Historical patch; current duration is superseded by 26.1 and frozen item records. Native attack continuation binding is not recovered.')),
    limits=[
        'Item/spell/VFX metadata comes from a frozen hashed export, not a recovered original item BIN or executable callback.',
        'GameTimeThreshold=14 and MaxAmmoPre=1 are retained without inferring activation semantics. Current ordinary spell ammo slots are 2; the final slot is -1.',
        'Starting/ending radius and recharge endpoints do not establish the level aggregation, interpolation, sampling phase, swap conversion or detection cadence.',
        'The authored particle lifetimes retain approximately ten-second values; they do not override the current eight-second gameplay duration.',
        'The retained external active string still says six seconds; current dynamic strings, item duration and the published 26.1 change say eight.',
        'Static resource names and script inventories do not prove executed detection, disabled vision, hidden-unit outlines, death/swap behavior or material dispatch.'])
if old:
    if old != result: (ROOT/'mismatched-pin.json').write_text(json.dumps(result, indent=2)+'\n')
    assert old == result, 'Oracle Lens source differs from pin'
else: PIN.write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(dict(visualFiles=len(a.outputs), visualBytes=sum(f['bytes'] for f in a.outputs),
    scripts=len(b.outputs), missingScripts=missing, repeatMatches=old==result)))
