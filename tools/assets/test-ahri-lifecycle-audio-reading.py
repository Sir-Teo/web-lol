"""Exercise frozen lifecycle reading guards without private banks, decoders or caches."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile

root = Path.cwd()
producer = root / 'tools/assets/read-ahri-lifecycle-audio.py'
flags = ['-O'] if sys.flags.optimize else []


def require(ok, message):
    if not ok:
        raise ValueError(message)


with tempfile.TemporaryDirectory(prefix='ahri-lifecycle-reading-') as temporary:
    base = Path(temporary)
    for name in ['ahri-audio-graph.json', 'ahri-audio-decoded.json']:
        path = base / 'docs/reference' / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes((root / 'docs/reference' / name).read_bytes())
    output = base / 'reading.json'

    def run(check=False):
        return subprocess.run([sys.executable, *flags, str(producer), '--output', str(output),
                               *(['--check'] if check else [])], cwd=base, capture_output=True)

    require(run(True).returncode != 0 and not output.exists(), 'Missing reading accepted or created')
    require(run().returncode == 0 and run(True).returncode == 0, 'Fresh reading/check failed')
    original = output.read_bytes()
    require(original == (root / 'docs/reference/ahri-lifecycle-audio-properties.json').read_bytes(),
            'Cache-free reading differs from frozen record')
    output.write_bytes(b'changed reading')
    require(run().returncode != 0 and output.read_bytes() == b'changed reading', 'Changed reading overwritten')
    output.unlink()
    output.symlink_to(root / 'docs/reference/ahri-lifecycle-audio-properties.json')
    require(run().returncode != 0, 'Symlink reading accepted')
    output.unlink()
    redirect = base / 'redirect'
    redirect.symlink_to(base / 'docs/reference', target_is_directory=True)
    original_output = output
    output = redirect / 'reading.json'
    require(run().returncode != 0 and not output.exists(), 'Parent symlink reading accepted')
    output = original_output
    graph = base / 'docs/reference/ahri-audio-graph.json'
    graph_raw = graph.read_bytes()
    graph.write_bytes(graph_raw + b' ')
    require(run().returncode != 0 and not output.exists(), 'Changed graph accepted or reading written')
    graph.write_bytes(graph_raw)
    (base / 'docs/reference/ahri-audio-decoded.json').unlink()
    require(run().returncode != 0 and not output.exists(), 'Missing decoded record accepted')
print(json.dumps(dict(result='passed', optimized=bool(sys.flags.optimize), rejectionProbes=6,
                      privateCaches=False, repositoryAssetsChanged=False)))
