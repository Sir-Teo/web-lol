"""Restore/check frozen Highlander particle sources, preserving native hashes and omissions."""
from pathlib import Path
import argparse
import json
import tempfile
from masteryi_r_particles import PIN, MODEL, SOURCE_ROOT, cache_path, checked, check_files, load, require, verify_native


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true'); parser.add_argument('--pin', type=Path, default=PIN)
    parser.add_argument('--model', type=Path, default=MODEL); parser.add_argument('--sources', type=Path, default=SOURCE_ROOT)
    args = parser.parse_args(); pin, model = load(args.pin, args.model)
    # Refuse all existing conflicts before network or native parser access.
    for row in pin['extraction']['files']:
        target = cache_path(args.sources, row)
        if target.exists(): checked(target, row['sha256'], row['bytes'])
    if not args.check:
        from xxhash import xxh64_intdigest
        from riot_archive import RiotArchive
        paths = [row['path'] for row in pin['extraction']['files']]; toc = 'data/final/champions/masteryi.wad.subchunktoc'
        archive = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in [*paths, toc]}, pin['extraction'], archive_name=pin['extraction']['archive'])
        with tempfile.TemporaryDirectory(prefix='masteryi-r-source-') as temp:
            archive.extract(paths, temp, flat=True)
            require(archive.provenance() == pin['extraction'], 'Frozen R extraction provenance changed')
            verify_native(pin, model, temp)
            outputs = [(cache_path(args.sources, row), checked(cache_path(temp, row), row['sha256'], row['bytes'])) for row in pin['extraction']['files']]
            for target, raw in outputs:
                if target.exists(): require(target.read_bytes() == raw, 'Conflicting R source output')
            for target, raw in outputs:
                if not target.exists():
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with target.open('xb') as out: out.write(raw)
    result = verify_native(pin, model, args.sources)
    print(json.dumps({**result, 'bytes': sum(r['bytes'] for r in pin['extraction']['files']), 'mode': 'check' if args.check else 'restore', 'runtimeChanged': False}))


if __name__ == '__main__': main()
