"""Extract Judgment's inline VFX dependencies from the frozen Riot archive.

Run with PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python.
The already verified skin BIN pin supplies names; bytes come from the WAD.
"""
from pathlib import Path
import json
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive

model = json.loads(Path('docs/reference/garen-model.json').read_text())
record = 'Characters/Garen/Skins/Skin0/Particles/Garen_Base_E_Spin'
effect = model['skin']['data'][record]
paths = set()
def collect(value):
    if isinstance(value, dict):
        for child in value.values(): collect(child)
    elif isinstance(value, list):
        for child in value: collect(child)
    elif isinstance(value, str) and value.lower().startswith('assets/'):
        assert value.lower().endswith(('.scb', '.tex')), value
        paths.add(value.lower())
collect(effect)
paths = sorted(paths)
toc = 'data/final/champions/garen.wad.subchunktoc'
pin_path = Path('docs/reference/garen-spin-extraction.json')
pin = json.loads(pin_path.read_text()) if pin_path.exists() else None
archive = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in paths + [toc]}, pin,
    archive_name='DATA/FINAL/Champions/Garen.wad.client')
archive.extract(paths, '.cache/garen-spin-sources')
provenance = archive.provenance()
if pin is None: pin_path.write_text(json.dumps(provenance, indent=2) + '\n')
else: assert provenance == pin, 'Judgment source provenance changed'
print(json.dumps(provenance['files'], indent=2))
