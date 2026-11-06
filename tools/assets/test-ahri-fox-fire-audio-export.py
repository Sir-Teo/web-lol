"""Exercise whole-closure publication failures without touching repository assets."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

root = Path.cwd()
producer = root / 'tools/assets/export-ahri-fox-fire-audio.py'
optimized = ['-O'] if sys.flags.optimize else []


def require(ok, message):
    if not ok:
        raise ValueError(message)


with tempfile.TemporaryDirectory(prefix='ahri-fox-fire-publish-') as temporary:
    base = Path(temporary)
    (base / 'node_modules').symlink_to(root / 'node_modules', target_is_directory=True)
    sources = ['docs/reference/ahri-w-audio-properties.json']
    sources += [f".cache/ahri-audio-decoded-v1/{p.name}" for p in (root / 'public/assets/audio/ahri-fox-fire').glob('*.wav')]
    for name in sources:
        path = base / name
        path.parent.mkdir(parents=True, exist_ok=True)
        # Committed masters have the same frozen hashes; stage fixture inputs
        # without requiring the developer's private decoder cache.
        original = root / ('public/assets/audio/ahri-fox-fire/' + Path(name).name) if name.endswith('.wav') else root / name
        path.write_bytes(original.read_bytes())
    def run(check=False):
        return subprocess.run([sys.executable, *optimized, str(producer), *(['--check'] if check else [])],
                              cwd=base, capture_output=True, text=True)
    require(run(True).returncode != 0, 'Missing published closure accepted')
    # Put a conflict in the last output: none of the eleven earlier masters may
    # be written before the complete output set has been checked.
    content = base / 'src/content/ahri-fox-fire-audio.ts'
    content.parent.mkdir(parents=True)
    content.write_bytes(b'conflict')
    result = run()
    require(result.returncode != 0 and 'Existing W source output differs' in result.stderr, 'Conflict accepted')
    require(not (base / 'public').exists(), 'Partial publication before preflight completed')
    content.unlink()
    require(run().returncode == 0 and run(True).returncode == 0, 'Fresh export/check failed')
    public = base / 'public/assets/audio/ahri-fox-fire'
    masters = sorted(public.glob('*.wav'))
    require(len(masters) == 11, 'Incomplete media closure')
    master = masters[-1]
    original = master.read_bytes()
    master.write_bytes(original[:-1] + bytes([original[-1] ^ 1]))
    require(run().returncode != 0, 'Corrupt existing master overwritten')
    require(master.read_bytes() != original, 'Corrupt output silently replaced')
    master.unlink()
    master.symlink_to(root / 'public/assets/audio/ahri-fox-fire' / master.name)
    require(run().returncode != 0, 'Symlink output accepted')
    master.unlink()
    master.write_bytes(original)
    saved_directory = base / 'saved-masters'
    public.rename(saved_directory)
    public.symlink_to(root / 'public/assets/audio/ahri-fox-fire', target_is_directory=True)
    require(run().returncode != 0, 'Symlink output parent accepted')
    public.unlink()
    saved_directory.rename(public)
    # Source failure occurs before outputs are touched, even with a valid
    # frozen decoded record beside the changed source WAV.
    encoded = base / next(name for name in sources if name.endswith('.wav'))
    encoded.write_bytes(b'changed master')
    require(run().returncode != 0, 'Changed private master accepted')
    require(master.read_bytes() == original, 'Source rejection changed published bytes')
    for path in masters:
        expected = (root / 'public/assets/audio/ahri-fox-fire' / path.name).read_bytes()
        require(hashlib.sha256(path.read_bytes()).digest() == hashlib.sha256(expected).digest(),
                'Published master changed during rejection probes')
print(json.dumps(dict(status='passed', optimized=bool(sys.flags.optimize),
                      freshExport=True, rejectionProbes=6, repositoryAssetsChanged=False)))
