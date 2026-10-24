"""Retain narrow Leona E trail shader/reconstruction evidence; no shaders execute.

Extraction uses existing pinned Metal samples and fetches five revision-bound readers.
--check verifies all retained bytes offline, without network or compiler imports/calls.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct

ROOT = Path('.cache/leona-e-trail-reading-v1-20261024')
PIN = Path('docs/reference/leona-e-trail-shader-reading.json')
SOURCE = Path('docs/reference/particle-shaders.json')
REVISION = '2adda384347dd43e76d6295d77fe1f13623b2808'
BASE = f'https://raw.githubusercontent.com/LeagueToolkit/ltk-manager/{REVISION}/src/modules/workshop/bin/vfx/rendering/'
READERS = {
    'utils/particleDraws.ts': '7244b79adf4d0ae598355458a0497bead40af4e4f7cee61774fd159f98ea57a5',
    'shaders/ribbonPrelude.ts': '56a62035458775b3fc7878bc93bb3276096755597565137bfff8be0a46aced14',
    'utils/palette.ts': 'd13b347b607a85cc079b909dc8bb25e9ce67cd4e5c8120097f99b713b852f3f9',
    'utils/colorLookup.ts': '13658d02415c8ee3d30ecdb5247dc6ee2f9905f05912ee04070c52970eb5bcf8',
    'utils/blend.ts': '2a9faf081ee3c27fdbbf0764ec42673eceb77b3b928992b9acaf407b572b52b8',
}
NATIVE = ['quad_vs.vs-metal-0', 'quad_ps.ps-metal-0', 'quad_ps.ps-metal-12']


def sha(data):
    return hashlib.sha256(data).hexdigest()


def record(path):
    data = path.read_bytes()
    return dict(path=str(path), bytes=len(data), sha256=sha(data))


def check():
    pin = json.loads(PIN.read_text())
    records = [pin['sourcePin'], pin['kernelPin']] + pin['externalReaders'] + pin['existingReaders']
    for sample in pin['nativeSamples']:
        records.extend(sample[k] for k in ['metallib', 'bitcode', 'disassembly'])
        raw = Path(sample['metallib']['path']).read_bytes()
        item = sample['bitcode']
        assert raw[item['offset']:item['offset'] + item['bytes']] == Path(item['path']).read_bytes()
    for item in records:
        data = Path(item['path']).read_bytes()
        assert len(data) == item['bytes'] and sha(data) == item['sha256'], item['path']
    print(json.dumps(dict(result='passed', nativeSamples=len(pin['nativeSamples']),
                          externalReaders=len(pin['externalReaders']), networkUsed=False,
                          compilerUsed=False, nativeExecuted=False)))


def extract():
    import subprocess
    import urllib.request
    ROOT.mkdir()  # Never overwrite a retained extraction.
    source = json.loads(SOURCE.read_text())
    external = []
    for path, expected in READERS.items():
        data = urllib.request.urlopen(BASE + path, timeout=30).read()
        assert sha(data) == expected, path
        local = ROOT / 'readers' / path
        local.parent.mkdir(parents=True, exist_ok=True)
        local.write_bytes(data)
        external.append(dict(record(local), url=BASE + path, revision=REVISION))
    samples = []
    for name in NATIVE:
        original = Path('.cache/particle-shaders') / (name + '.metallib')
        selected = next(s for s in source['selections'] if s['output'] == str(original))
        raw = original.read_bytes()
        assert sha(raw) == selected['sha256']
        marker = bytes.fromhex('dec0170b')
        i = raw.index(marker)
        assert raw.find(marker, i + 1) == -1
        _, version, offset, size, cpu = struct.unpack_from('<5I', raw, i)
        assert version == 0 and offset == 20 and cpu == 4294967295
        bitcode = raw[i + offset:i + offset + size]
        assert len(bitcode) == size and bitcode[:4] == b'BC\xc0\xde'
        stem = ROOT / name
        metal, bc, ll = (Path(str(stem) + ext) for ext in ['.metallib', '.bc', '.ll'])
        metal.write_bytes(raw)
        bc.write_bytes(bitcode)
        proc = subprocess.run(['clang', '-S', '-emit-llvm', '-Xclang', '-disable-llvm-passes',
                               str(bc), '-o', str(ll)], capture_output=True, text=True, check=True)
        assert '@wrapped_main' in ll.read_text()
        samples.append(dict(table=selected['toc'], defines=selected['defines'], programId=selected['shaderId'],
                            bundle=selected['bundle'], index=selected['index'], source=str(original),
                            metallib=record(metal), bitcode=dict(record(bc), offset=i + offset),
                            disassembly=record(ll), compilerStderr=proc.stderr))
    kernel = Path('docs/reference/leona-e-kernel-readers.json')
    kernel_pin = json.loads(kernel.read_text())
    existing = []
    for name in ['Trails.tsx', 'ribbon.ts']:
        expected = next(s for s in kernel_pin['files'] if s['path'].endswith('/' + name))
        item = record(Path(expected['path']))
        assert item['sha256'] == expected['sha256'] and item['bytes'] == expected['bytes']
        existing.append(dict(item, url=expected['url'], revision=REVISION))
    result = dict(
        scope='Static 16.18.8175716 native quad shader arithmetic plus revision-bound external ribbon reconstruction; no target or shader executed.',
        limits=[
            'Native E trail CPU dispatch, actual texture/uniform/sampler bindings, blend state and rendering parity remain unverified.',
            'External RIBBON_DRAW selects quad; this does not establish a native callsite or prove absence of a distinct trail shader.',
            'Clang retargets textual AIR to the host with LLVM passes disabled; original Metal and AIR bytes are preserved.',
            'Missing lookup/remap textures require separately justified bindings; no native neutral-resource defaults are inferred.'
        ], sourcePin=record(SOURCE), kernelPin=record(kernel),
        nativeProvenance=source['extraction'], nativeSamples=samples,
        externalRevision=REVISION, externalReaders=external, existingReaders=existing,
        findings=[
            dict(id='E-TRAIL-ROUTING', evidence='readers/utils/particleDraws.ts:54-67; existing Trails.tsx:88-89,119',
                 type='external-reconstruction', observation='RIBBON_DRAW.path is quad, using ribbonPrelude; Trails selects it. No rim/reflection.'),
            dict(id='E-TRAIL-VERTEX', evidence='quad_vs.vs-metal-0.ll:11-72,111-118', type='native-static',
                 observation='ATTR0 float3 world position loc0; ATTR3 float4 BGRA color loc3; ATTR8 float4 UV/frame loc8; ATTR9 float2 lookup loc9. VS swizzles color to RGBA, atlas-transforms base UV, passes per-vertex lookup. Buffer1 PerFrameVertexCB; buffer9 LocalsVertex TEXTURE_INFO@0/depthPushPull@16.'),
            dict(id='E-TRAIL-PRELUDE', evidence='readers/shaders/ribbonPrelude.ts:26-34', type='external-reconstruction',
                 observation='Position is already expanded. Engine color=tint.bgra; base UV/frame0/erosion and per-vertex lookup feed quad shader. Avoid a second application RGBA channel swap.'),
            dict(id='E-TRAIL-COLOR', evidence='quad_ps.ps-metal-0.ll:8-22,54-61', type='native-static',
                 arithmetic='T=sample(base,UV.xy)*tint*sample(particleLookup,UV.zw); remap=sample(globalRamp,[dot(T.rgb,[.2126,.7152,.0722]),.5]); RGB=remap.a>0?remap.rgb:T.rgb; alpha=T.a.',
                 resources='Textures0/1/2=globalRemap/base/particleLookup; samplers0/1/15=base/lookup/Clamp_No_Mip_SharedSampler.'),
            dict(id='E-TRAIL-PALETTE', evidence='quad_ps.ps-metal-12.ll:10-36,77-86', type='native-static',
                 arithmetic='B=sample(base,UV.xy); paletteUV=[clamp(dot(B,cPaletteSrcMixerMain),0,1),cPaletteSelectMain.x]+cPaletteSelectMain.zw; P=sample(palette,paletteUV); Q=[P.rgb,B.a]; T=sample(lookup,UV.zw)*tint*Q; then global remap as nonpalette. Palette alpha is discarded; mixer sees untinted base.',
                 resources='Buffer16 LocalsFragment32 bytes: cPaletteSelectMain float4@0, cPaletteSrcMixerMain float4@16. Textures0/1/2/3=globalRemap/palette/base/lookup; samplers0/1/2/15=palette/base/lookup/sharedClamp.'),
            dict(id='E-TRAIL-PALETTE-ROW', evidence='readers/utils/palette.ts:25-33', type='external-reconstruction',
                 arithmetic='row=(sample(selector,0).x+.5)/count; E selector9,count16 gives .59375, without flooring. Scroll adds separately. E mixer [.299,.587,.114,0] gives U=clamp(.299*B.r+.587*B.g+.114*B.b,0,1). Native shader observes supplied row only.'),
            dict(id='E-TRAIL-LOOKUP', evidence='readers/utils/colorLookup.ts:59-75', type='external-reconstruction',
                 observation='Lifetime axis=scale*age01+offset; constant axis=scale. E lookup types[1,0],scales[1,1],offsets[0,0] produce [age01,1], separate from palette row.'),
            dict(id='E-TRAIL-UV', evidence='existing ribbon.ts:219-229,297-308', type='external-reconstruction',
                 observation='Mode1 U is walked smoothed distance/tilingU; tilingV0 spans V0..1. Per-point UV transform, tint and lookup are copied to both edge vertices. E tilingU805/1100 respectively.'),
            dict(id='E-TRAIL-BLEND', evidence='readers/utils/blend.ts:61', type='external-reconstruction',
                 observation='E blend4 alphaAdd uses SrcAlpha,One,Add; native shader bytes cannot establish blend setup.'),
        ], profiles=[
            dict(profile=11, sourceIndex=7, name='Kayn_Primay_Broken', system='Leona_E_mis_weapon', palette=True, blend=4),
            dict(profile=14, sourceIndex=13, name='Trail1', system='Leona_E_mis_weapon', palette=False, blend=4),
        ], compiler=subprocess.check_output(['clang', '--version'], text=True),
        nativeExecuted=False, nativeRenderingVerified=False)
    PIN.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(dict(result='passed', nativeSamples=len(samples), externalReaders=len(external), nativeExecuted=False)))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    check() if args.check else extract()
