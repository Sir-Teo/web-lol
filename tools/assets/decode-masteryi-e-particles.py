"""Decode every Wuju Style authored mip privately; the source has no SCB mesh."""
from pathlib import Path
import argparse
import json
import re
import runpy
from masteryi_e_particles import PIN_SHA256, SOURCE_ROOT, load, require
from masteryi_q_decode import sha

RECORD = Path('docs/reference/masteryi/e-particles-decoded.json')
OUTPUT = Path('.cache/masteryi-e-particles-decoded')
RECORD_SHA256 = '9d7abf9623979dca4c09581d0adc6433a43b3ad8f2fd15a690fc647ef9c74d68'
engine = runpy.run_path(str(Path(__file__).with_name('decode-masteryi-q-particles.py')))
PROFILE = {'source_load': load, 'source_pin_sha256': PIN_SHA256,
           'texture_count': 9, 'mesh_count': 0}
# Explicit zero-mesh profile; keep shared Q/W/R profiles unchanged.


def generate(sources=SOURCE_ROOT, output=OUTPUT):
    return engine['generate'](sources, output, **PROFILE)


def check_record(record_path=RECORD, sources=SOURCE_ROOT, record_sha256=RECORD_SHA256):
    return engine['check_record'](record_path, sources, record_sha256, **PROFILE)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--sources', type=Path, default=SOURCE_ROOT)
    parser.add_argument('--output', type=Path, default=OUTPUT)
    parser.add_argument('--record', type=Path, default=RECORD)
    parser.add_argument('--record-sha256', default=RECORD_SHA256,
                        help='Reviewed checksum for a separate build profile/record/output')
    args = parser.parse_args()
    require(re.fullmatch(r'[0-9a-f]{64}', args.record_sha256) is not None,
            'Decode record hash is invalid')
    if args.check:
        record = check_record(args.record, args.sources, args.record_sha256)
    else:
        outputs, record = generate(args.sources, args.output)
        data = (json.dumps(record, indent=2, allow_nan=False) + '\n').encode()
        require(sha(data) == args.record_sha256,
                'Decode build/profile differs; use separately reviewed record/output/checksum')
        outputs.append((args.record, data))
        # Validate the complete output set before writing any missing file.
        for path, raw in outputs:
            if path.exists(): require(path.read_bytes() == raw, 'Conflicting decoded output: ' + str(path))
        for path, raw in outputs:
            if not path.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                with path.open('xb') as out: out.write(raw)
    print(json.dumps({'textures': len(record['textures']),
        'mips': sum(len(t['levels']) for t in record['textures']),
        'meshes': len(record['meshes']),
        'pngBytes': sum(m['bytes'] for t in record['textures'] for m in t['levels']),
        'mode': 'check' if args.check else 'decode', 'runtimeChanged': False}))


if __name__ == '__main__': main()
