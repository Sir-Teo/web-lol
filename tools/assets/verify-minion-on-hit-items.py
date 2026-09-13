"""Verify frozen lane-minion item records and tooltip text against pinned patch bytes."""
import hashlib
import json
from pathlib import Path
import subprocess

pin = json.loads(Path('docs/reference/minion-on-hit-items.json').read_text())
for source in pin['sources']:
    raw = subprocess.check_output(['curl', '-fLsS', '--retry', '2', '--max-time', '45', source['url']])
    assert hashlib.sha256(raw).hexdigest() == source['sha256'], 'Upstream bytes changed'
    data = json.loads(raw)
    if source['entries']:
        data = data['entries']
    for key, record in source['records'].items():
        assert data[key] == record, f'Record changed: {key}'
        print(f'Verified {key}')
