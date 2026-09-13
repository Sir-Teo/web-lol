"""Verify armor recipe records and locally shipped source icons."""
import hashlib
import json
from pathlib import Path
pin = json.loads(Path('docs/reference/armor-items.json').read_text())
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
assert pin['items']['1031']['from'] == ['1029']
assert pin['items']['1031']['gold']['total'] - pin['items']['1029']['gold']['total'] == 500
print('Verified Cloth Armor, Chain Vest recipe and both source icons')
