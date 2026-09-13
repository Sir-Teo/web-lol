"""Verify the conflicting aura research records without choosing runtime semantics."""
import hashlib
import json
import subprocess
from pathlib import Path

pin = json.loads(Path('docs/reference/super-aura.json').read_text())
for source in pin['sources']:
    cache = Path(source['cache'])
    if not cache.exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(['curl', '-fLsS', '--max-time', '60', source['url'], '-o', str(cache)], check=True)
    raw = cache.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == source['sha256'], f'Source changed: {cache}'
    data = json.loads(raw)
    if source['container']:
        data = data[source['container']]
    assert {key: data[key] for key in source['records']} == source['records']
print('Verified three pinned sources and five selected aura records; behavior remains unresolved')
