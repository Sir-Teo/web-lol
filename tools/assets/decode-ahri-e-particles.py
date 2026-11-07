"""Retain every authored Ahri E texture mip and byte-exact flag-2 mesh privately."""
import argparse
import io
import json
import platform
import re
import runpy
import struct
import sys
import zlib
from pathlib import Path
from ahri_e_particles import PIN_SHA256, SOURCE_ROOT, cache_path, checked, check_files, load, require
from ahri_q_decode import scb_mesh, scb_bytes
from masteryi_q_decode import tex_levels, single_mip_tex, png_rgba8, sha

RECORD = Path('docs/reference/ahri/e-particles-decoded.json')
OUTPUT = Path('.cache/ahri-e-particles-decoded-v1')
RECORD_SHA256 = 'db521bcff91bf5d9bbccd99f6a8495be9825320789edf3e9487ffe53090cf96b'
EXPORT_SHA256 = '225ce9d8fb41dc36a17342a7a86dbfc4d5dae51f80316e6a8f065ea878972096'
LAYOUT_REVISION = '76bf57bf4fd195343dec610bf0f912a06b910914'
LAYOUT = {'StaticMesh.cs': 'eab04b1454081c56f86d93f568f804b812b8e3dbe44f99caea9efd2eff9272da', 'StaticMeshFace.cs': '053418afb28e627ff0709975ef4d5b363e0e44508a6efba27c5243064fb45a37', 'Texture.cs': '60d56e23760b212b78f10e41c4a7f73cd345969e2031df6a9813e6b8e4e692a6'}


def file_row(path):
    path = Path(path).resolve(); raw = path.read_bytes()
    return dict(path=str(path), bytes=len(raw), sha256=sha(raw))


def output_path(path):
    path = Path(path)
    require(not any(p.is_symlink() for p in [path, *path.parents]), 'Decode output cannot contain symlinks')
    return path


def generate(sources, output):
    pin, _ = load(); check_files(pin, sources)
    from PIL import Image, DdsImagePlugin, PngImagePlugin
    import PIL
    import cdtb.export
    checked(cdtb.export.__file__, EXPORT_SHA256)
    # Use the frozen source-independent layout references without modifying
    # the historical decoder, its helpers or its expected record hashes.
    references = runpy.run_path(str(Path(__file__).with_name('decode-masteryi-q-particles.py')))['layout_references']()
    require({r['name']: r['sha256'] for r in references} == LAYOUT, 'Pinned layout references differ')
    textures, meshes, outputs = [], [], []
    for row in pin['extraction']['files']:
        raw = checked(cache_path(sources, row), row['sha256'], row['bytes'])
        if row['path'].endswith('.tex'):
            info = tex_levels(raw); levels = []
            for level in info.pop('levels'):
                dds = cdtb.export.TexConverter.tex_to_dds(single_mip_tex(raw, level))
                image = Image.open(io.BytesIO(dds)).convert('RGBA')
                require(image.size == (level['width'], level['height']), 'Ahri mip decoder resized source')
                rgba = image.tobytes(); clean = Image.frombytes('RGBA', image.size, rgba)
                stream = io.BytesIO(); clean.save(stream, format='PNG', optimize=False, compress_level=9)
                png = stream.getvalue(); require(png_rgba8(png, *image.size) == rgba, 'Independent PNG replay differs')
                path = output_path(output / 'textures' / f"{row['wadPathHash']}-mip{level['level']}.png")
                outputs.append((path, png)); alpha = rgba[3::4]
                levels.append({**level, 'path': str(path), 'bytes': len(png), 'sha256': sha(png), 'rgbaSha256': sha(rgba), 'minimumAlpha': min(alpha), 'maximumAlpha': max(alpha), 'transparentPixels': alpha.count(0), 'opaquePixels': alpha.count(255)})
            textures.append({'source': row, **info, 'levels': levels})
        elif row['path'].endswith('.scb'):
            mesh = scb_mesh(raw); data = (json.dumps(mesh, indent=2, allow_nan=False) + '\n').encode()
            require(scb_bytes(json.loads(data)) == raw, 'Ahri mesh JSON round trip differs')
            path = output_path(output / 'meshes' / f"{row['wadPathHash']}.json"); outputs.append((path, data))
            meshes.append(dict(source=row, path=str(path), bytes=len(data), sha256=sha(data), sourceVertices=mesh['sourceVertices'], triangles=mesh['triangles'], flags=mesh['flags'], hasVertexColors=mesh['hasVertexColors'], sourceBounds=mesh['sourceBounds'], measuredMinMax=mesh['measuredMinMax'], centralPoint=mesh['centralPoint'], sourcePointFloat32Sha256=sha(struct.pack('<'+'f'*(len(mesh['sourcePoints'])*3), *(v for p in mesh['sourcePoints'] for v in p))), sourceIndexUInt32Sha256=sha(struct.pack('<'+'I'*len(mesh['sourceIndices']),*mesh['sourceIndices'])), sourceVertexBgraSha256=sha(bytes.fromhex(mesh['sourceVertexBgraHex'])), vertexRgbaSha256=sha(bytes.fromhex(mesh['vertexRgbaHex'])), byteExactNativeRoundTrip=True, normalsGenerated=False, unitScaleApplied=1))
    require(len(textures) == 20 and len(meshes) == 2 and sum(len(t['levels']) for t in textures) == 170, 'Ahri decode closure differs')
    modules = [Path(__file__).with_name('ahri_q_decode.py'), Path(__file__).with_name('masteryi_q_decode.py'), Path(cdtb.export.__file__), Path(PIL.__file__), Path(Image.__file__), Path(DdsImagePlugin.__file__), Path(PngImagePlugin.__file__), Path(Image.core.__file__), Path(sys.executable).resolve()]
    record = dict(format=1, sourcePinSha256=PIN_SHA256, layoutRevision=LAYOUT_REVISION, layoutReferences=references,
                  decoder=dict(python=sys.version, platform=platform.platform(), pillowVersion=PIL.__version__, pillowZlibVersion=Image.core.zlib_version, stdlibZlibVersion=zlib.ZLIB_VERSION, stdlibZlibRuntimeVersion=zlib.ZLIB_RUNTIME_VERSION, artifacts=[file_row(p) for p in modules]),
                  textures=textures, meshes=meshes,
                  limits=['Canonical Pillow BC1-with-alpha/BC3 software decode; no native GPU appearance certification.', 'Every authored mip retains its compressed identity, dimensions and straight RGBA pixels; no resized/generated mips, gamma conversion or premultiplication.', 'SCB 3.2 flag-2 points, indices, face UV/material bytes, optional vertex BGRA/RGBA, bounds and pivot remain byte-exact. No normals, reflection, winding, unit scale or pivot offset is applied.', 'Private decode only; no public assets, runtime history, renderer or callback bindings.'])
    return outputs, record


def check_record(record_path, sources, digest=RECORD_SHA256):
    require(re.fullmatch(r'[0-9a-f]{64}', digest) is not None, 'Ahri decode record hash is invalid')
    record = json.loads(checked(record_path, digest)); pin, _ = load(); check_files(pin, sources)
    require(record['sourcePinSha256'] == PIN_SHA256 and record['layoutRevision'] == LAYOUT_REVISION and {r['name']: r['sha256'] for r in record['layoutReferences']} == LAYOUT, 'Ahri decode source/layout differs')
    by_id = {r['wadPathHash']: r for r in pin['extraction']['files']}
    require(len(record['textures']) == 20 and {t['source']['wadPathHash'] for t in record['textures']} == {r['wadPathHash'] for r in by_id.values() if r['path'].endswith('.tex')}, 'Ahri decoded texture closure differs')
    require(len(record['meshes']) == 2 and {m['source']['wadPathHash'] for m in record['meshes']} == {r['wadPathHash'] for r in by_id.values() if r['path'].endswith('.scb')}, 'Ahri decoded mesh closure differs')
    for texture in record['textures']:
        row = texture['source']; require(row == by_id[row['wadPathHash']], 'Ahri decoded source differs')
        info = tex_levels(checked(cache_path(sources,row),row['sha256'],row['bytes'])); levels = info.pop('levels')
        require(all(texture[k] == v for k,v in info.items()) and len(levels) == len(texture['levels']), 'Ahri decoded header/mip count differs')
        for native, level in zip(levels,texture['levels'],strict=True):
            require(all(level[k] == v for k,v in native.items()), 'Ahri decoded source range differs')
            png = checked(output_path(level['path']),level['sha256'],level['bytes']); rgba = png_rgba8(png,level['width'],level['height']); alpha = rgba[3::4]
            require(sha(rgba) == level['rgbaSha256'] and (min(alpha),max(alpha),alpha.count(0),alpha.count(255)) == (level['minimumAlpha'],level['maximumAlpha'],level['transparentPixels'],level['opaquePixels']), 'Ahri decoded pixels/alpha differ')
    for mesh in record['meshes']:
        row = mesh['source']; require(row == by_id[row['wadPathHash']], 'Ahri decoded mesh source differs')
        data = json.loads(checked(output_path(mesh['path']),mesh['sha256'],mesh['bytes'])); raw = checked(cache_path(sources,row),row['sha256'],row['bytes'])
        require(scb_bytes(data) == raw and scb_mesh(raw) == data, 'Ahri mesh native round trip differs')
    return record


def publish(outputs):
    # Preflight the entire closure before writing any earlier mip or mesh.
    for path, raw in outputs:
        output_path(path)
        require(not path.exists() or path.read_bytes() == raw, 'Conflicting Ahri decoded output: '+str(path))
    for path,raw in outputs:
        if not path.exists():
            path.parent.mkdir(parents=True,exist_ok=True)
            with path.open('xb') as out: out.write(raw)


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');p.add_argument('--sources',type=Path,default=SOURCE_ROOT);p.add_argument('--output',type=Path,default=OUTPUT);p.add_argument('--record',type=Path,default=RECORD);p.add_argument('--record-sha256',default=RECORD_SHA256)
    args=p.parse_args();require(re.fullmatch(r'[0-9a-f]{64}',args.record_sha256) is not None,'Ahri decode record hash is invalid')
    if args.check: record=check_record(args.record,args.sources,args.record_sha256)
    else:
        outputs,record=generate(args.sources,args.output);data=(json.dumps(record,indent=2,allow_nan=False)+'\n').encode();require(sha(data)==args.record_sha256,'Decode profile differs; use a separately reviewed record/output and checksum');publish([*outputs,(args.record,data)])
    print(json.dumps(dict(textures=len(record['textures']),mips=sum(len(t['levels']) for t in record['textures']),meshes=len(record['meshes']),pngBytes=sum(l['bytes'] for t in record['textures'] for l in t['levels']),mode='check' if args.check else 'decode',runtimeChanged=False)))

if __name__ == '__main__':main()
