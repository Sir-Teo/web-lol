"""Verify pinned font definitions and the unmodified local OpenType files."""
import hashlib
import json
from pathlib import Path

pin = json.loads(Path('docs/reference/hud-fonts.json').read_text())
raw = Path('.cache/fonts-16.18.json').read_bytes()
assert hashlib.sha256(raw).hexdigest() == pin['sha256']
source = json.loads(raw)
for key, record in pin['types'].items():
    assert source[key] == record
manifest = json.loads(Path('public/assets/reference-manifest.json').read_text())
total = 0
for name in pin['files']:
    path = f'/assets/fonts/{name}.otf'
    entry = next(a for a in manifest['assets'] if a['path'] == path)
    data = Path('public' + path).read_bytes()
    assert data[:4] == b'OTTO'
    assert entry['sha256'] == hashlib.sha256(data).hexdigest()
    assert entry['bytes'] == len(data)
    assert entry['source'] == f'https://raw.communitydragon.org/16.18/game/assets/ux/fonts/{name}.otf'
    total += len(data)
print(f'Verified five source font files ({total} bytes) and pinned game font definitions')
