"""Decode all seventeen retained Daybreak TEX dependencies without resizing pixels."""
from pathlib import Path
from io import BytesIO
import hashlib
import json
from PIL import Image
from cdtb.export import TexConverter

sha = lambda b: hashlib.sha256(b).hexdigest()
pin_path = Path('docs/reference/leona-q-particles.json')
pin = json.loads(pin_path.read_text())
root = Path('.cache/leona-q-particle-sources')
textures = []
for source in pin['extraction']['files']:
    suffix = Path(source['path']).suffix
    raw = (root / (source['wadPathHash'] + suffix)).read_bytes()
    assert len(raw) == source['bytes'] and sha(raw) == source['sha256']
    if suffix == '.bin': continue
    assert suffix == '.tex'
    image = Image.open(BytesIO(TexConverter.tex_to_dds(raw))).convert('RGBA')
    output = Path('public/assets/effects') / (Path(source['path']).stem + '.png')
    if output.exists():
        existing = Image.open(output).convert('RGBA')
        assert existing.size == image.size and existing.tobytes() == image.tobytes(), output
    else: image.save(output)
    textures.append(dict(source=source, path=str(output), width=image.width, height=image.height,
        bytes=output.stat().st_size, sha256=sha(output.read_bytes()), rgbaSha256=sha(image.tobytes())))
assert len(textures) == 17
result = dict(sourcePinSha256=sha(pin_path.read_bytes()), textures=textures,
    decoder=dict(path='.tools/cdtb/cdtb/export.py', sha256=sha(Path('.tools/cdtb/cdtb/export.py').read_bytes())))
Path('docs/reference/leona-q-particles-decoded.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(dict(textures=len(textures), pngBytes=sum(t['bytes'] for t in textures))))
