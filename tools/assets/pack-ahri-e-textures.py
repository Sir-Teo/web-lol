"""Stage the complete Charm texture closure privately; no runtime dispatch."""
from pathlib import Path
import argparse
import importlib.util
import json
import zlib
from ahri_e_particles import SOURCE_ROOT, checked, load, require
from ahri_e_additional_particles import load as load_additional, SOURCE_ROOT as ADDITIONAL_SOURCE_ROOT
from masteryi_q_decode import png_rgba8, sha
from particle_mip_atlas import pack, unpack

OUTPUT = Path('.cache/ahri-e-packed-v1')
SYSTEMS = ('Ahri_E_buf', 'Ahri_E_cas', 'Ahri_E_mis', 'Ahri_E_tar', '{44fc6ec4}')


def safe_output(path):
    path = Path(path)
    require(not any(p.is_symlink() for p in [path, *path.parents]), 'Packed output cannot contain symlinks')
    return path


def combined_pin():
    base, _ = load(); additional, _ = load_additional()
    files = {}
    for row in base['extraction']['files'] + additional['extraction']['files']:
        require(row['path'] not in files or files[row['path']] == row, 'Conflicting shared source')
        files[row['path']] = row
    return dict(resources={**base['resources'], **additional['resources']}, extraction=dict(files=list(files.values())))


def decoded_record(sources, additional_sources=ADDITIONAL_SOURCE_ROOT):
    records, hashes = [], []
    for name, root in [('decode-ahri-e-particles.py', sources),
                       ('decode-ahri-e-additional-particles.py', additional_sources)]:
        spec = importlib.util.spec_from_file_location(name.replace('-', '_'), Path(__file__).with_name(name))
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        records.append(module.check_record(module.RECORD, root)); hashes.append(module.RECORD_SHA256)
    return dict(textures=[t for record in records for t in record['textures']]), hashes


def selected_textures(pin):
    paths = set()
    def visit(value):
        if isinstance(value, dict):
            for child in value.values(): visit(child)
        elif isinstance(value, list):
            for child in value: visit(child)
        elif isinstance(value, str) and value.lower().endswith('.tex'): paths.add(value.lower())
    for system, count in zip(SYSTEMS, (4, 4, 12, 6, 3)):
        definition = pin['resources'][system]['definition']
        require(len(definition.get('complexEmitterDefinitionData', [])) == count, 'Charm emitter closure differs')
        visit(definition)
    expected = {row['path'] for row in pin['extraction']['files'] if row['path'].endswith('.tex')}
    require(paths == expected and len(paths) == 22, 'Charm texture closure differs')
    return paths


def build(sources, output):
    decoded, decoded_sha = decoded_record(sources); pin = combined_pin()
    selected = selected_textures(pin); rows = []; outputs = []
    for texture in decoded['textures']:
        if texture['source']['path'].lower() not in selected: continue
        levels = []
        for level in texture['levels']:
            pixels = png_rgba8(checked(level['path'], level['sha256'], level['bytes']), level['width'], level['height'])
            require(sha(pixels) == level['rgbaSha256'], 'Source mip pixels differ')
            levels.append((level['width'], level['height'], pixels))
        png, atlas = pack(levels)
        path = safe_output(output / (texture['source']['wadPathHash'] + '.png'))
        rows.append({'source': texture['source'], 'path': str(path), 'bytes': len(png), 'sha256': sha(png), **atlas})
        outputs.append((path, png))
    require(len(rows) == 22, 'Missing Charm texture')
    record = {'format': 1, 'decodedRecordSha256': decoded_sha, 'systems': list(SYSTEMS),
              'producer': {'scriptSha256': sha(Path(__file__).read_bytes()), 'atlasModuleSha256': sha(Path(__file__).with_name('particle_mip_atlas.py').read_bytes()), 'zlibVersion': zlib.ZLIB_VERSION, 'zlibRuntimeVersion': zlib.ZLIB_RUNTIME_VERSION},
              'textures': rows, 'limits': ['Lossless transport of canonical software-decoded authored mip pixels; native GPU parity is not established.',
              'Extract every rectangle as a distinct texture mip including level zero. Sampling the atlas directly is invalid.',
              'Private staging only; no runtime effect, simulation dispatch or public asset preload.']}
    outputs.append((output / 'textures.json', (json.dumps(record, indent=2) + '\n').encode()))
    return outputs, record


def verify(record, sources):
    decoded, digest = decoded_record(sources); pin = combined_pin()
    require(record['format'] == 1 and record['decodedRecordSha256'] == digest and record['systems'] == list(SYSTEMS), 'Atlas source binding differs')
    require(record['producer'] == {'scriptSha256': sha(Path(__file__).read_bytes()), 'atlasModuleSha256': sha(Path(__file__).with_name('particle_mip_atlas.py').read_bytes()), 'zlibVersion': zlib.ZLIB_VERSION, 'zlibRuntimeVersion': zlib.ZLIB_RUNTIME_VERSION}, 'Atlas producer identity differs')
    selected = selected_textures(pin)
    require(len(record['textures']) == 22 and {r['source']['path'] for r in record['textures']} == selected, 'Atlas source closure differs')
    by_path = {r['source']['path']: r for r in decoded['textures']}
    for row in record['textures']:
        source = by_path[row['source']['path']]
        require(row['source'] == source['source'], 'Atlas native source differs')
        levels = unpack(checked(safe_output(row['path']), row['sha256'], row['bytes']), row)
        require(len(levels) == len(source['levels']), 'Atlas authored mip count differs')
        for pixels, native, rect in zip(levels, source['levels'], row['rectangles']):
            require((rect['width'], rect['height'], sha(pixels)) == (native['width'], native['height'], native['rgbaSha256']), 'Atlas authored mip identity differs')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true'); parser.add_argument('--sources', type=Path, default=SOURCE_ROOT)
    parser.add_argument('--output', type=Path, default=OUTPUT); args = parser.parse_args()
    if args.check:
        record = json.loads(safe_output(args.output / 'textures.json').read_bytes()); verify(record, args.sources)
    else:
        outputs, record = build(args.sources, args.output)
        for path, raw in outputs:
            safe_output(path)
            if path.exists(): require(path.read_bytes() == raw, 'Conflicting packed output: ' + str(path))
        for path, raw in outputs:
            if not path.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                with path.open('xb') as stream: stream.write(raw)
        verify(record, args.sources)
    print(json.dumps({'textures': len(record['textures']), 'authoredMips': sum(len(r['rectangles']) for r in record['textures']), 'packedBytes': sum(r['bytes'] for r in record['textures']), 'mode': 'check' if args.check else 'pack', 'runtimeChanged': False}))


if __name__ == '__main__': main()
