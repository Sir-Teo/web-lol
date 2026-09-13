"""Verify the pinned League stat atlas, regions, and CSS sampling coordinates."""
import hashlib
import json
import re
import struct
from pathlib import Path

pin = json.loads(Path('docs/reference/stat-icons.json').read_text())
raw = Path('.cache/stat-atlas-16.18.json').read_bytes()
assert hashlib.sha256(raw).hexdigest() == pin['sha256']
source = json.loads(raw)
manifest = json.loads(Path('public/assets/reference-manifest.json').read_text())
entry = next(a for a in manifest['assets'] if a['path'] == '/assets/icons/stat-atlas.png')
atlas = Path('public' + entry['path']).read_bytes()
assert hashlib.sha256(atlas).hexdigest() == entry['sha256']
assert len(atlas) == entry['bytes']
width, height = struct.unpack('>II', atlas[16:24])
assert (width, height) == (2048, 256)
css = Path('src/style.css').read_text()
for name, record in pin['icons'].items():
    assert source[record['texture']] == {k: v for k, v in record.items() if k != 'texture'}
    assert entry['source'].endswith('/game/' + record['atlasPath'])
    assert (record['endX'] - record['startX']) * width == 20
    assert (record['endY'] - record['startY']) * height == 20
    position = re.search(r'\.stat-' + name + r'\s*\{\s*background-position:\s*([\d.-]+)px\s+([\d.-]+)px', css)
    assert position
    assert abs(float(position[1]) + record['startX'] * width * .8) < .0001
    assert abs(float(position[2]) + record['startY'] * height * .8) < .0001
print('Verified five League stat icon regions and the unmodified source atlas')
