"""Selectively extract Leona's pinned base SFX banks, excluding voice-over banks."""
from pathlib import Path
import json
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive

skin = json.loads(Path('docs/reference/leona-model.json').read_text())['skin']['data']['Characters/Leona/Skins/Skin0']
unit = next(u for u in skin['skinAudioProperties']['bankUnits'] if u['name'] == 'Leona_Base_SFX')
paths = [p.lower() for p in unit['bankPath']]
assert paths == [f'assets/sounds/wwise2016/sfx/characters/leona/skins/base/leona_base_sfx_{kind}.bnk' for kind in ['audio', 'events']]
toc = 'data/final/champions/leona.wad.subchunktoc'
pin_path = Path('docs/reference/leona-audio-extraction.json')
pin = json.loads(pin_path.read_text()) if pin_path.exists() else None
archive = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in paths + [toc]}, pin,
    archive_name='DATA/FINAL/Champions/Leona.wad.client')
archive.extract(paths, '.cache/leona-audio-sources-v1-20261023')
provenance = archive.provenance()
if pin is None: pin_path.write_text(json.dumps(provenance, indent=2) + '\n')
else: assert provenance == pin, 'Leona audio source provenance changed'
print(json.dumps(dict(files=provenance['files'], compressedBytes=sum(c['bytes'] for c in archive.reads.values()))))
