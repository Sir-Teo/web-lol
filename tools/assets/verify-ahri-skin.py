"""Independently decode the complete local Ahri skin BIN and its link list.

Linked packages and native shader programs are not decoded by this verifier.
"""
import hashlib
import io
import json
import math
import runpy
from pathlib import Path
from cdtb import binfile
from xxhash import xxh64_intdigest

exporter = runpy.run_path(str(Path(__file__).with_name('export-ahri-materials.py')))
ROOT, PINS, require = (exporter[name] for name in ['ROOT', 'PINS', 'require'])
PARSER_SHA = '0c1825135763c98f705535eecf2b4b1a8e667c53181e9e1d43ad7a83d1d844fd'


def same(actual, expected):
    if isinstance(actual, str) and isinstance(expected, str):
        return actual == expected or expected == '{%08x}' % binfile.compute_binhash(actual)
    if isinstance(actual, dict) and isinstance(expected, dict):
        return actual.keys() == expected.keys() and all(same(value, expected[key]) for key, value in actual.items())
    if isinstance(actual, list) and isinstance(expected, list):
        return len(actual) == len(expected) and all(same(a, b) for a, b in zip(actual, expected))
    if type(actual) in (int, float) and type(expected) in (int, float):
        return actual == expected and (actual != 0 or math.copysign(1, actual) == math.copysign(1, expected))
    return type(actual) is type(expected) and actual == expected


def verify(raw, records):
    digest, size = PINS['docs/reference/ahri/skin0.bin']
    require(len(raw) == size and hashlib.sha256(raw).hexdigest() == digest, 'Ahri skin BIN differs')
    parser = Path(binfile.__file__).resolve()
    require(parser == (ROOT / '.tools/cdtb/cdtb/binfile.py').resolve() and hashlib.sha256(parser.read_bytes()).hexdigest() == PARSER_SHA, 'CDTB decoder differs from pinned source')
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
    require(same(decoded, records), 'Complete local Ahri skin records differ')
    require(len(decoded) == 5 and len(decoded['__linked']) == 23, 'Unexpected record/link count')
    return decoded


if __name__ == '__main__':
    data, model = exporter['load']()
    decoded = verify(data['docs/reference/ahri/skin0.bin'], model['skin']['data'])
    exporter['publish'](exporter['generate'](), ROOT / 'docs/reference/ahri-materials.json', check=True)
    print(json.dumps(dict(result='passed', localRecords=len(decoded)-1, linkedPackageNames=23,
                          linkedPackagesDecoded=False, nativeShaderArithmeticVerified=False)))
