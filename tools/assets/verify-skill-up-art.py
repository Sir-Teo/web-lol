"""Verify original atlas bytes and measured CSS regions; state assignment is visual inference."""
import hashlib
import json
import re
import struct
from pathlib import Path
pin = json.loads(Path('docs/reference/skill-up-art.json').read_text())
raw = Path('public' + pin['path']).read_bytes()
assert hashlib.sha256(raw).hexdigest() == pin['sha256']
assert len(raw) == pin['bytes']
assert list(struct.unpack('>II', raw[16:24])) == pin['dimensions']
manifest = json.loads(Path('public/assets/reference-manifest.json').read_text())
assert next(a for a in manifest['assets'] if a['path'] == pin['path']) == {k: pin[k] for k in ['path', 'source', 'sha256', 'bytes']}
css = Path('src/style.css').read_text()
selectors = {'idle': r'\.spell-learn', 'hover': r'\.spell-learn:focus-visible', 'pressed': r'\.spell-learn:active'}
for name, selector in selectors.items():
    body = re.search(selector + r'\s*\{([^}]+)\}', css).group(1)
    coords = re.search(r'background-position:\s*([\d.-]+)px\s+([\d.-]+)px', body)
    x,y,width,height = pin['regions'][name]
    assert width == height
    scale = pin['displaySize'] / width
    assert abs(float(coords[1]) + x * scale) < 1e-6
    assert abs(float(coords[2]) + y * scale) < 1e-6
print('Verified source atlas and three measured skill-up regions; semantic state mapping remains inferred')
