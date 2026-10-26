"""Stage all Meditate authored mip transports privately, with independent replay."""
from pathlib import Path
import argparse
import json
import runpy
from masteryi_w_particles import SOURCE_ROOT, checked, load, require
from masteryi_q_decode import png_rgba8, sha
from particle_mip_atlas import pack, unpack

OUTPUT = Path('.cache/masteryi-w-packed-v2')
DECODER = runpy.run_path(str(Path(__file__).with_name('decode-masteryi-w-particles.py')))


def build(sources=SOURCE_ROOT, output=OUTPUT):
    decoded = DECODER['check_record'](sources=sources); pin, _ = load()
    rows, outputs = [], []
    for texture in decoded['textures']:
        levels = []
        for level in texture['levels']:
            rgba = png_rgba8(checked(level['path'], level['sha256'], level['bytes']), level['width'], level['height'])
            require(sha(rgba) == level['rgbaSha256'], 'Meditate source mip pixels differ')
            levels.append((level['width'], level['height'], rgba))
        png, atlas = pack(levels); path = output / (texture['source']['wadPathHash'] + '.png')
        row = {'source': texture['source'], 'path': str(path), 'bytes': len(png), 'sha256': sha(png), **atlas}
        rows.append(row); outputs.append((path, png))
    require(len(rows) == 18 and sum(len(r['rectangles']) for r in rows) == 153,
            'Meditate texture/mip closure differs')
    record = {'format': 1, 'decodedRecordSha256': DECODER['RECORD_SHA256'],
              'systems': sorted(pin['resources']),
              'producer': {'scriptSha256': sha(Path(__file__).read_bytes()),
                           'atlasModuleSha256': sha(Path(__file__).with_name('particle_mip_atlas.py').read_bytes())},
              'textures': rows,
              'limits': ['Private lossless transport of canonical software-decoded authored pixels, not native GPU parity.',
                         'Each rectangle is a separate authored texture mip, including zero. Never sample the atlas directly.',
                         'No public files, runtime loading or effect dispatch.']}
    outputs.append((output / 'textures.json', (json.dumps(record, indent=2) + '\n').encode()))
    return outputs, record


def verify(record, sources=SOURCE_ROOT):
    decoded = DECODER['check_record'](sources=sources); pin, _ = load()
    require(record['format'] == 1 and record['decodedRecordSha256'] == DECODER['RECORD_SHA256'] and
            record['systems'] == sorted(pin['resources']), 'Meditate transport source binding differs')
    by_path = {t['source']['path']: t for t in decoded['textures']}
    require(len(record['textures']) == 18 and {r['source']['path'] for r in record['textures']} == set(by_path),
            'Meditate transport closure differs')
    for row in record['textures']:
        source = by_path[row['source']['path']]
        require(row['source'] == source['source'], 'Meditate transport native identity differs')
        levels = unpack(checked(row['path'], row['sha256'], row['bytes']), row)
        require(len(levels) == len(source['levels']), 'Meditate authored mip count differs')
        for pixels, level, rectangle in zip(levels, source['levels'], row['rectangles']):
            require((rectangle['width'], rectangle['height'], sha(pixels)) ==
                    (level['width'], level['height'], level['rgbaSha256']), 'Meditate authored mip pixels differ')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--sources', type=Path, default=SOURCE_ROOT)
    parser.add_argument('--output', type=Path, default=OUTPUT)
    args = parser.parse_args()
    if args.check:
        record = json.loads((args.output / 'textures.json').read_bytes()); verify(record, args.sources)
    else:
        outputs, record = build(args.sources, args.output)
        for path, raw in outputs:
            if path.exists(): require(path.read_bytes() == raw, 'Conflicting Meditate packed output: ' + str(path))
        for path, raw in outputs:
            if not path.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                with path.open('xb') as out: out.write(raw)
        verify(record, args.sources)
    print(json.dumps({'textures': len(record['textures']),
        'authoredMips': sum(len(t['rectangles']) for t in record['textures']),
        'packedBytes': sum(t['bytes'] for t in record['textures']),
        'mode': 'check' if args.check else 'pack', 'runtimeChanged': False}))


if __name__ == '__main__': main()
