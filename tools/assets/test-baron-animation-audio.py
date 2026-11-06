"""Probe source/record/helper closure without modifying frozen inputs."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile

root = Path.cwd()
producer = root / 'tools/assets/read-baron-animation-audio.py'
record = root / 'docs/reference/baron-animation-audio-reading.json'
mode = ['-O'] if sys.flags.optimize else []


def require(ok, message):
    if not ok:
        raise ValueError(message)


def run(cwd, target, script=producer, discover=False):
    return subprocess.run([sys.executable, *mode, str(script), '--discover' if discover else '--check',
                           '--record', str(target)], cwd=cwd, capture_output=True, text=True)


with tempfile.TemporaryDirectory(prefix='baron-animation-audio-') as temporary:
    folder = Path(temporary)
    bad = folder / 'reading.json'
    bad.write_bytes(record.read_bytes() + b' ')
    require(run(root, bad).returncode != 0, 'Changed reading accepted')
    require(run(root, folder / 'missing.json').returncode != 0, 'Missing reading accepted')
    require(run(root, record, discover=True).returncode != 0, 'Discovery replaced existing reading')
    edited = folder / 'reader.py'
    edited.write_bytes(producer.read_bytes() + b'\n# changed helper\n')
    require(run(root, record, script=edited).returncode != 0, 'Changed helper accepted')
    sources = ['docs/reference/epic-models-source.json', 'docs/reference/baron-audio-graph.json']
    for source in sources:
        path = folder / source
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes((root / source).read_bytes())
    for source in sources:
        path = folder / source
        raw = path.read_bytes()
        path.write_bytes(raw + b' ')
        result = run(folder, folder / 'new.json', discover=True)
        require(result.returncode != 0 and 'Frozen animation source/audio graph differs' in result.stderr,
                'Changed source accepted')
        require(not (folder / 'new.json').exists(), 'Rejected source wrote a reading')
        path.write_bytes(raw)
print(json.dumps(dict(status='passed', optimized=bool(sys.flags.optimize), rejectionProbes=6)))
