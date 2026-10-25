"""Reparse all retained MasterYi records offline with the pinned CDTB decoder."""
import hashlib
import io
import json
import runpy
from pathlib import Path

from cdtb import binfile
from xxhash import xxh64_intdigest

exporter = runpy.run_path(str(Path(__file__).with_name('export-masteryi-declarations.py')))
ROOT, SOURCE, PINS, require = [exporter[key] for key in ['ROOT', 'SOURCE', 'PINS', 'require']]
PARSER_SHA = '0c1825135763c98f705535eecf2b4b1a8e667c53181e9e1d43ad7a83d1d844fd'


def same(actual, expected):
    """JSON equality with bool/number separation and exact lowercase FNV aliases."""
    if isinstance(actual, str) and isinstance(expected, str):
        return actual == expected or expected == '{%08x}' % binfile.compute_binhash(actual)
    if isinstance(actual, dict) and isinstance(expected, dict):
        return actual.keys() == expected.keys() and all(same(value, expected[key])
                                                        for key, value in actual.items())
    if isinstance(actual, list) and isinstance(expected, list):
        return len(actual) == len(expected) and all(same(a, b) for a, b in zip(actual, expected))
    if type(actual) in (int, float) and type(expected) in (int, float):
        return actual == expected
    return type(actual) is type(expected) and actual == expected


def verify(raw, records):
    require(len(raw) == 27930 and hashlib.sha256(raw).hexdigest() == PINS['character.bin'],
            'MasterYi BIN differs from the frozen extraction')
    parser = Path(binfile.__file__).resolve()
    require(parser == ROOT / '.tools/cdtb/cdtb/binfile.py'
            and hashlib.sha256(parser.read_bytes()).hexdigest() == PARSER_SHA,
            'CDTB decoder differs from the pinned source')
    fields, types, values, entries, paths = {}, {}, {}, {}, {}

    def collect(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if not key.startswith('{'):
                    fields[binfile.compute_binhash(key)] = key
                    values[binfile.compute_binhash(key)] = key
                if key == '__type' and isinstance(child, str) and not child.startswith('{'):
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
    decoded = json.loads(json.dumps(binfile.BinFile(io.BytesIO(raw)).to_serializable()))
    require(same(decoded, records), 'Complete MasterYi record closure differs')
    require(len(decoded) == 61 and decoded['__linked'] == [], 'Unexpected record count or links')
    return decoded


if __name__ == '__main__':
    content = exporter['generate']()
    exporter['publish'](content, SOURCE / 'declarations.json', check=True)
    pin, _ = exporter['load']()
    verify((SOURCE / 'character.bin').read_bytes(), pin['records'])
    print('Verified the complete 60-record MasterYi closure plus __linked against the '
          '27,930-byte frozen BIN; exact fields, arrays and numbers, FNV aliases only.')
