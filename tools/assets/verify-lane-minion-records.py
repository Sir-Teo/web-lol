"""Verify selected current minion records against their pinned upstream bytes."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess
records = json.loads(Path('docs/reference/lane-minion-records.json').read_text())
def verify(item):
    name, source = item
    raw = subprocess.check_output(['curl', '-fLsS', '--retry', '2', '--max-time', '45', source['url']])
    assert hashlib.sha256(raw).hexdigest() == source['sha256'], f'Upstream bytes changed: {name}'
    assert json.loads(raw)[f'Characters/{name}/CharacterRecords/Root'] == source['record']
    return name
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    for name in pool.map(verify, records.items()):
        print(f'Verified {name}')
