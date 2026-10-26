"""Stage the nine Wuju Style texture transports privately; no runtime dispatch."""
from pathlib import Path
import argparse
import importlib.util
import json
import zlib
from masteryi_e_particles import SOURCE_ROOT, checked, load, require
from masteryi_q_decode import png_rgba8, sha
from particle_mip_atlas import pack, unpack

OUTPUT = Path('.cache/masteryi-e-packed-v2')
SYSTEMS = ('MasterYi_E_SuperChraged_Sword1_buf', 'MasterYi_E_SuperChraged_Sword4_buf', 'MasterYi_E_SuperChraged_buf', 'MasterYi_E_Sword1_buf', 'MasterYi_E_Sword4_buf', 'MasterYi_E_buff')
TEXTURES = {'common_color-hold.tex', 'common_color-rampdown.tex', 'masteryi_base_e_flare.tex', 'masteryi_base_e_glowybeam.tex', 'masteryi_base_e_supercharged_flare.tex', 'masteryi_base_e_supercharged_glowybeam.tex', 'masteryi_e_wuju_beam.tex', 'masteryi_e_wuju_beam_mult.tex', 'masteryi_e_wuju_superchraged_beam.tex'}


def decoded_record(sources):
    spec = importlib.util.spec_from_file_location('masteryi_e_decoder', Path('tools/assets/decode-masteryi-e-particles.py'))
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module.check_record(module.RECORD, sources), module.RECORD_SHA256


def selected_textures(pin):
    paths = set()
    def visit(value):
        if isinstance(value, dict):
            for child in value.values(): visit(child)
        elif isinstance(value, list):
            for child in value: visit(child)
        elif isinstance(value, str) and value.lower().endswith('.tex'): paths.add(value.lower())
    for system, count in zip(SYSTEMS, (2, 1, 4, 2, 1, 4)):
        definition = pin['resources'][system]['definition']
        require(len(definition['complexEmitterDefinitionData']) == count, 'Wuju Style emitter closure differs')
        visit(definition)
    require({Path(p).name for p in paths} == TEXTURES and len(paths) == 9, 'Wuju Style texture closure differs')
    return paths


def build(sources, output):
    decoded, decoded_sha = decoded_record(sources); pin, _ = load()
    selected = selected_textures(pin); rows = []; outputs = []
    for texture in decoded['textures']:
        if texture['source']['path'].lower() not in selected: continue
        levels = []
        for level in texture['levels']:
            pixels = png_rgba8(checked(level['path'], level['sha256'], level['bytes']), level['width'], level['height'])
            require(sha(pixels) == level['rgbaSha256'], 'Source mip pixels differ')
            levels.append((level['width'], level['height'], pixels))
        png, atlas = pack(levels)
        path = output / (texture['source']['wadPathHash'] + '.png')
        rows.append({'source': texture['source'], 'path': str(path), 'bytes': len(png), 'sha256': sha(png), **atlas})
        outputs.append((path, png))
    require(len(rows) == 9, 'Missing Wuju Style texture')
    record = {'format': 1, 'decodedRecordSha256': decoded_sha, 'systems': list(SYSTEMS),
              'producer': {'scriptSha256': sha(Path(__file__).read_bytes()), 'atlasModuleSha256': sha(Path('tools/assets/particle_mip_atlas.py').read_bytes()), 'zlibVersion': zlib.ZLIB_VERSION, 'zlibRuntimeVersion': zlib.ZLIB_RUNTIME_VERSION},
              'textures': rows, 'limits': ['Lossless transport of canonical software-decoded authored mip pixels; native GPU parity is not established.',
              'Extract every rectangle as a distinct texture mip including level zero. Sampling the atlas directly is invalid.',
              'Private staging only; no runtime effect, simulation dispatch or public asset preload.']}
    outputs.append((output / 'textures.json', (json.dumps(record, indent=2) + '\n').encode()))
    return outputs, record


def verify(record, sources):
    decoded, digest = decoded_record(sources); pin, _ = load()
    require(record['format'] == 1 and record['decodedRecordSha256'] == digest and record['systems'] == list(SYSTEMS), 'Atlas source binding differs')
    selected = selected_textures(pin)
    require(len(record['textures']) == 9 and {r['source']['path'] for r in record['textures']} == selected, 'Atlas source closure differs')
    by_path = {r['source']['path']: r for r in decoded['textures']}
    for row in record['textures']:
        source = by_path[row['source']['path']]
        require(row['source'] == source['source'], 'Atlas native source differs')
        levels = unpack(checked(row['path'], row['sha256'], row['bytes']), row)
        require(len(levels) == len(source['levels']), 'Atlas authored mip count differs')
        for pixels, native, rect in zip(levels, source['levels'], row['rectangles']):
            require((rect['width'], rect['height'], sha(pixels)) == (native['width'], native['height'], native['rgbaSha256']), 'Atlas authored mip identity differs')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true'); parser.add_argument('--sources', type=Path, default=SOURCE_ROOT)
    parser.add_argument('--output', type=Path, default=OUTPUT); args = parser.parse_args()
    if args.check:
        record = json.loads((args.output / 'textures.json').read_bytes()); verify(record, args.sources)
    else:
        outputs, record = build(args.sources, args.output)
        for path, raw in outputs:
            if path.exists(): require(path.read_bytes() == raw, 'Conflicting packed output: ' + str(path))
        for path, raw in outputs:
            if not path.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                with path.open('xb') as stream: stream.write(raw)
        verify(record, args.sources)
    print(json.dumps({'textures': len(record['textures']), 'authoredMips': sum(len(r['rectangles']) for r in record['textures']), 'packedBytes': sum(r['bytes'] for r in record['textures']), 'mode': 'check' if args.check else 'pack', 'runtimeChanged': False}))


if __name__ == '__main__': main()
