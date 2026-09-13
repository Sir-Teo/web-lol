"""Verify selected progression records against pinned upstream bytes."""
import hashlib
import json
from pathlib import Path
import subprocess

for source in json.loads(Path('docs/reference/ashe-progression.json').read_text())['sources']:
    raw = subprocess.check_output(['curl', '-fLsS', '--retry', '2', '--max-time', '45', source['url']])
    assert hashlib.sha256(raw).hexdigest() == source['sha256'], 'Upstream bytes changed'
    data = json.loads(raw)
    for key, record in source['records'].items():
        assert data[key] == record, f'Record changed: {key}'
        print(f'Verified {key}')
