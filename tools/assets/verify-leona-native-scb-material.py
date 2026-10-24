#!/usr/bin/env python3
"""Verify conditional SCB color selection and alpha-test AIR; offline/static."""
import argparse
import hashlib
import importlib.util
import json
import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def require(ok, message):
    if not ok:
        raise ValueError(message)


def sha(raw): return hashlib.sha256(raw).hexdigest()
def num(value): return int(value, 16) if isinstance(value, str) else value


def checked(row):
    raw = (ROOT / row['path']).read_bytes()
    require((len(raw), sha(raw)) == (row['bytes'], row['sha256']), 'Retained bytes differ: ' + row['path'])
    return raw


def module(row, name):
    checked(row); spec = importlib.util.spec_from_file_location(name, ROOT / row['path'])
    result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result); return result


def verify(path):
    pin = json.loads(path.read_text()); checked(pin['verifier'])
    require(not any(pin[k] for k in ['nativeExecuted', 'nativeShaderExecuted', 'nativeRenderingVerified']),
            'Unexpected native execution/frame claim')
    prior = module(pin['inputVerifier'], 'scb_material_prior'); checked(pin['inputPin'])
    inputs = prior.verify(ROOT / pin['inputPin']['path'])
    parser = module(inputs['sectionParser'], 'scb_material_sections')
    raw, sections = parser.arm64_sections(checked(inputs['target']), inputs['target']['architecture'])

    def at(address, count):
        address = num(address)
        rows = [s for s in sections if s['address'] <= address and address + count <= s['address'] + s['bytes']]
        require(len(rows) == 1 and rows[0]['flags'] & 255 not in [1, 12, 18], 'Unmapped native span')
        s = rows[0]; offset = s['offset'] + address - s['address']
        require(offset + count <= len(raw), 'Native span exceeds slice'); return raw[offset:offset + count]

    def word(pc): return struct.unpack('<I', at(pc, 4))[0]
    for row in pin['streams']:
        start, end = num(row['requestedStart']), num(row['requestedEnd'])
        words = [(int(a, 16), int(w, 16)) for a, w in re.findall(
            r'^([0-9a-f]{9}): ([0-9a-f]{8})\s', checked(row).decode(), re.M)]
        require([a for a, _ in words] == list(range(start, end, 4)) and len(words) == row['instructions'],
                'Bounded native stream differs')
        for pc, w in words: require(word(pc) == w, 'Native instruction word differs')
    for row in pin['retainedInputs']: checked(row)
    for row in pin['nativeSpans']:
        b = at(row['address'], row['bytes'])
        require((b.hex(), sha(b)) == (row['hex'], row['sha256']), 'Native span differs')
    for address, expected in [(0x10189036c, 0xb50002a8), (0x1018903c4, 0x3941f517),
                              (0x101890604, 0x340000f7), (0x101991884, 0x7900f81f),
                              (0x101993490, 0x340006e8), (0x101993568, 0x3901f668),
                              (0x10188f7c0, 0x3941dd09), (0x1018c26cc, 0x39404708),
                              (0x1018c26f8, 0x1e211800)]:
        require(word(address) == expected, 'Selected source-color/alpha gate differs')
    require(0x10189036c + ((word(0x10189036c) >> 5) & 0x7ffff) * 4 == 0x1018903c0,
            'SCB selector branch target differs')
    require(struct.unpack('<Q', at(0x102486248, 8))[0] == 0x101914a3c
            and struct.unpack('<Q', at(0x1024862a0, 8))[0] == 0x101914a44, 'Mesh virtual methods differ')
    require(at(0x1022778a9, 11) == b'ALPHA_TEST\0' and at(0x102277cb7, 18) == b'USE_VERTEX_COLORS\0',
            'Native feature literals differ')
    require(at(0x1021333f0, 9)[0] == 0x33 and 0x10188f7a4 + 4 * 0x33 == 0x10188f870
            and at(0x102133542, 9)[0] == 0, 'Ordinary blend-zero dispatch differs')
    normal = json.loads(checked(pin['normalPin']))
    row = next(r for r in normal['streams'] if r['source']['path'].endswith('/13b9c8c611b0d630.scb'))
    source = checked(row['source']); meta = pin['sourceColor']; vertices, faces, flags = struct.unpack_from('<III', source, 140)
    has_bgra = struct.unpack_from('<I', source, 176)[0]; face_offset = 180 + vertices * 12 + has_bgra * vertices * 4 + 12
    colors = source[face_offset + faces * 100:]
    require((vertices, faces, flags, has_bgra) == (333, 648, 1, 0), 'Sword source header differs')
    require((meta['vertices'], meta['faces'], meta['corners'], meta['flags'], meta['authoredVertexBGRA']) ==
            (333, 648, 1944, 1, False), 'Source color declaration differs')
    require(len(colors) == meta['faceRgbBytes'] == 5832 and sha(colors) == meta['faceRgbSha256']
            and not any(colors) and meta['nonzeroFaceRgbBytes'] == 0, 'Face RGB bytes differ')
    packed = b''.join(struct.pack('<I', 0xff000000 | (r << 16) | (g << 8) | b)
                      for r, g, b in zip(colors[::3], colors[1::3], colors[2::3]))
    require(len(packed) == meta['conditionalPackedCornerBytes'] == 7776 and sha(packed) ==
            meta['conditionalPackedCornerSha256'] and meta['conditionalNativeCornerWord'] == '0xff000000',
            'Conditional packed face color differs')
    model = json.loads(checked(pin['sourceModelPin']))
    derived = json.loads(checked(row['derived']))
    require(not model['sourceVertexColors'] and model['sourceFaceColors'] and model['source'] == derived['source'],
            'Authored model stream declaration differs')
    declarations = json.loads(checked(inputs['sourcePin']))['resources']['Leona_E_mis_weapon']['definition']
    sword = declarations['complexEmitterDefinitionData'][18]
    require(sword['emitterName'] == 'sword2' and sword['primitive'] == pin['sourcePrimitive']
            and 'alphaRef' not in sword, 'Sword primitive/alpha omission differs')
    tint = json.loads(checked(pin['tintAudit']))
    require(pin['tintSource'] == tint['source'] and not pin['tintSource']['authoredBlendMode']
            and pin['tintSource']['conditionalDefaultBlendMode'] == 0 and 'blendMode' not in sword,
            'Sword blend omission/default differs')
    require(at(0x10227778c, 13) == b'kColorFactor\0', 'CPU tint uniform literal differs')
    for address, expected in [(0x1018ac864, 0x0f0004e0), (0x1018ac868, 0xbc013000),
                              (0x10192f440, 0x3900281f), (0x1018c0f34, 0x52a7f008),
                              (0x1018c0f38, 0xb9001fe8), (0x1018df6c8, 0x52a7f008),
                              (0x1018df6cc, 0xb811c3a8)]:
        require(word(address) == expected, 'Blend default/opaque tint instruction differs')
    vertex = checked(next(r for r in inputs['shaderPrograms'] if r['programId'] == 1)['disassembly']).decode()
    require('i32 112, i32 16, i32 0, !"float4", !"kColorFactor"' in vertex,
            'Rim vertex tint member identity differs')
    mesh = json.loads(checked(pin['meshLink'])); corner = json.loads(checked(pin['cornerColor']))
    require(pin['sourcePrimitive'] == mesh['sourcePrimitive'] and meta == corner['source'], 'Independent reading differs')
    checked(pin['independentFindings'])

    extraction = json.loads(checked(pin['extraction']))
    old = json.loads(checked(inputs['reflectionShaderPin'])); records = {r['path']: r for r in extraction['inputs']}
    for path, r in records.items():
        virtual = path.split('/native/', 1)[1]
        require(any(f['path'] == virtual and f['bytes'] == r['bytes'] and f['sha256'] == r['sha256']
                    for f in old['extraction']['files']), 'Shader input not in retained official archive')
        checked(r)
    keys = {31: '0572d84bd37124c8', 4: '1b6d3caa38719145', 772: '5c7fef8e6508748d', 24: 'f9fbbee4b3db74fe'}
    for row in pin['shaderPrograms']:
        toc = checked(next(r for p, r in records.items() if p.endswith('/' + row['table']))); cursor = 0
        def read(fmt):
            nonlocal cursor
            values = struct.unpack_from('<' + fmt, toc, cursor); cursor += struct.calcsize('<' + fmt)
            return values[0] if len(values) == 1 else values
        def string():
            nonlocal cursor
            size = read('I'); value = toc[cursor:cursor + size].decode(); cursor += size; return value
        require(string() == 'TOC3.0', 'Shader TOC differs')
        count, define_count, _, stage = read('4I'); require(string() == 'baseDefines', 'TOC defines differ')
        defines = [(string(), string()) for _ in range(define_count)]; require(string() == 'shaders', 'TOC map differs')
        hashes, ids = [read('Q') for _ in range(count)], [read('I') for _ in range(count)]
        key = keys[row['programId']]
        require(row['definesHash'] == key and dict(zip(hashes, ids))[int(key, 16)] == row['programId']
                and cursor == len(toc) and row['stage'] == stage and 'REFLECTIVE' not in row['flags'], 'Shader selection differs')
        require(all(flag in dict(defines) for flag in row['flags']), 'Shader flag missing')
        metal = checked(row['metallib']); bundle = checked(records[row['bundle']]); off = row['programOffset']
        require(struct.unpack_from('<I', bundle, off - 4)[0] == len(metal) and bundle[off:off + len(metal)] == metal,
                'Bundle program differs')
        bc = checked(row['bitcode']); off = row['bitcode']['offset']
        require(bc[:4] == b'BC\xc0\xde' and metal[off:off + len(bc)] == bc, 'Original AIR differs')
        text = checked(row['disassembly']).decode()
        if row['programId'] == 24:
            require('%29 = fsub fast float %26, %28' in text and '%30 = fcmp olt float %29, 0.000000e+00' in text,
                    'Strict original-alpha gate differs')
            require(text.index('@air.discard_fragment()') < text.index('%35 = select') < text.index('%39 = fadd')
                    < text.index('%40 = tail call'), 'Alpha/remap/rim/clamp ordering differs')
        if row['programId'] == 4:
            require('<i32 2, i32 1, i32 0, i32 3>' in text and '%68 = fmul fast <4 x float> %66, %67' in text,
                    'Conditional BGRA vertex swizzle differs')
    require([r['programId'] for r in pin['shaderPrograms']] == [31, 4, 772, 24], 'Expected four comparison programs')
    return pin


def main():
    cli = argparse.ArgumentParser(description=__doc__); cli.add_argument('--check', action='store_true', required=True)
    cli.add_argument('--pin', type=Path, default=ROOT / 'docs/reference/leona-native-scb-material.json')
    pin = verify(cli.parse_args().pin)
    print(f'PASS: {len(pin["streams"])} bounded native word streams, conditional SCB color flag/cache link, '
          'source face packing, ordinary alpha gate and four Metal/AIR programs. Offline/static.')


if __name__ == '__main__': main()
