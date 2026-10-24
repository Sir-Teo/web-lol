"""Pin six unlit-decal permutations and bounded projection readers; no native target/shader executes.

Run with PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python.
--check reads retained pins/cache only: no network, compiler or RiotArchive import.
Native R dispatch, receiving triangles, matrices and sampler/state bindings remain unresolved.
"""
import argparse
import ast
import hashlib
import itertools
import json
from pathlib import Path
import struct
import subprocess

ROOT = Path('.cache/leona-r-decal-shaders-v2-20261024')
PIN = Path('docs/reference/leona-r-decal-shaders.json')
READER = Path('tools/assets/export-particle-shaders.py')
SOURCE_PIN = Path('docs/reference/particle-shaders.json')
PREFIX = 'assets/shaders/hlsl/environment/'
REQUESTS = {'unlit_decal_vs.vs-metal': [([], 1), (['DISABLE_FOW'], 0)],
            'unlit_decal_ps.ps-metal': [([], 8), (['DISABLE_FOW'], 0),
                                      (['DISABLE_FOW', 'PALETTIZE_TEXTURES'], 11),
                                      (['PALETTIZE_TEXTURES'], 38)]}


READERS = [{'file': 'components/Projections.tsx', 'url': 'https://raw.githubusercontent.com/LeagueToolkit/ltk-manager/2adda384347dd43e76d6295d77fe1f13623b2808/src/modules/workshop/bin/vfx/rendering/components/Projections.tsx', 'bytes': 5139, 'sha256': '7d29a8b7d8f71108cb8d30521b8cf378b56c6531ade8c9e3e49511244da207e2', 'revision': '2adda384347dd43e76d6295d77fe1f13623b2808'}, {'file': 'shaders/projection.ts', 'url': 'https://raw.githubusercontent.com/LeagueToolkit/ltk-manager/2adda384347dd43e76d6295d77fe1f13623b2808/src/modules/workshop/bin/vfx/rendering/shaders/projection.ts', 'bytes': 2425, 'sha256': 'c0f8026f53a83e1f225e66a1d6300cc8f4e2b021412c85fbcef995e0e8deb0be', 'revision': '2adda384347dd43e76d6295d77fe1f13623b2808'}, {'file': 'utils/projection.ts', 'url': 'https://raw.githubusercontent.com/LeagueToolkit/ltk-manager/2adda384347dd43e76d6295d77fe1f13623b2808/src/modules/workshop/bin/vfx/rendering/utils/projection.ts', 'bytes': 2230, 'sha256': '60d151e8ec8063954b0a4039dc79e1488b4e925612c67548c7dedd83ba7c48b9', 'revision': '2adda384347dd43e76d6295d77fe1f13623b2808'}, {'file': 'utils/stencil.ts', 'url': 'https://raw.githubusercontent.com/LeagueToolkit/ltk-manager/2adda384347dd43e76d6295d77fe1f13623b2808/src/modules/workshop/bin/vfx/rendering/utils/stencil.ts', 'bytes': 6025, 'sha256': '3da32a99e72d60440ee263cff679e1dfc5a6bec79861d12aa605d618b84efd09', 'revision': '2adda384347dd43e76d6295d77fe1f13623b2808'}, {'file': 'state/stencil.ts', 'url': 'https://raw.githubusercontent.com/LeagueToolkit/ltk-manager/2adda384347dd43e76d6295d77fe1f13623b2808/src/modules/workshop/bin/vfx/rendering/state/stencil.ts', 'bytes': 3111, 'sha256': 'c8268bcef493bc1f4ee4245bab55b3332bdc9ea9cf3517f9380c12a792420c96', 'revision': '2adda384347dd43e76d6295d77fe1f13623b2808'}]
OBSERVATIONS = [{'id': 'DECAL-VS-INPUTS', 'source': 'unlit_decal_vs.vs-metal-0.ll:274-278', 'observation': 'Input float3 ATTR0 location0; PerFrameVertexCB buffer1/560bytes; ParticleDecalVS buffer7/144bytes: WORLD_MATRIX@0, WORLD_TO_UV_MATRIX@64, PROJECTION_Y_RANGE@128.'}, {'id': 'DECAL-VS-POSITION-UV', 'source': 'unlit_decal_vs.vs-metal-0.ll:26-123,150-235', 'observation': 'Homogeneous input transforms by DECAL_WORLD_MATRIX. U=dot(world,UVstoredVector0); V=1-dot(world,UVstoredVector2); clip uses VIEW_PROJECTION_MATRIX, not mProj. No shader flatten-to-ground or sampling of terrain/depth; terrain triangle selection/world matrix setup are CPU unknowns.'}, {'id': 'DECAL-VS-FADE', 'source': 'unlit_decal_vs.vs-metal-0.ll:124-145', 'observation': 'gap=abs(world.y-Y_RANGE.x). Fade=1 if gap<=Y_RANGE.y, else1-(gap-Y_RANGE.y)/Y_RANGE.z. Vertex computed/interpolated. No epsilon guard or saturation in VS.'}, {'id': 'DECAL-PS-COLOR', 'source': 'unlit_decal_ps.ps-metal-0.ll:10-30,64-69', 'observation': 'L=sample(diffuse,UV)*sample(particleLookup,COLOR_UV.xy)*MODULATE_COLOR. Output.rgb=L.rgb, output.a=L.a*max(interpolatedFade,0). No global remap stage or RGB clamp in selected native code. DiffuseTex0/Smp0; lookupTex1/Smp1; LocalsFragment buffer16/32bytes: COLOR_UV@0,MODULATE_COLOR@16.'}, {'id': 'DECAL-PS-PALETTE', 'source': 'unlit_decal_ps.ps-metal-11.ll:10-38,77-84', 'observation': 'Base RGBA B -> palette at[clamp(dot(B,cPaletteSrcMixerMain),0,1),cPaletteSelectMain.x]+select.zw. Replace only B.rgb with palette.rgb; preserve B.a. Multiply lookup then MODULATE_COLOR; alpha-only max(fade,0). LocalsFragment16/64bytes: select@0,mixer@16,COLOR_UV@32,MODULATE_COLOR@48. PaletteTex0/Smp0,diffuseTex1/Smp1,lookupTex2/Smp2.'}, {'id': 'DECAL-FOW', 'source': 'unlit_decal_vs.vs-metal-1.ll:237-243;unlit_decal_ps.ps-metal-8.ll:25-34', 'observation': 'VS derives FOW UV from transformed world.xz*FOG_OF_WAR_PARAMS.xy+zw. Default PS multiplies RGB only by FOW sample alpha; height fade affects output alpha. Adds FOWTex0/Smp15; shifts diffuse and lookup textures to1/2, retains diffuse/lookup samplers0/1.'}]

OBSERVATIONS.append(dict(id='DECAL-FOW-PALETTE', source='unlit_decal_ps.ps-metal-38.ll:10-53,95-104', observation='Combined palette/FOW route preserves diffuse alpha, multiplies lookup/modulation, applies max(interpolated fade,0) to alpha and FOW alpha only to RGB. FOW/palette/diffuse/lookup textures0/1/2/3; palette/diffuse/lookup samplers0/1/2 and FOWsampler15.'))

def sha(data):
    return hashlib.sha256(data).hexdigest()


def retained_check():
    pin = json.loads(PIN.read_text())
    assert sha(READER.read_bytes()) == pin['tocReaderSha256']
    assert sha(SOURCE_PIN.read_bytes()) == pin['sourcePinSha256']
    for item in pin['externalReaders']:
        raw = Path(item['path']).read_bytes()
        assert len(raw) == item['bytes'] and sha(raw) == item['sha256'], item['path']
    for selection in pin['selections']:
        for kind in ['metallib', 'bitcode', 'disassembly']:
            item = selection[kind]
            raw = Path(item['path']).read_bytes()
            assert len(raw) == item['bytes'] and sha(raw) == item['sha256'], item['path']
        bundle = (ROOT / 'native' / selection['bundle']).read_bytes()
        raw = Path(selection['metallib']['path']).read_bytes()
        start = selection['bundleProgramOffset']
        assert struct.unpack_from('<I', bundle, start - 4)[0] == len(raw)
        assert bundle[start:start + len(raw)] == raw
        item = selection['bitcode']
        assert raw[item['offset']:item['offset'] + item['bytes']] == Path(item['path']).read_bytes()
    for item in pin['extraction']['files']:
        raw = (ROOT / 'native' / item['path']).read_bytes()
        assert len(raw) == item['bytes'] and sha(raw) == item['sha256'], item['path']
    print(json.dumps(dict(result='passed', programs=len(pin['selections']),
                          networkUsed=False, compilerUsed=False, nativeExecuted=False)))


def extract():
    from xxhash import xxh64_intdigest
    from riot_archive import RiotArchive
    namespace = dict(globals(), xxh64_intdigest=xxh64_intdigest)
    tree = ast.parse(READER.read_text())
    for name in ['decode_toc', 'programs']:
        definition = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == name)
        exec(compile(ast.Module(body=[definition], type_ignores=[]), str(READER), 'exec'), namespace)
    decode_toc, programs = namespace['decode_toc'], namespace['programs']
    source = json.loads(SOURCE_PIN.read_text())
    assert not PIN.exists(), 'Retained extraction exists; use --check.'
    ROOT.mkdir(exist_ok=True)
    external = []
    for item in READERS:
        path = ROOT / 'readers' / item['file']
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(['curl', '-fLsS', '--max-time', '30', item['url'], '-o', str(path)], check=True)
        raw = path.read_bytes()
        assert len(raw) == item['bytes'] and sha(raw) == item['sha256']
        external.append(dict(item, path=str(path)))
    paths = [PREFIX + name for name in REQUESTS]
    bundles = [PREFIX + 'unlit_decal_vs.vs-metal_0', PREFIX + 'unlit_decal_ps.ps-metal_0']
    # The older particle pin covers a different selection of this WAD. New
    # decal chunks must be recorded, while every overlapping input stays exact.
    archive = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in paths + bundles},
                          archive_name=source['extraction']['archive'])
    archive.extract(paths + bundles, ROOT / 'native')
    extraction = archive.provenance()
    assert extraction['manifest'] == source['extraction']['manifest']
    for key, value in extraction['chunks'].items():
        if key in source['extraction']['chunks']:
            assert value == source['extraction']['chunks'][key], key
    old_files = {item['path']: item for item in source['extraction']['files']}
    for item in extraction['files']:
        if item['path'] in old_files:
            assert item == old_files[item['path']], item['path']
    selections, tables = [], []
    for name, variants in REQUESTS.items():
        path = PREFIX + name
        defines, lookup, stage, count = decode_toc((ROOT / 'native' / path).read_bytes())
        tables.append(dict(path=path, stage=stage, defines=dict(defines),
                           variantCount=len(lookup), uniqueProgramCount=count))
        for extra, expected in variants:
            flags = extra
            selected = sorted((k, v) for k, v in defines if k in flags)
            assert len(selected) == len(flags)
            key = xxh64_intdigest(''.join(f'{k}={v}' for k, v in selected))
            program_id = lookup[key]
            assert program_id == expected
            bundle = path + '_' + str(program_id // 100 * 100)
            parsed = programs((ROOT / 'native' / bundle).read_bytes())
            index = program_id % 100
            raw = parsed[index]
            start = sum(4 + len(p) for p in parsed[:index]) + 4
            marker = bytes.fromhex('dec0170b')
            i = raw.index(marker)
            assert raw.find(marker, i + 1) == -1
            _, version, offset, size, cpu = struct.unpack_from('<5I', raw, i)
            assert version == 0 and offset == 20 and cpu == 4294967295
            bitcode = raw[i + offset:i + offset + size]
            assert len(bitcode) == size and bitcode[:4] == b'BC\xc0\xde'
            stem = ROOT / (name + '-' + str(program_id))
            metal, bc, ll = (Path(str(stem) + suffix) for suffix in ['.metallib', '.bc', '.ll'])
            metal.write_bytes(raw)
            bc.write_bytes(bitcode)
            proc = subprocess.run(['clang', '-S', '-emit-llvm', '-Xclang', '-disable-llvm-passes',
                                   str(bc), '-o', str(ll)], capture_output=True, text=True, check=True)
            assert '@wrapped_main' in ll.read_text()
            def record(file):
                data = file.read_bytes()
                return dict(path=str(file), bytes=len(data), sha256=sha(data))
            selections.append(dict(table=path, defines=dict(selected), definesHash=f'{key:016x}',
                                   programId=program_id, bundle=bundle, index=index,
                                   bundleProgramOffset=start, metallib=record(metal),
                                   bitcode=dict(record(bc), offset=i + offset),
                                   disassembly=record(ll), compilerStderr=proc.stderr))
    result = dict(scope='Six static UNLIT_DECAL Metal/AIR permutations and exact primary reconstruction readers; no native client/Metal execution.',
                  limits=['Selection does not establish R CPU dispatch, receiving terrain triangles, decal matrices, sampler or render-state bindings.',
                          'External flat-ground footprint and epsilon fading guard differ from observed native VS arithmetic; no reconstruction shortcut is treated as native.',
                          'Clang retargets textual IR to the host with LLVM passes disabled; original Metal/AIR bytes are preserved.'],
                  tocReader=str(READER), tocReaderSha256=sha(READER.read_bytes()),
                  sourcePin=str(SOURCE_PIN), sourcePinSha256=sha(SOURCE_PIN.read_bytes()),
                  tables=tables, selections=selections, extraction=extraction,
                  compiler=subprocess.check_output(['clang', '--version'], text=True),
                  disassemblyCommand=['clang', '-S', '-emit-llvm', '-Xclang', '-disable-llvm-passes', 'INPUT.bc', '-o', 'OUTPUT.ll'],
                  nativeExecuted=False, nativeRenderingVerified=False)
    result['externalReaders'] = external
    result['observations'] = OBSERVATIONS
    result['externalBytePreservation'] = 'Exact fetched UTF-8 response bytes; earlier newline-normalized discovery cache is separate.'
    PIN.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(dict(result='passed', programs=len(selections), sourceFiles=len(archive.outputs), nativeExecuted=False)))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    retained_check() if args.check else extract()
