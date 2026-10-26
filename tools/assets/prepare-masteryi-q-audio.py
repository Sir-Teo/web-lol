"""Retain a reviewable, immutable Q sound binding/profile reading privately."""
from pathlib import Path
import argparse
import json
from masteryi_q_audio import generate
from masteryi_q_particles import require

OUTPUT = Path('docs/reference/masteryi/q-audio-reading.json')


def main():
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--check', action='store_true')
    parser.add_argument('--output', type=Path, default=OUTPUT); args = parser.parse_args()
    record = generate(); raw = (json.dumps(record, indent=2, allow_nan=False) + '\n').encode()
    if args.check or args.output.exists(): require(args.output.read_bytes() == raw, 'Q audio reading conflicts; use a separate reviewed output path')
    elif not args.check:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open('xb') as stream: stream.write(raw)
    print(json.dumps({key: record[key] for key in ['media', 'wavBytes', 'tails', 'peaksAboveOne', 'peak']}))


if __name__ == '__main__': main()
