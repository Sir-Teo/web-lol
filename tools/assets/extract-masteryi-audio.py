"""Restore/check the exact two frozen Master Yi SFX banks; reject differing inputs."""
import argparse
import json
from pathlib import Path
from masteryi_audio_source import ARCHIVE, BANK_ROOT, BANKS, EXTRACTION, REFERENCE, TOC, inputs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--reference', type=Path, default=REFERENCE)
    parser.add_argument('--pin', type=Path, default=EXTRACTION)
    parser.add_argument('--banks', type=Path, default=BANK_ROOT)
    args = parser.parse_args()
    pin, unit = inputs(args.reference, args.pin, args.banks, require_banks=args.check)
    if not args.check:
        # Preflight above refuses conflicting existing files before any network access.
        from xxhash import xxh64_intdigest
        from riot_archive import RiotArchive
        paths = [row[0] for row in BANKS]
        archive = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in paths + [TOC]}, pin, archive_name=ARCHIVE)
        archive.extract(paths, args.banks)
        if archive.provenance() != pin:
            raise ValueError('Frozen source extraction provenance changed')
        inputs(args.reference, args.pin, args.banks)
    print(json.dumps({'banks': len(BANKS), 'bytes': sum(row[1] for row in BANKS), 'declaredEvents': len(unit['events']), 'mode': 'check' if args.check else 'restore'}))


if __name__ == '__main__':
    main()
