"""Decode every authored Q mip and retain byte-round-trippable SCB data privately."""
from pathlib import Path
import argparse
import io
import json
import platform
import re
import struct
import subprocess
import sys
import zlib
from masteryi_q_particles import PIN_SHA256, SOURCE_ROOT, cache_path, checked, check_files, load, require
from masteryi_q_decode import png_rgba8, scb_bytes, scb_mesh, sha, single_mip_tex, tex_levels

RECORD = Path('docs/reference/masteryi/q-particles-decoded.json')
OUTPUT = Path('.cache/masteryi-q-particles-decoded')
RECORD_SHA256 = '783317cf9c44a36b3e07fbda8d27829ec6ae674119fcb5c8fddac46a959360fd'
EXPORT_SHA256 = '225ce9d8fb41dc36a17342a7a86dbfc4d5dae51f80316e6a8f065ea878972096'
LAYOUT_REVISION = '76bf57bf4fd195343dec610bf0f912a06b910914'
LAYOUT = {'StaticMesh.cs': 'eab04b1454081c56f86d93f568f804b812b8e3dbe44f99caea9efd2eff9272da', 'StaticMeshFace.cs': '053418afb28e627ff0709975ef4d5b363e0e44508a6efba27c5243064fb45a37', 'Texture.cs': '60d56e23760b212b78f10e41c4a7f73cd345969e2031df6a9813e6b8e4e692a6'}


def file_row(path):
    path = Path(path); data = path.read_bytes()
    return {'path': str(path), 'bytes': len(data), 'sha256': sha(data)}


def layout_references():
    rows = []
    for name, digest in LAYOUT.items():
        folder = 'Renderer' if name == 'Texture.cs' else 'Mesh'
        url = f'https://raw.githubusercontent.com/LeagueToolkit/LeagueToolkit/{LAYOUT_REVISION}/src/LeagueToolkit/Core/{folder}/{name}'
        path = Path('.cache/masteryi-q-particle-readers') / name
        if not path.exists():
            raw = subprocess.check_output(['curl', '-fLsS', '--max-time', '45', url])
            require(sha(raw) == digest, 'Layout reference differs before write'); path.parent.mkdir(parents=True, exist_ok=True)
            with path.open('xb') as out: out.write(raw)
        checked(path, digest); rows.append({'name': name, 'url': url, 'sha256': digest})
    return rows


def generate(sources, output, *, source_load=load, source_pin_sha256=PIN_SHA256, texture_count=23, mesh_count=2, mesh_layouts=((5, 24),)):
    pin, _ = source_load(); check_files(pin, sources)
    from PIL import Image, DdsImagePlugin, PngImagePlugin
    import PIL
    import cdtb.export
    checked(cdtb.export.__file__, EXPORT_SHA256)
    readers = layout_references()
    textures, meshes, outputs = [], [], []
    for row in pin['extraction']['files']:
        raw = checked(cache_path(sources, row), row['sha256'], row['bytes'])
        if row['path'].endswith('.tex'):
            info = tex_levels(raw); levels = []
            for level in info.pop('levels'):
                dds = cdtb.export.TexConverter.tex_to_dds(single_mip_tex(raw, level))
                image = Image.open(io.BytesIO(dds)).convert('RGBA')
                require(image.size == (level['width'], level['height']), 'Mip decoder resized source')
                rgba = image.tobytes(); clean = Image.frombytes('RGBA', image.size, rgba)
                stream = io.BytesIO(); clean.save(stream, format='PNG', optimize=False, compress_level=9)
                png = stream.getvalue(); require(png_rgba8(png, *image.size) == rgba, 'Independent PNG replay differs')
                path = output / 'textures' / f"{row['wadPathHash']}-mip{level['level']}.png"
                outputs.append((path, png)); alpha = rgba[3::4]
                levels.append({**level, 'path': str(path), 'bytes': len(png), 'sha256': sha(png), 'rgbaSha256': sha(rgba), 'minimumAlpha': min(alpha), 'maximumAlpha': max(alpha), 'transparentPixels': alpha.count(0), 'opaquePixels': alpha.count(255)})
            textures.append({'source': row, **info, 'levels': levels})
        elif row['path'].endswith('.scb'):
            mesh = scb_mesh(raw, allowed_layouts=mesh_layouts); data = (json.dumps(mesh, indent=2, allow_nan=False) + '\n').encode()
            require(scb_bytes(json.loads(data)) == raw, 'JSON mesh round trip differs')
            path = output / 'meshes' / f"{row['wadPathHash']}.json"; outputs.append((path, data))
            meshes.append({'source': row, 'path': str(path), 'bytes': len(data), 'sha256': sha(data), 'sourceVertices': mesh['sourceVertices'], 'triangles': mesh['triangles'], 'flags': mesh['flags'], 'sourceBounds': mesh['sourceBounds'], 'measuredMinMax': mesh['measuredMinMax'], 'centralPoint': mesh['centralPoint'], 'tailHex': mesh['tailHex'], 'sourcePointFloat32Sha256': sha(struct.pack('<' + 'f' * (len(mesh['sourcePoints']) * 3), *(v for point in mesh['sourcePoints'] for v in point))), 'sourceIndexUInt32Sha256': sha(struct.pack('<' + 'I' * len(mesh['sourceIndices']), *mesh['sourceIndices'])), 'sourceFaceRgbSha256': sha(bytes.fromhex(mesh['sourceFaceRgbHex'])), 'byteExactNativeRoundTrip': True, 'normalsGenerated': False, 'unitScaleApplied': 1})
    require(len(textures) == texture_count and len(meshes) == mesh_count, 'Decode closure differs')
    modules = [Path(cdtb.export.__file__), Path(PIL.__file__), Path(Image.__file__), Path(DdsImagePlugin.__file__), Path(PngImagePlugin.__file__), Path(Image.core.__file__), Path(sys.executable).resolve()]
    record = {'format': 1, 'sourcePinSha256': source_pin_sha256, 'layoutRevision': LAYOUT_REVISION, 'layoutReferences': readers,
        'decoder': {'python': sys.version, 'platform': platform.platform(), 'pillowVersion': PIL.__version__, 'pillowZlibVersion': Image.core.zlib_version, 'stdlibZlibVersion': zlib.ZLIB_VERSION, 'stdlibZlibRuntimeVersion': zlib.ZLIB_RUNTIME_VERSION, 'stdlibZlibModuleKind': 'file' if getattr(zlib, '__file__', None) else 'builtin', 'artifacts': [file_row(p) for p in modules]},
        'textures': textures, 'meshes': meshes, 'limits': ['Canonical Pillow BC1-with-alpha/BC3 software decode, not a native GPU decoding/visual certificate.', 'Every authored mip retains its own size, compressed block identity and RGBA; no resize, generated mips, gamma conversion or premultiplication.', 'Source mesh points/indices/face UV/material bytes/RGB/pivot/header and unparsed tail are retained. No normals, pivot offset, reflection, winding, unit scale or emitter/material behavior is applied.', 'Private decode only; no public files or runtime bindings.']}
    return outputs, record


def check_record(record_path, sources, record_sha256=RECORD_SHA256, *, source_load=load, source_pin_sha256=PIN_SHA256, texture_count=23, mesh_count=2, mesh_layouts=((5, 24),)):
    require(re.fullmatch(r'[0-9a-f]{64}', record_sha256) is not None, 'Decode record hash is invalid')
    record = json.loads(checked(record_path, record_sha256)); pin, _ = source_load(); check_files(pin, sources)
    require(record['sourcePinSha256'] == source_pin_sha256 and record['layoutRevision'] == LAYOUT_REVISION, 'Decode record source/layout differs')
    require({r['name']: r['sha256'] for r in record['layoutReferences']} == LAYOUT and len(record['layoutReferences']) == 3, 'Decoded layout references differ')
    by_id = {r['wadPathHash']: r for r in pin['extraction']['files']}
    require(len(record['textures']) == texture_count and {r['source']['wadPathHash'] for r in record['textures']} == {r['wadPathHash'] for r in by_id.values() if r['path'].endswith('.tex')}, 'Decoded texture closure differs')
    require(len(record['meshes']) == mesh_count and {r['source']['wadPathHash'] for r in record['meshes']} == {r['wadPathHash'] for r in by_id.values() if r['path'].endswith('.scb')}, 'Decoded mesh closure differs')
    for texture in record['textures']:
        row = texture['source']; require(row == by_id[row['wadPathHash']], 'Decoded texture source differs')
        info = tex_levels(checked(cache_path(sources, row), row['sha256'], row['bytes'])); levels = info.pop('levels')
        require(all(texture[k] == v for k, v in info.items()) and len(levels) == len(texture['levels']), 'Decoded texture header/mips differ')
        for native, level in zip(levels, texture['levels']):
            require(all(level[k] == v for k, v in native.items()), 'Decoded mip source range differs')
            png = checked(level['path'], level['sha256'], level['bytes']); rgba = png_rgba8(png, level['width'], level['height'])
            require(sha(rgba) == level['rgbaSha256'], 'Decoded mip pixels differ')
            alpha = rgba[3::4]
            require((min(alpha), max(alpha), alpha.count(0), alpha.count(255)) == (level['minimumAlpha'], level['maximumAlpha'], level['transparentPixels'], level['opaquePixels']), 'Decoded alpha statistics differ')
    for mesh in record['meshes']:
        row = mesh['source']; require(row == by_id[row['wadPathHash']], 'Decoded mesh source differs')
        data = json.loads(checked(mesh['path'], mesh['sha256'], mesh['bytes']))
        raw = checked(cache_path(sources, row), row['sha256'], row['bytes'])
        require(scb_bytes(data) == raw and scb_mesh(raw, allowed_layouts=mesh_layouts) == data, 'Decoded mesh native round trip differs')
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--check', action='store_true')
    parser.add_argument('--sources', type=Path, default=SOURCE_ROOT); parser.add_argument('--output', type=Path, default=OUTPUT); parser.add_argument('--record', type=Path, default=RECORD)
    parser.add_argument('--record-sha256', default=RECORD_SHA256, help='Explicitly reviewed checksum when using a separate build profile/record/output path')
    args = parser.parse_args()
    require(re.fullmatch(r'[0-9a-f]{64}', args.record_sha256) is not None, 'Decode record hash is invalid')
    if args.check: record = check_record(args.record, args.sources, args.record_sha256)
    else:
        outputs, record = generate(args.sources, args.output)
        data = (json.dumps(record, indent=2, allow_nan=False) + '\n').encode()
        require(sha(data) == args.record_sha256, 'Decode build/profile differs; use a separately reviewed record/output path and checksum')
        outputs.append((args.record, data))
        for path, raw in outputs:
            if path.exists(): require(path.read_bytes() == raw, 'Conflicting decoded output: ' + str(path))
        for path, raw in outputs:
            if not path.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                with path.open('xb') as out: out.write(raw)
    print(json.dumps({'textures': len(record['textures']), 'mips': sum(len(t['levels']) for t in record['textures']), 'meshes': len(record['meshes']), 'pngBytes': sum(m['bytes'] for t in record['textures'] for m in t['levels']), 'mode': 'check' if args.check else 'decode', 'runtimeChanged': False}))


if __name__ == '__main__': main()
