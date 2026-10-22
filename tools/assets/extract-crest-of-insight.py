"""Pin frozen Riot Crest tooltips and the script-selected source icon."""
import json
from pathlib import Path
from PIL import Image
from cdtb.rstfile import RstFile
from riot_archive import RiotArchive, sha

PIN = Path('docs/reference/crest-of-insight-source.json')
ROOT = Path('.cache/crest-of-insight')
old = json.loads(PIN.read_text()) if PIN.exists() else None
parent_path = Path('docs/reference/blue-sentinel-source.json')
parent = json.loads(parent_path.read_text())
script = parent['scriptInventory']['data/shared/spells/crestoftheancientgolem.luabin64']
assert 'BuffCampBlue.dds' in script['constants']

locale_path = 'data/menu/en_us/lol.stringtable'
locale = RiotArchive({'062d6ed714bff7df': locale_path},
                     old['localization'] if old else None,
                     archive_name='DATA/FINAL/Localized/Global.en_US.wad.client')
locale.extract([locale_path], ROOT)
rst = RstFile(str(ROOT / locale_path), game_version=1618)
keys = {'blueMonsterTooltip': 46786458625, 'buffName': 258206257612,
        'buffTooltip': 259795327118}
strings = {label: {'rstHash': str(key), 'value': rst.entries[key]} for label, key in keys.items()}
assert 'for 2 minutes' in strings['blueMonsterTooltip']['value']
assert '300 second respawn' in strings['blueMonsterTooltip']['value']
assert all(f'@f{i}@' in strings['buffTooltip']['value'] for i in [1, 2, 3])
assert 'transferred to their killer' in strings['buffTooltip']['value']

icon_path = 'data/spells/icons2d/buffcampblue.dds'
icon = RiotArchive({'43a79e062be11439': icon_path}, old['iconExtraction'] if old else None,
                   archive_name='DATA/FINAL/DATA.wad.client')
icon.extract([icon_path], ROOT)
image = Image.open(ROOT / icon_path).convert('RGBA')
assert image.size == (64, 64)
output = Path('public/assets/icons/buffcampblue.png')
output.parent.mkdir(parents=True, exist_ok=True)
image.save(output)

result = {
    'parent': {'path': str(parent_path), 'sha256': sha(parent_path.read_bytes())},
    'localization': locale.provenance(), 'rstVersion': rst.version,
    'rstHashBits': rst.hash_bits, 'strings': strings,
    'iconExtraction': icon.provenance(),
    'icon': {'path': str(output), 'sha256': sha(output.read_bytes()),
             'width': image.width, 'height': image.height, 'conversion': 'Pillow DDS to RGBA PNG'},
    'officialNotes': [
        {'url': 'https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-14-notes/',
         'fact': 'Blue buff ability haste changed from 10 to 10/15/20 at levels 1/6/11.'},
        {'url': 'https://www.leagueoflegends.com/en-us/news/game-updates/patch-11-16-notes/',
         'fact': 'Fixed loss of red/blue buffs on execution to non-epic jungle monsters.'},
        {'url': 'https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/',
         'fact': 'Removed Baron-corrupted buffs and global buff rewards; removed extra 30-second duration for junglers killing champions for buffs. Elemental-terrain second-buff drops remain.'},
    ],
    'limits': [
        'Localized description states two-minute duration and transfer; active native timing and transfer refresh remain unverified.',
        'Mana/energy regeneration formula parameters f2/f3 are unbound in the extracted tooltip.',
        '25 flat plus 5% maximum mana per five seconds and half-second pulses remain provisional local policy.',
        'Transfer uses existing champion kill credit and refreshes duration locally; non-epic uncredited executions retain the original clock.',
        'Elemental-terrain wisps, Smite eligibility, energy champions and native buff VFX/audio remain unfinished.',
    ],
}
if old:
    assert result == old, 'Crest source pin changed'
PIN.write_text(json.dumps(result, indent=2) + '\n')
print('Pinned Crest tooltips, duration/transfer evidence and 64px source icon; regeneration bindings remain unresolved.')
