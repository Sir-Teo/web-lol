"""Decode the retained Leona BIN and compare its complete record closure.

Requires the asset-tool CDTB/xxhash environment (see docs/LEONA.md).
Optional --archive-output re-extracts from the pinned Riot archive into a fresh
directory and verifies those bytes too. With no option this is entirely offline.
"""
import argparse
import hashlib
import io
import json
import runpy
from pathlib import Path

from cdtb import binfile
from xxhash import xxh64_intdigest

kit = runpy.run_path(str(Path(__file__).with_name('export-leona-kit.py')))
SOURCE, PINS, require = kit['SOURCE'], kit['PINS'], kit['require']


def verify(raw, records):
    require(len(raw) == 24399 and hashlib.sha256(raw).hexdigest() == PINS['character.bin'],
            'Leona BIN differs from the frozen extraction')
    fields, types, values, entries, paths = {}, {}, {}, {}, {}

    def collect(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if not key.startswith('{'):
                    fields[binfile.compute_binhash(key)] = key
                    values[binfile.compute_binhash(key)] = key
                if key == '__type' and not child.startswith('{'):
                    types[binfile.compute_binhash(child)] = child
                collect(child)
        elif isinstance(value, list):
            for child in value:
                collect(child)
        elif isinstance(value, str) and value.isascii() and not value.startswith('{'):
            values[binfile.compute_binhash(value)] = value
            entries[binfile.compute_binhash(value)] = value
            paths[xxh64_intdigest(value.lower())] = value

    collect(records)
    for key in records:
        entries[binfile.compute_binhash(key)] = key
    binfile.hashfile_binfields.hashes = fields
    binfile.hashfile_bintypes.hashes = types
    binfile.hashfile_binhashes.hashes = values
    binfile.hashfile_binentries.hashes = entries
    binfile.hashfile_binpaths.hashes = paths
    # JSON object keys are strings in the naming export, including numeric map
    # keys. Normalize that representation before comparing either dictionary.
    decoded = json.loads(json.dumps(binfile.BinFile(io.BytesIO(raw)).to_serializable()))

    def align(actual, expected):
        # Only exact lowercase FNV aliases may match an unresolved reference.
        # No field, number, array element or missing record is waived.
        if isinstance(actual, str) and isinstance(expected, str) and expected.startswith('{'):
            if expected == '{%08x}' % binfile.compute_binhash(actual):
                return expected
        if isinstance(actual, dict) and isinstance(expected, dict):
            return {key: align(value, expected.get(key)) for key, value in actual.items()}
        if isinstance(actual, list) and isinstance(expected, list) and len(actual) == len(expected):
            return [align(a, b) for a, b in zip(actual, expected)]
        return actual

    require(align(decoded, records) == records, 'Complete Leona record closure differs')
    return decoded


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive-output', type=Path)
    args = parser.parse_args()
    # Run all offline export assertions as well as the independent BIN decode.
    kit['generate']()
    pin = json.loads((SOURCE / 'character.json').read_text())
    raw = (SOURCE / 'character.bin').read_bytes()
    verify(raw, pin['records'])
    if args.archive_output:
        from riot_archive import RiotArchive
        destination = args.archive_output.resolve()
        require(not destination.exists(), 'Archive output must be fresh')
        source = 'data/characters/leona/leona.bin'
        names = [source, 'data/final/champions/leona.wad.subchunktoc']
        archive = RiotArchive({f'{xxh64_intdigest(name):016x}': name for name in names},
                              pin['extraction'], archive_name=pin['extraction']['archive'])
        archive.extract([source], destination)
        recovered = (destination / source).read_bytes()
        require(recovered == raw, 'Repeated archive extraction differs')
        decoded = verify(recovered, pin['records'])
        require(archive.provenance() == pin['extraction'], 'Repeated extraction provenance differs')
        (destination / 'decoded.json').write_text(json.dumps(decoded, indent=2) + '\n')
    print('Verified all 51 Leona records against the retained 24,399-byte frozen BIN'
          + (' and repeated pinned-archive extraction.' if args.archive_output else ' offline.'))
