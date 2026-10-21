"""Close Champ_Kill's texture dependencies against the frozen Garen archive.

The complete definition is verified by pin-garen-r-kill-audio.py. Keep its
original pin stable so adding visuals cannot invalidate the existing audio pins.
"""
from pathlib import Path
from io import BytesIO
import hashlib
import json
from PIL import Image
from cdtb.export import TexConverter
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive

sha = lambda raw: hashlib.sha256(raw).hexdigest()
link_path = Path('docs/reference/garen-r-kill-audio-link.json')
link = json.loads(link_path.read_text())
pin_path = Path('docs/reference/garen-r-kill-particles.json')
pin = json.loads(pin_path.read_text()) if pin_path.exists() else None
source = json.loads(Path('docs/reference/garen-r-particles.json').read_text())
assert link['particlePinSha256'] == sha(Path('docs/reference/garen-r-particles.json').read_bytes())
assert link['sourceFile'] in source['extraction']['files']
raw_bin = (Path('.cache/garen-r-particle-sources') / (link['sourceFile']['wadPathHash']+'.bin')).read_bytes()
assert sha(raw_bin) == link['sourceFile']['sha256']

def strings(value):
    if isinstance(value, dict):
        for child in value.values(): yield from strings(child)
    elif isinstance(value, list):
        for child in value: yield from strings(child)
    elif isinstance(value, str): yield value

paths = sorted({s.lower() for s in strings(link['definition']) if s.lower().startswith('assets/')})
assert len(paths) == 7 and all(p.endswith('.tex') for p in paths)
archive = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in [*paths, 'data/final/champions/garen.wad.subchunktoc']},
                      pin['extraction'] if pin else None, archive_name='DATA/FINAL/Champions/Garen.wad.client')
root = Path('.cache/garen-r-kill-particle-sources')
archive.extract(paths, root, flat=True)
textures = []
for entry in archive.provenance()['files']:
    raw = (root / (entry['wadPathHash']+'.tex')).read_bytes()
    assert len(raw) == entry['bytes'] and sha(raw) == entry['sha256']
    image = Image.open(BytesIO(TexConverter.tex_to_dds(raw))).convert('RGBA')
    output = Path('public/assets/effects') / (Path(entry['path']).stem+'.png')
    if output.exists():
        existing = Image.open(output).convert('RGBA')
        assert existing.size == image.size and existing.tobytes() == image.tobytes(), output
    else: image.save(output)
    textures.append(dict(source=entry, path=str(output), width=image.width, height=image.height,
        bytes=output.stat().st_size, sha256=sha(output.read_bytes()), rgbaSha256=sha(image.tobytes())))
result = dict(sourceLinkSha256=sha(link_path.read_bytes()), extraction=archive.provenance(), textures=textures)
if pin: assert result == pin, 'Champ_Kill source/decoded provenance changed'
else: pin_path.write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(dict(textures=len(textures), pngBytes=sum(t['bytes'] for t in textures))))
