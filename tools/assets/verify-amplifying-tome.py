"""Verify the complete Tome record and shipped icon against pinned sources."""
import hashlib
import json
from pathlib import Path
pin = json.loads(Path('docs/reference/amplifying-tome.json').read_text())
raw = Path('.cache/item-ddragon-16.18.1.json').read_bytes()
assert hashlib.sha256(raw).hexdigest() == pin['sha256']
assert json.loads(raw)['data']['1052'] == pin['item']
manifest = json.loads(Path('public/assets/reference-manifest.json').read_text())
entry = next(a for a in manifest['assets'] if a['path'] == '/assets/icons/1052.png')
icon = Path('public' + entry['path']).read_bytes()
assert hashlib.sha256(icon).hexdigest() == entry['sha256']
assert len(icon) == entry['bytes']
print('Verified Amplifying Tome record and source icon')
