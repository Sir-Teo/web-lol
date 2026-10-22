"""Pin the shared item banks containing the declared Oracle Death cue.

Discovery checked finite bank labels against original WAD entries. Reproduction
uses only these paths and the source pin, not a discovery dictionary.
"""
import json
from pathlib import Path
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive, sha

pin_path=Path('docs/reference/oracle-audio-extraction.json')
pin=json.loads(pin_path.read_text()) if pin_path.exists() else None
reference=Path('docs/reference/oracle-lens-source.json')
source=json.loads(reference.read_text())
declared=source['items']['records']['Items/3364/Particles/3364_Global_Trinket_Spotter_Death']['soundPersistentDefault']
assert declared=='Play_sfx_TrinketLensLvl1Audio_buffdeactivate'
paths=[f'assets/sounds/wwise2016/sfx/shared/items_global_{kind}.bnk' for kind in ['audio','events']]
archive=RiotArchive({f'{xxh64_intdigest(p):016x}':p for p in paths},
    pin['extraction'] if pin else None,archive_name='DATA/FINAL/Maps/Shipping/Common.wad.client')
archive.extract(paths,'.cache/oracle-audio-sources')
result=dict(referenceSha256=sha(reference.read_bytes()),declaredEvent=declared,
    extraction=archive.provenance(),
    scope='Original shared item bank dependencies for a VFX-declared event. Bank presence and names do not recover native callback dispatch or prove cast/active cues.')
if pin: assert result==pin,'Oracle audio source changed'
else:pin_path.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(dict(files=result['extraction']['files'])))
