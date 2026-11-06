"""Decode all native Baron attack mips and byte-round-trippable colored SCBs privately."""
import argparse
import io
import json
import platform
import re
import runpy
import sys
import zlib
from pathlib import Path

from baron_attack_decode import require, scb_bytes, scb_mesh
from masteryi_q_decode import png_rgba8, sha, single_mip_tex, tex_levels

SOURCE_PIN = Path('docs/reference/baron-attack-source.json')
SOURCE_SHA256 = '4b300f952b2a768e1eaa5c5f9eda3dd397e457ba1ead19c10fbd9aaa02c3543a'
EXPORT_SHA256 = '225ce9d8fb41dc36a17342a7a86dbfc4d5dae51f80316e6a8f065ea878972096'
ENGINE_PATH = Path('tools/assets/decode-masteryi-q-particles.py')
ENGINE = runpy.run_path(str(ENGINE_PATH))


def checked(path, digest, size=None):
    path = Path(path)
    require(not path.is_symlink(), 'Decoded/source path cannot be a symlink')
    raw = path.read_bytes()
    require(sha(raw) == digest and (size is None or len(raw) == size), 'Input differs: ' + str(path))
    return raw


def load_sources(root):
    pin = json.loads(checked(SOURCE_PIN, SOURCE_SHA256))
    rows = pin['extraction']['files']
    require(len(rows) == 29 and len({row['path'] for row in rows}) == 29, 'Baron source closure differs')
    # Preflight every original input before decoding or writing any output.
    result = []
    for row in rows:
        path = Path(row['path'])
        require(not path.is_absolute() and '..' not in path.parts, 'Invalid source path')
        result.append((row, checked(root / path, row['sha256'], row['bytes'])))
    return result


def helper_inputs():
    paths = [Path(__file__), Path('tools/assets/baron_attack_decode.py'),
             Path('tools/assets/masteryi_q_decode.py'), ENGINE_PATH]
    return [dict(path=str(path), sha256=sha(path.read_bytes())) for path in paths]


def generate(sources):
    originals = load_sources(sources)
    from PIL import Image
    import PIL
    import cdtb.export
    checked(cdtb.export.__file__, EXPORT_SHA256)
    references = ENGINE['layout_references']()
    outputs, textures, meshes = [], [], []
    for row, raw in originals:
        if row['path'].endswith('.tex'):
            info = tex_levels(raw)
            levels = []
            for native in info.pop('levels'):
                dds = cdtb.export.TexConverter.tex_to_dds(single_mip_tex(raw, native))
                image = Image.open(io.BytesIO(dds)).convert('RGBA')
                require(image.size == (native['width'], native['height']), 'TEX decode resized a native mip')
                rgba = image.tobytes()
                stream = io.BytesIO()
                Image.frombytes('RGBA', image.size, rgba).save(stream, format='PNG', optimize=False, compress_level=9)
                png = stream.getvalue()
                require(png_rgba8(png, *image.size) == rgba, 'Independent PNG replay differs')
                relative = f"textures/{row['wadPathHash']}-mip{native['level']}.png"
                outputs.append((relative, png))
                alpha = rgba[3::4]
                levels.append(dict(**native, path=relative, bytes=len(png), sha256=sha(png),
                                   rgbaSha256=sha(rgba), minimumAlpha=min(alpha), maximumAlpha=max(alpha),
                                   transparentPixels=alpha.count(0), opaquePixels=alpha.count(255)))
            textures.append(dict(source=row, **info, levels=levels))
        elif row['path'].endswith('.scb'):
            mesh = scb_mesh(raw)
            data = (json.dumps(mesh, indent=2, allow_nan=False) + '\n').encode()
            require(scb_bytes(json.loads(data)) == raw, 'SCB JSON round trip differs')
            relative = f"meshes/{row['wadPathHash']}.json"
            outputs.append((relative, data))
            meshes.append(dict(source=row, path=relative, bytes=len(data), sha256=sha(data),
                               vertices=mesh['sourceVertices'], triangles=mesh['triangles'],
                               vertexBgraBytes=len(bytes.fromhex(mesh['sourceVertexBgraHex'])),
                               vertexBgraSha256=sha(bytes.fromhex(mesh['sourceVertexBgraHex'])),
                               byteExactNativeRoundTrip=True, normalsGenerated=False, unitScaleApplied=1))
    require(len(textures) == 25 and len(meshes) == 2 and
            sum(len(texture['levels']) for texture in textures) == 214, 'Decoded Baron closure differs')
    record = dict(format=1, sourcePinSha256=SOURCE_SHA256,
                  layoutRevision=ENGINE['LAYOUT_REVISION'], layoutReferences=references,
                  helpers=helper_inputs(),
                  decoder=dict(python=sys.version, platform=platform.platform(), pillow=PIL.__version__,
                               pillowZlib=Image.core.zlib_version, zlibCompile=zlib.ZLIB_VERSION,
                               zlibRuntime=zlib.ZLIB_RUNTIME_VERSION,
                               cdtbExportSha256=EXPORT_SHA256,
                               pythonExecutableSha256=sha(Path(sys.executable).resolve().read_bytes())),
                  textures=textures, meshes=meshes,
                  limits=['Canonical Pillow BC1/BC3 decode, not a native GPU/visual certificate.',
                          'Every authored mip keeps its original dimensions and block identity; no resize, generated mips, gamma conversion or premultiplication.',
                          'Native points, BGRA bytes, face indices/UV/material bytes, pivot and header are retained. No normals, unit conversion, reflection, winding or material interpretation.',
                          'Private decoded files only; runtime still uses the provisional marker.'])
    return outputs, record


def safe_output(root, relative):
    path = Path(relative)
    require(not path.is_absolute() and '..' not in path.parts and
            path.parts[0] in ('textures', 'meshes'), 'Invalid decoded asset path')
    return root / path


def check_record(record_path, digest, sources, output):
    require(digest is not None and re.fullmatch(r'[0-9a-f]{64}', digest), 'Check requires --record-sha256')
    record = json.loads(checked(record_path, digest))
    originals = {row['path']: (row, raw) for row, raw in load_sources(sources)}
    require(record['sourcePinSha256'] == SOURCE_SHA256 and record['helpers'] == helper_inputs(),
            'Decoded source/helper identities differ')
    require(record['layoutRevision'] == ENGINE['LAYOUT_REVISION'] and
            {row['name']: row['sha256'] for row in record['layoutReferences']} == ENGINE['LAYOUT'],
            'Decoded layout references differ')
    require(len(record['textures']) == 25 and len(record['meshes']) == 2, 'Decoded asset counts differ')
    seen = set()
    for texture in record['textures']:
        row, raw = originals[texture['source']['path']]
        require(row == texture['source'] and row['path'] not in seen, 'Decoded texture source differs')
        seen.add(row['path'])
        info = tex_levels(raw)
        native_levels = info.pop('levels')
        require(all(texture[key] == value for key, value in info.items()) and
                len(native_levels) == len(texture['levels']), 'Decoded TEX header/mips differ')
        for native, level in zip(native_levels, texture['levels']):
            require(all(level[key] == value for key, value in native.items()), 'Decoded native mip range differs')
            png = checked(safe_output(output, level['path']), level['sha256'], level['bytes'])
            rgba = png_rgba8(png, level['width'], level['height'])
            alpha = rgba[3::4]
            require(sha(rgba) == level['rgbaSha256'] and
                    (min(alpha), max(alpha), alpha.count(0), alpha.count(255)) ==
                    (level['minimumAlpha'], level['maximumAlpha'], level['transparentPixels'], level['opaquePixels']),
                    'Decoded RGBA/alpha differs')
    for mesh in record['meshes']:
        row, raw = originals[mesh['source']['path']]
        require(row == mesh['source'] and row['path'] not in seen, 'Decoded mesh source differs')
        seen.add(row['path'])
        parsed = json.loads(checked(safe_output(output, mesh['path']), mesh['sha256'], mesh['bytes']))
        require(parsed == scb_mesh(raw) and scb_bytes(parsed) == raw, 'Decoded mesh round trip differs')
        require(sha(bytes.fromhex(parsed['sourceVertexBgraHex'])) == mesh['vertexBgraSha256'],
                'Decoded vertex colors differ')
    require(seen == {path for path in originals if path.endswith(('.tex', '.scb'))}, 'Decoded closure differs')
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sources', type=Path, default=Path('.cache/baron-attack-sources'))
    parser.add_argument('--output-dir', type=Path, default=Path('.cache/baron-attack-decoded'))
    parser.add_argument('--record', type=Path, default=Path('docs/reference/baron-attack-decoded.json'))
    parser.add_argument('--record-sha256')
    parser.add_argument('--discover', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    require(not (args.discover and args.check), 'Discovery and check modes are exclusive')
    if args.check:
        record = check_record(args.record, args.record_sha256, args.sources, args.output_dir)
    else:
        existing = args.record.read_bytes() if args.record.exists() else None
        require(not args.discover or existing is None, 'Discovery cannot overwrite a decoded record')
        require(existing is not None or (args.discover and not args.output_dir.exists()),
                'First decode requires --discover and a fresh output directory')
        outputs, record = generate(args.sources)
        encoded = (json.dumps(record, indent=2, allow_nan=False) + '\n').encode()
        require(existing is None or existing == encoded, 'Decoded record/build profile differs')
        # Preflight the complete output set before creating any missing file.
        for relative, raw in outputs:
            path = safe_output(args.output_dir, relative)
            require(not path.is_symlink(), 'Decoded output cannot redirect through a symlink')
            require(not path.exists() or path.read_bytes() == raw, 'Conflicting decoded output: ' + str(path))
        for relative, raw in outputs:
            path = safe_output(args.output_dir, relative)
            if not path.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                with path.open('xb') as stream:
                    stream.write(raw)
        if existing is None:
            args.record.parent.mkdir(parents=True, exist_ok=True)
            with args.record.open('xb') as stream:
                stream.write(encoded)
    print(json.dumps(dict(status='passed', textures=len(record['textures']),
                          mips=sum(len(texture['levels']) for texture in record['textures']),
                          meshes=len(record['meshes']), recordSha256=sha(args.record.read_bytes()),
                          pngBytes=sum(level['bytes'] for texture in record['textures'] for level in texture['levels']),
                          runtimeChanged=False)))


if __name__ == '__main__':
    main()
