import hashlib
import json
from pathlib import Path
pin = json.loads(Path('docs/reference/dorans-blade.json').read_text())
raw = Path(pin['cache']).read_bytes()
assert hashlib.sha256(raw).hexdigest() == pin['sha256']
data = json.loads(raw)
for key, record in pin['records'].items():
    assert data[key] == record
assert round(data['Items/1055']['PercentOmnivampMod'], 6) == 0.025
assert data['Items/ItemGroups/DoransItems']['mMaxGroupOwnable'] == 1
print('Verified Doran’s Blade omnivamp and one-item group')
