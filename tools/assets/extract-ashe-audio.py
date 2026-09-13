"""Selectively extract and verify pinned Ashe base sound-event/audio banks.

Run with PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python.
Banks stay in the source cache; this does not decode, map events or ship audio.
"""
from pathlib import Path
import json
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive

paths = [
    'assets/sounds/wwise2016/sfx/characters/ashe/skins/base/ashe_base_sfx_audio.bnk',
    'assets/sounds/wwise2016/sfx/characters/ashe/skins/base/ashe_base_sfx_events.bnk',
]
toc = 'data/final/champions/ashe.wad.subchunktoc'
pin_path = Path('docs/reference/ashe-audio-extraction.json')
pin = json.loads(pin_path.read_text()) if pin_path.exists() else None
archive = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in paths + [toc]}, pin,
    archive_name='DATA/FINAL/Champions/Ashe.wad.client')
archive.extract(paths, Path('.cache/ashe-audio-sources'))
provenance = archive.provenance()
if pin is None:
    pin_path.write_text(json.dumps(provenance, indent=2)+'\n')
else:
    assert provenance == pin, 'Audio source provenance changed'
print(json.dumps(dict(files=provenance['files'], compressedBytes=sum(c['bytes'] for c in archive.reads.values()))))
