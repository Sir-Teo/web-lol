"""Stage all original Baron attack mips in lossless private transport containers."""
import argparse
import json
import runpy
import zlib
from pathlib import Path
from masteryi_q_decode import png_rgba8, sha
from particle_mip_atlas import pack, unpack
from baron_attack_decode import require

RECORD = Path('docs/reference/baron-attack-decoded.json')
DIGEST = 'ab8f06fee053cd0b2f89759f99f53c5abb1986c9c32e977812ae9129e306da20'
DECODER = runpy.run_path(str(Path('tools/assets/decode-baron-attacks.py').resolve()))


def checked(path, digest, size=None):
    raw = Path(path).read_bytes()
    require(sha(raw) == digest and (size is None or len(raw) == size), 'Packed input/output differs: ' + str(path))
    return raw


def producer():
    return dict(scriptSha256=sha(Path(__file__).read_bytes()),
                atlasModuleSha256=sha(Path('tools/assets/particle_mip_atlas.py').read_bytes()),
                zlibVersion=zlib.ZLIB_VERSION, zlibRuntimeVersion=zlib.ZLIB_RUNTIME_VERSION)


def build(decoded, output, check):
    rows, outputs = [], []
    for texture in decoded['textures']:
        levels = []
        for level in texture['levels']:
            raw = checked(Path('.cache/baron-attack-decoded') / level['path'], level['sha256'], level['bytes'])
            pixels = png_rgba8(raw, level['width'], level['height'])
            require(sha(pixels) == level['rgbaSha256'], 'Decoded mip pixels differ')
            levels.append((level['width'], level['height'], pixels))
        png, atlas = pack(levels)
        name = texture['source']['wadPathHash'] + '.png'
        row = dict(source=texture['source'], path=name, bytes=len(png), sha256=sha(png), **atlas)
        require(unpack(png, row) == [level[2] for level in levels], 'Authored mip transport differs')
        rows.append(row)
        outputs.append((output / name, png))
    require(len(rows) == 25 and sum(len(t['rectangles']) for t in rows) == 214, 'Baron mip closure differs')
    record = dict(format=1, decodedRecordSha256=DIGEST, producer=producer(), textures=rows,
                  limits=['Lossless software-decoded pixel transport, not native GPU parity.',
                          'Extract every authored rectangle as a separate mip; never sample the container as an atlas.',
                          'Private staging only; no public assets, runtime effects or simulation changes.'])
    outputs.append((output / 'textures.json', (json.dumps(record, indent=2) + '\n').encode()))
    # Preflight the complete set before creating any missing file.
    for path, raw in outputs:
        require(not path.is_symlink(), 'Packed output cannot be a symlink')
        require(not check or path.exists(), 'Missing packed output: ' + str(path))
        require(not path.exists() or path.read_bytes() == raw, 'Conflicting packed output: ' + str(path))
    if not check:
        for path, raw in outputs:
            if not path.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                with path.open('xb') as stream:
                    stream.write(raw)
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=Path('.cache/baron-attack-textures-packed'))
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    decoded = DECODER['check_record'](RECORD, DIGEST, Path('.cache/baron-attack-sources'),
                                      Path('.cache/baron-attack-decoded'))
    record = build(decoded, args.output_dir, args.check)
    print(json.dumps(dict(status='passed', textures=25, authoredMips=214,
                          packedBytes=sum(t['bytes'] for t in record['textures']),
                          recordSha256=sha((args.output_dir / 'textures.json').read_bytes()),
                          runtimeChanged=False)))


if __name__ == '__main__':
    main()
