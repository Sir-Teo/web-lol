"""Verify every pinned model source and both complete model BINs without extraction."""
import argparse
import hashlib
import io
import json
import runpy
from pathlib import Path
from cdtb import binfile
from xxhash import xxh64_intdigest

character = runpy.run_path(str(Path(__file__).with_name('verify-masteryi-character.py')))
ROOT = Path(__file__).resolve().parents[2]
require, same = character['require'], character['same']
MODEL_SHA = '4295bceeba96cfb15e006d392e7d0f3c480bb51bf8cff8872a9c39fc9873c7ce'


def parse(raw, records):
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
    result = json.loads(json.dumps(binfile.BinFile(io.BytesIO(raw)).to_serializable()))
    require(same(result, records), 'Complete model BIN closure differs')
    return result


def verify(source):
    content = (ROOT / 'docs/reference/masteryi-model.json').read_bytes()
    require(hashlib.sha256(content).hexdigest() == MODEL_SHA, 'Model source pin differs')
    pin = json.loads(content)
    parser = Path(binfile.__file__).resolve()
    require(parser == ROOT / '.tools/cdtb/cdtb/binfile.py'
            and hashlib.sha256(parser.read_bytes()).hexdigest() == character['PARSER_SHA'],
            'Model parser differs')
    require(len(pin['extraction']['files']) == 29 and len(pin['atomicClips']) == 47,
            'Model source counts differ')
    for row in pin['extraction']['files']:
        raw = (source / row['path']).read_bytes()
        require(len(raw) == row['bytes'] and hashlib.sha256(raw).hexdigest() == row['sha256'],
                'Model source differs: ' + row['path'])
    counts = []
    for section, folder in [('skin', 'skins'), ('animations', 'animations')]:
        decoded = parse((source / f'data/characters/masteryi/{folder}/skin0.bin').read_bytes(),
                        pin[section]['data'])
        counts.append(len(decoded) - 1)
    skin = pin['skin']['data']['Characters/MasterYi/Skins/Skin0']
    graph = pin['animations']['data'][skin['skinAnimationProperties']['animationGraphData']]
    mappings = {key: value['mAnimationResourceData']['mAnimationFilePath'].lower()
                for key, value in graph['mClipDataMap'].items()
                if value['__type'] == 'AtomicClipData'}
    require(mappings == pin['atomicClips'], 'Atomic clip mappings differ')
    require(len(set(mappings.values())) == 24, 'Unique animation count differs')
    return dict(files=29, records=counts, atomicClips=47, uniqueAnimations=24,
                nativeEquivalent=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(dict(result='passed', **verify(args.source_root))))
