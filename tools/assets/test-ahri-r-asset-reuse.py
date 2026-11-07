"""Reject changed identities, transport bytes, mip metadata and linked assets."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

root = Path.cwd()
producer = root / 'tools/assets/read-ahri-r-asset-reuse.py'
reading = json.loads((root / 'docs/reference/ahri/r-asset-reuse.json').read_bytes())
flags = ['-O'] if sys.flags.optimize else []

def require(ok, message):
    if not ok:
        raise ValueError(message)

with tempfile.TemporaryDirectory(prefix='ahri-r-reuse-') as tmp:
    base = Path(tmp)
    paths = {row['path'] for row in reading['inputs']}
    paths.add('docs/reference/ahri/r-asset-reuse.json')
    for name in [row['path'] for row in reading['inputs'][:2]]:
        content = json.loads((root / name).read_bytes())
        paths.update(row.get('glb', row)['path'] for row in content.get('textures', content.get('meshes', [])))
    for row in reading['assets']:
        paths.update('public/' + asset['url'] for asset in row['existingBindings'])
    for name in paths:
        target = base / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / name, target)
    def run():
        return subprocess.run([sys.executable, *flags, str(producer), '--check'], cwd=base, capture_output=True)
    require(run().returncode == 0, 'Clean isolated transport proof failed')
    shared = next(row for row in reading['assets'] if row['kind'] == 'textures' and row['existingBindings'])
    candidate = shared['existingBindings'][0]
    target = base / candidate['content']
    original = target.read_bytes()
    for field in ['source', 'sha256', 'rectangles']:
        content = json.loads(original)
        asset = next(row for row in content['textures'] if row['source']['path'] == shared['source']['path'])
        if field == 'source':
            asset['source']['sha256'] = '0' * 64
        elif field == 'rectangles':
            asset['rectangles'][0]['width'] += 1
        else:
            asset[field] = '0' * 64
        target.write_text(json.dumps(content))
        require(run().returncode != 0, 'Changed shared metadata accepted: ' + field)
    target.write_bytes(original)
    public = base / 'public' / candidate['url']
    raw = public.read_bytes()
    public.write_bytes(raw[:-1])
    require(run().returncode != 0, 'Truncated borrowed bytes accepted')
    public.unlink()
    public.symlink_to(root / 'public' / candidate['url'])
    require(run().returncode != 0, 'Borrowed symlink accepted')
    public.unlink()
    public.write_bytes(raw)
    folder = base / 'public/assets/effects'
    held = base / 'held'
    folder.rename(held)
    folder.symlink_to(held, target_is_directory=True)
    require(run().returncode != 0, 'Borrowed parent symlink accepted')
    folder.unlink()
    held.rename(folder)
    target = base / candidate['content']
    raw = target.read_bytes()
    target.unlink()
    target.symlink_to(root / candidate['content'])
    require(run().returncode != 0, 'Shared content symlink accepted')
    target.unlink()
    target.write_bytes(raw)
    target = base / 'docs/reference/ahri/r-asset-reuse.json'
    target.write_bytes(target.read_bytes()[:-1])
    require(run().returncode != 0, 'Corrupt output accepted')
print(json.dumps({'result': 'passed', 'optimized': bool(sys.flags.optimize), 'rejectionProbes': 8}))
