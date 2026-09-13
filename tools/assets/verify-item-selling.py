"""Verify exact sell amounts; do not approximate them with a blanket ratio."""
import hashlib
import json
from pathlib import Path

pin = json.loads(Path('docs/reference/item-selling.json').read_text())
raw = Path('.cache/item-ddragon-16.18.1.json').read_bytes()
assert hashlib.sha256(raw).hexdigest() == pin['sha256']
data = json.loads(raw)
assert data['version'] == pin['version']
for item_id, record in pin['items'].items():
    assert data['data'][item_id]['name'] == record['name']
    assert data['data'][item_id]['gold'] == record['gold']
print('Verified four item sell values from pinned Data Dragon 16.18.1')
