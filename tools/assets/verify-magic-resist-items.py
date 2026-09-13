"""Verify magic resistance recipe records and locally shipped source icons."""
import hashlib
import json
from pathlib import Path
pin = json.loads(Path('docs/reference/magic-resist-items.json').read_text())
raw = Path('.cache/item-ddragon-16.18.1.json').read_bytes()
assert hashlib.sha256(raw).hexdigest() == pin['sha256']
data = json.loads(raw)['data']
manifest = json.loads(Path('public/assets/reference-manifest.json').read_text())
for item_id, record in pin['items'].items():
    assert data[item_id] == record
    entry = next(e for e in manifest['assets'] if e['path'] == f'/assets/icons/{item_id}.png')
    icon = Path('public' + entry['path']).read_bytes()
    assert hashlib.sha256(icon).hexdigest() == entry['sha256']
    assert len(icon) == entry['bytes']
assert pin['items']['1057']['from'] == ['1033']
assert pin['items']['1057']['gold']['total'] - pin['items']['1033']['gold']['total'] == 450
print('Verified Null-Magic Mantle, Negatron Cloak recipe and both source icons')
