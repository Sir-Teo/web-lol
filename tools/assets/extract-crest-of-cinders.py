"""Pin frozen Red-buff tooltips, metadata scripts and the script-selected icon."""
import json
from pathlib import Path
from PIL import Image
from cdtb.rstfile import RstFile
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive, sha
from lua51 import read_chunk, instruction

PIN = Path('docs/reference/crest-of-cinders-source.json')
ROOT = Path('.cache/crest-of-cinders')
old = json.loads(PIN.read_text()) if PIN.exists() else None
parent_path = Path('docs/reference/red-brambleback-source.json')
scripts = ['data/spells/blessingofthelizardelder.luabin64',
           'data/spells/blessingofthelizardelderslow.luabin64']
script = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in scripts},
                     old['scripts'] if old else None, archive_name='DATA/FINAL/Scripts.wad.client')
script.extract(scripts, ROOT)
inventory = {}
for p in scripts:
    proto = read_chunk((ROOT / p).read_bytes())
    inventory[p] = dict(constants=proto['constants'], codeSha256=proto['codeSha256'],
                        instructions=[instruction(proto, pc) for pc in range(1, len(proto['words']) + 1)])
assert 'BuffCampRed.dds' in inventory[scripts[0]]['constants']
locale_path = 'data/menu/en_us/lol.stringtable'
locale = RiotArchive({'062d6ed714bff7df': locale_path}, old['localization'] if old else None,
                     archive_name='DATA/FINAL/Localized/Global.en_US.wad.client')
locale.extract([locale_path], ROOT)
rst = RstFile(str(ROOT / locale_path), game_version=1618)
keys = {'redMonsterTooltip': 45500707963, 'buffTooltip': 149227494118}
strings = {k: dict(rstHash=str(h), value=rst.entries[h]) for k, h in keys.items()}
assert 'for 2 minutes' in strings['redMonsterTooltip']['value']
assert 'transferred to their killer' in strings['buffTooltip']['value']
assert 'champions, turrets or epic monsters' in strings['buffTooltip']['value']
assert all(f'@f{i}@' in strings['buffTooltip']['value'] for i in range(1, 5))
icon_path = 'data/spells/icons2d/buffcampred.dds'
icon = RiotArchive({'8d260602765e0949': icon_path}, old['iconExtraction'] if old else None,
                   archive_name='DATA/FINAL/DATA.wad.client')
icon.extract([icon_path], ROOT)
image = Image.open(ROOT / icon_path).convert('RGBA')
assert image.size == (64, 64)
output = Path('public/assets/icons/buffcampred.png')
image.save(output)
result = dict(parent=dict(path=str(parent_path), sha256=sha(parent_path.read_bytes())),
              scripts=script.provenance(), scriptInventory=inventory,
              localization=locale.provenance(), strings=strings, rstVersion=rst.version, rstHashBits=rst.hash_bits,
              iconExtraction=icon.provenance(), icon=dict(path=str(output), sha256=sha(output.read_bytes()),
                width=64, height=64, conversion='Pillow DDS to RGBA PNG'),
              officialNotes=[dict(url='https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/',
                facts=['Healing tiers are 0.5/1/1.5/3% at levels 1/4/6/11.',
                       'Melee slow is 10/15/20%, ranged slow 5/7.5/10%. Burn changed to 15-54.',
                       'Champion transfers no longer gain an extra 30 seconds.']),
                dict(url='https://www.leagueoflegends.com/en-us/news/game-updates/patch-13-14-notes/',
                     fact='The earlier unchanged ranged slow lists level thresholds 1/6/11.'),
                dict(url='https://www.leagueoflegends.com/en-us/news/game-updates/patch-11-16-notes/',
                     fact='Non-epic monster executions no longer remove red/blue buffs.')],
              limits=['Metadata scripts contain no gameplay implementation; formula placeholders remain unbound.',
                      'Local policy linearly interpolates 15-54 total burn over champion levels 1-18, in three ticks at application/+1/+2 seconds.',
                      'The legacy monster tooltip describes three seconds; native pulse dispatch remains unverified.',
                      'Local policy uses a three-second slow, five-second healing lockout and half-second healing pulses.',
                      'A single burn refreshes duration/owner/damage while preserving pulse phase; native overlap/refresh rules remain unverified.',
                      'Elemental wisps/sharing, Smite eligibility, native particles/audio and cumulative burn presentation remain unfinished.'])
if old:
    assert old == result, 'Cinders pin changed'
PIN.write_text(json.dumps(result, indent=2) + '\n')
print('Pinned Cinders metadata, frozen tooltips and 64px icon; native formula/timing bindings remain open.')
