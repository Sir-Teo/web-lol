#!/usr/bin/env python3
"""Deliver the separately derived normal stream; authored source GLB stays unchanged."""
import argparse
import hashlib
import importlib.util
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def sha(raw): return hashlib.sha256(raw).hexdigest()


def require(ok, message):
    if not ok:
        raise ValueError(message)


def checked(row):
    raw = (ROOT / row['path']).read_bytes()
    require((len(raw), sha(raw)) == (row['bytes'], row['sha256']), 'Retained bytes differ: ' + row['path'])
    return raw


def main():
    cli = argparse.ArgumentParser(description=__doc__); cli.add_argument('--check', action='store_true')
    args = cli.parse_args()
    reading_path = ROOT / 'docs/reference/leona-native-scb-normals.json'; reading_bytes = reading_path.read_bytes()
    reading = json.loads(reading_bytes); verifier = reading['verifier']; checked(verifier)
    spec = importlib.util.spec_from_file_location('normal_reading', ROOT / verifier['path'])
    verifier_module = importlib.util.module_from_spec(spec); spec.loader.exec_module(verifier_module)
    verifier_module.verify(reading_path)
    stream = next(r for r in reading['streams'] if r['source']['path'].endswith('/13b9c8c611b0d630.scb'))
    derived = json.loads(checked(stream['derived'])); values = derived['expandedCornerNormals']
    raw = struct.pack('<' + 'f' * len(values), *values)
    require(sha(raw) == stream['expandedFloat32Sha256'] and len(values) == 1944 * 3, 'Packed normal stream differs')
    model_path = ROOT / 'public/assets/models/leona-e-sword.glb'; model = model_path.read_bytes()
    model_pin = json.loads((ROOT / 'public/assets/models/leona-e-sword.json').read_text())
    require((len(model), sha(model)) == (model_pin['output']['bytes'], model_pin['output']['sha256']), 'Source GLB differs')
    require(model_pin['source'] == derived['source'] and not model_pin['sourceVertexColors'], 'Source model identity differs')
    require(struct.unpack_from('<III', model) == (0x46546c67, 2, len(model)), 'Expected GLB2')
    size, kind = struct.unpack_from('<II', model, 12); require(kind == 0x4e4f534a, 'Expected GLB JSON')
    gltf = json.loads(model[20:20 + size]); primitive = gltf['meshes'][0]['primitives'][0]
    require('NORMAL' not in primitive['attributes'] and gltf['accessors'][primitive['attributes']['POSITION']]['count'] == 1944,
            'Authored mesh stream contract differs')
    relative = 'assets/models/leona-e-sword-normals.bin'
    metadata = dict(scope='Software-derived generic native SCB normals, separate from authored GLB. No native GPU/frame parity claim.',
        sourceModel=dict(path='assets/models/leona-e-sword.glb', bytes=len(model), sha256=sha(model),
                         sourcePositionSha256=model_pin['attributeSha256']['_SOURCE_POSITION'],
                         positionSha256=model_pin['attributeSha256']['POSITION']),
        source=derived['source'], sourceIndicesSha256=model_pin['sourceIndicesSha256'],
        stream=dict(path=relative, bytes=len(raw), sha256=sha(raw), corners=1944, components=3, encoding='Float32LE'),
        derivation=dict(reading='docs/reference/leona-native-scb-normals.json', sha256=sha(reading_bytes),
                        algorithm='Unit face normal, strict component snap, source-index sum, final normalize; native float32 operation order.',
                        nativeExecuted=False, nativeNumericalParityVerified=False))
    outputs = [(ROOT / 'public' / relative, raw),
               (ROOT / 'src/content/leona-e-sword-normals.json', (json.dumps(metadata, indent=2) + '\n').encode())]
    for path, content in outputs:
        if args.check or path.exists(): require(path.read_bytes() == content, 'Derived delivery differs: ' + str(path))
        else: path.write_bytes(content)
    print(f'PASS: {len(raw)} separate Float32LE normal bytes / 1944 corners; original GLB unchanged; check={args.check}')


if __name__ == '__main__': main()
