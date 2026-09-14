"""Pin unmodified PNG texels; Canvas 2D loses RGB precision at low alpha."""
import hashlib
import json
from pathlib import Path
from PIL import Image

cases = [
    ('trail', 'lux_base_q_trail', 'lux_base_r_rainbowmult', (64,64), (8,1)),
    ('trail', 'lux_base_q_trail', 'lux_base_r_rainbowmult', (64,32), (32,2)),
    ('trail', 'lux_base_q_trail', 'lux_base_r_rainbowmult', (48,80), (56,3)),
    ('crescent', 'ring04', 'color-rampdown', (132,187), (1,0)),
    ('crescent', 'ring04', 'color-rampdown', (132,187), (32,2)),
    ('crescent', 'ring04', 'color-rampdown', (128,128), (63,3)),
    ('hoop', 'lux_base_r_mote', 'color-spectralbell', (61,61), (35,34)),
    ('hoop', 'lux_base_r_mote', 'color-spectralbell', (80,42), (12,49)),
    ('hoop', 'lux_base_r_mote', 'color-spectralbell', (64,64), (63,0)),
]
pin = json.loads(Path('docs/reference/lux-basic-attack.json').read_text())
images, files = {}, {}
for name in sorted({name for _,a,b,_,_ in cases for name in (a,b)}):
    path = f'public/assets/effects/lux-ba-{name}.png'
    raw = Path(path).read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    assert any(t['output'] == path and t['pngSha256'] == digest for t in pin['textures'])
    images[name] = Image.open(path).convert('RGBA')
    files[path] = digest
samples = []
mult = images['lux_base_r_rainbowmult']
for emitter, source, lookup, sp, lp in cases:
    image = images[lookup]
    mp = (int((lp[0] + .5) / image.width * mult.width), int((lp[1] + .5) / image.height * mult.height))
    samples.append({'emitter': emitter, 'sourcePixel': sp, 'lookupPixel': lp,
                    'sourceRgba': images[source].getpixel(sp), 'lookupRgba': image.getpixel(lp),
                    'multiplierRgba': mult.getpixel(mp)})
report = json.loads(json.dumps({'files': files, 'samples': samples}))
output = Path('docs/reference/particle-color-samples.json')
if output.exists():
    assert json.loads(output.read_text()) == report, 'Pinned RGBA samples changed'
else:
    output.write_text(json.dumps(report, indent=2) + '\n')
print(f'Verified {len(samples)} source/lookup/multiplier samples against pinned PNG hashes')
