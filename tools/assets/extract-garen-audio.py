"""Selectively extract Garen's pinned base SFX banks, excluding voice-over banks."""
from pathlib import Path
import json
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive

skin = json.loads(Path('docs/reference/garen-model.json').read_text())['skin']['data']['Characters/Garen/Skins/Skin0']
unit = next(u for u in skin['skinAudioProperties']['bankUnits'] if u['name'] == 'Garen_Base_SFX')
paths = [p.lower() for p in unit['bankPath']]
assert paths == [f'assets/sounds/wwise2016/sfx/characters/garen/skins/base/garen_base_sfx_{kind}.bnk' for kind in ['audio', 'events']]
toc = 'data/final/champions/garen.wad.subchunktoc'
pin_path = Path('docs/reference/garen-audio-extraction.json')
pin = json.loads(pin_path.read_text()) if pin_path.exists() else None
archive = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in paths + [toc]}, pin,
    archive_name='DATA/FINAL/Champions/Garen.wad.client')
archive.extract(paths, '.cache/garen-audio-sources')
provenance = archive.provenance()
if pin is None: pin_path.write_text(json.dumps(provenance, indent=2) + '\n')
else: assert provenance == pin, 'Garen audio source provenance changed'
print(json.dumps(dict(files=provenance['files'], compressedBytes=sum(c['bytes'] for c in archive.reads.values()))))
