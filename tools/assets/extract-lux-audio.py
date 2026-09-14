"""Selectively extract and verify pinned Lux base sound-event/audio banks.

Run with PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python.
Banks stay in the source cache; this does not decode, map events or ship audio.
"""
from pathlib import Path
import json
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive

paths = [
    'assets/sounds/wwise2016/sfx/characters/lux/skins/base/lux_base_sfx_audio.bnk',
    'assets/sounds/wwise2016/sfx/characters/lux/skins/base/lux_base_sfx_events.bnk',
]
skin = json.loads(Path('docs/reference/lux-model.json').read_text())['skin']['data']['Characters/Lux/Skins/Skin0']
unit = next(u for u in skin['skinAudioProperties']['bankUnits'] if u['name'] == 'Lux_Base_SFX')
assert paths == [p.lower() for p in unit['bankPath']]
assert 'Play_sfx_Lux_LuxIlluminationPassive_hit' in unit['events']
toc = 'data/final/champions/lux.wad.subchunktoc'
pin_path = Path('docs/reference/lux-audio-extraction.json')
pin = json.loads(pin_path.read_text()) if pin_path.exists() else None
archive = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in paths + [toc]}, pin,
    archive_name='DATA/FINAL/Champions/Lux.wad.client')
archive.extract(paths, Path('.cache/lux-audio-sources'))
provenance = archive.provenance()
if pin is None:
    pin_path.write_text(json.dumps(provenance, indent=2)+'\n')
else:
    assert provenance == pin, 'Audio source provenance changed'
print(json.dumps(dict(files=provenance['files'], compressedBytes=sum(c['bytes'] for c in archive.reads.values()))))
