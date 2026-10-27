"""Bind the legacy p-type1 plane factory and virtual color packet builder; static only."""
from pathlib import Path
import bisect, json, runpy, struct
import native_gromp_emitter_routes as routes
from masteryi_audio_graph import write_outputs
witness = routes.witness
require = witness.require
OUTPUT = Path('docs/reference/native-plane-color-packets.json')
PINS = {'docs/reference/native-gromp-emitter-routes.json': '8e268d02303addefa4c70b311215329d4ef1782eac4ae12378a54039dd6eff3c',
        'docs/reference/native-cameraquad-packets.json': 'a9e4fe941a973f6a0a24c2f05ada8992fb915cf63a25980251185e3bc50eb920',
        'docs/reference/native-particle-vertex-format.json': '2c45b6fb42a5eea59daa453e96af9f5d49a2afa38a1a84dafaf3be2b8919e1f6'}
SPANS = [('planeVertexBuilder', 0x1018d5924, 0x1018d5fa8, '8299261c48117fd2293f84b97adbebfe39c235f26a63cc81a56982d16596becf')]
WORDS = [(4320770860, 1384120832, 'mov w0, #0x10'),
 (4320770864, 2549603944, 'bl #0x1016934d0'),
 (4320770868, 1384120360, 'mov w8, #1'),
 (4320770872, 956309512, 'strb w8, [x0, #8]'),
 (4320770876, 3489685288, 'adrp x8, #0x102481000'),
 (4320770880, 2435858696, 'add x8, x8, #0xc10'),
 (4320770884, 4177526792, 'str x8, [x0]'),
 (4320770888, 4177527392, 'str x0, [x19]'),
 (4320770892, 2839641085, 'ldp x29, x30, [sp, #0x10]'),
 (4320770896, 2831306740, 'ldp x20, x19, [sp], #0x20'),
 (4320770900, 3596551104, 'ret '),
 (4321007956, 2852193267, 'mov x19, x1'),
 (4321007960, 2839630888, 'ldp x8, x21, [x1, #0x10]'),
 (4321007964, 4181722806, 'ldr x22, [x21, #8]'),
 (4321007968, 4181742249, 'ldr x9, [x21, #0xa0]'),
 (4321007972, 2034245940, 'ldrh w20, [x9, #0x10]'),
 (4321007976, 4181723849, 'ldr x9, [x22, #0x10]'),
 (4321007980, 1833838889, 'ldp d9, d10, [x9, #0xe0]'),
 (4321007984, 4181725239, 'ldr x23, [x1, #0x20]'),
 (4321007988, 2034237721, 'ldrh w25, [x8]'),
 (4321007992, 3108163880, 'ldr w8, [x9, #0x2d0]'),
 (4321007996, 3103805416, 'str w8, [sp, #0x4c]'),
 (4321008088, 960516360, 'ldrb w8, [x8, #0x14]'),
 (4321008092, 2432698012, 'add x28, x20, #1'),
 (4321008096, 1384121097, 'mov w9, #0x18'),
 (4321008100, 2611576457, 'umull x9, w20, w9'),
 (4321008104, 3506463030, 'sub x22, x9, #0x18'),
 (4321008108, 1384125833, 'mov w9, #0xac'),
 (4321008112, 2611576457, 'umull x9, w20, w9'),
 (4321008116, 3506532664, 'sub x24, x9, #0x5c'),
 (4321008120, 1384121737, 'mov w9, #0x2c'),
 (4321008124, 2611576474, 'umull x26, w20, w9'),
 (4321008128, 840892680, 'orr w8, w8, #2'),
 (4321008132, 3103801320, 'str w8, [sp, #0x3c]'),
 (4321008160, 3506598816, 'sub x0, x29, #0x9c'),
 (4321008164, 3506619297, 'sub x1, x29, #0xb0'),
 (4321008168, 1031804896, 'str q0, [sp, #0x50]'),
 (4321008172, 1031800802, 'str q2, [sp, #0x10]'),
 (4321008176, 2549524528, 'bl #0x10167faf0'),
 (4321008180, 3092661160, 'ldur w8, [x29, #-0x9c]'),
 (4321008184, 3103788680, 'str w8, [x20, #0xc]'),
 (4321008188, 3103795848, 'str w8, [x20, #0x28]'),
 (4321008192, 3103803016, 'str w8, [x20, #0x44]'),
 (4321008196, 3103810184, 'str w8, [x20, #0x60]'),
 (4321008844, 4181740809, 'ldr x9, [x8, #0x98]'),
 (4321008848, 2333737260, 'add x12, x9, x26'),
 (4321008852, 3160228228, 'ldur s4, [x12, #-0x2c]'),
 (4321008856, 2333737260, 'add x12, x9, x26'),
 (4321008860, 3160392067, 'ldur s3, [x12, #-4]'),
 (4321008864, 1836943744, 'ldp d0, d2, [x12, #-0x28]'),
 (4321008868, 773905697, 'fmul v1.2s, v9.2s, v0.2s'),
 (4321008872, 774036800, 'fmul v0.2s, v10.2s, v2.2s'),
 (4321008876, 1832190881, 'stp d1, d0, [x29, #-0xb0]'),
 (4321008880, 3107995628, 'ldr w12, [sp, #0x3c]'),
 (4321008884, 1895827871, 'cmp w12, #2'),
 (4321008888, 1409286369, 'b.ne #0x1018d5d14'),
 (4321008892, 262180897, 'fmul v1.2s, v1.2s, v0.s[1]'),
 (4321008896, 4229235617, 'stur d1, [x29, #-0xb0]'),
 (4321008900, 262180864, 'fmul v0.2s, v0.2s, v0.s[1]'),
 (4321008904, 3155526560, 'stur s0, [x29, #-0xa8]'),
 (4321008908, 1386737676, 'mov w12, #0x3f800000'),
 (4321008912, 3088434092, 'stur w12, [x29, #-0xa4]')]


def verify(image, core):
    for name, digest in PINS.items():
        witness.pinned(Path(name), digest)
    routes.verify(image, core)
    starts = routes.queues.function_starts(image.data, core['functionStarts'])
    spans = []
    for name, start, end, digest in SPANS:
        slot = bisect.bisect_left(starts, start)
        require(starts[slot:slot + 2] == [start, end], 'Plane function bounds differ: ' + name)
        raw = image.at(start, end - start)
        require(witness.sha(raw) == digest, 'Plane function bytes differ: ' + name)
        spans.append({'name': name, 'start': hex(start), 'next': hex(end),
                      'bytes': len(raw), 'sha256': digest, 'hex': raw.hex()})
    selected = []
    for pc, word, reading in WORDS:
        require(image.word(pc) == word, 'Plane selected instruction differs: ' + reading)
        selected.append({'address': hex(pc), 'word': f'{word:08x}', 'reading': reading})
    table = image.at(0x10213342b, 13)
    require(table.hex() == routes.legacy.TABLE_HEX, 'Plane primitive switch differs')
    require(0x10189bb14 + table[1] * 4 == 0x10189bb2c, 'Plane p-type1 branch differs')
    image.movz(0x10189bb2c, 0, 16)
    image.movz(0x10189bb34, 8, 1)
    require(image.branch(0x10189bb30) == 0x1016934d0, 'Plane allocation call differs')
    require(image.page_pointer(0x10189bb3c, 0x10189bb40, 8) == 0x102481c10,
            'Plane constructor vptr differs')
    slot = 0x102481c10 + 40
    target = struct.unpack('<Q', image.at(slot, 8))[0]
    require(target == 0x1018d5924, 'Plane virtual builder differs')
    require(image.branch(0x1018d5a30) == 0x10167faf0, 'Plane truncating helper differs')
    require(routes.queues.quad.conditional_branch(image, 0x1018d5cf8) == (1, 0x1018d5d14),
            'Plane premultiply bypass differs')
    return {'functionSpans': spans, 'selectedInstructions': selected,
            'primitive': {'legacyPType': 1, 'factoryBranch': '0x10189bb2c',
                          'allocationBytes': 16, 'kind': 1, 'kindOffset': 8,
                          'vptr': '0x102481c10', 'virtualSlotOffset': 40,
                          'virtualSlotAddress': hex(slot), 'virtualMethod': hex(target),
                          'slotBytes': image.at(slot, 8).hex(),
                          'colorHelper': '0x10167faf0'}}


def source_rows(pin, compiled, raw):
    source = routes.source_rows(pin, compiled, raw)
    candidates = [r for r in source['profiles'] if r['pType'] == 1]
    require(len(candidates) == 1, 'Gromp plane candidate count differs')
    row = candidates[0]
    require((row['profileIndex'], row['group'], row['kind'], row['queue'],
             row['typeField']['effective']) == (4, 4, 'quad', 'legacy-record', 'Complex'),
            'Gromp plane source route differs')
    profile = compiled['profiles'][4]
    require(profile['blend'] == 1, 'Gromp plane blend differs')
    return {'profileIndex': 4, 'name': profile['name'], 'group': 4,
            'legacyPType': 1, 'queue': row['queue'], 'effectiveGroupType': 'Complex',
            'blendMode': 1, 'premultiplyBranchTaken': False,
            'colorPolicyCandidate': 'raw-key float32 plus truncating BGRA',
            'applicationPolicyChanged': False}


def observe():
    defaults = routes.queues.quad.ray.defaults
    core = json.loads(witness.pinned(defaults.CORE, defaults.CORE_SHA256))
    native = witness.restored.checked(Path(core['native']['path']).read_bytes(), core['native'])
    witness.pinned(witness.PARSER, witness.PARSER_SHA256)
    data, sections = runpy.run_path(str(witness.PARSER))['arm64_sections'](native, core['native']['architecture'])
    pin = json.loads(witness.pinned(routes.legacy.GROMP, routes.legacy.GROMP_SHA256))
    compiled = json.loads(Path('src/content/gromp-death.json').read_bytes())
    layout = json.loads(witness.pinned(routes.queues.quad.FORMAT_PIN, routes.queues.quad.FORMAT_SHA256))
    return {'format': 1, 'native': core['native'],
            'inputs': [{'path': name, 'sha256': digest} for name, digest in PINS.items()],
            **verify(witness.Image(data, sections), core),
            'firstLayoutFormats': [r['metalFormat'] for r in layout['firstParticleLayout']],
            'source': source_rows(pin, compiled, routes.colors.SOURCE_PATH.read_bytes()),
            'reading': {
                'factory': 'The checked13-entry legacy switch maps p-type1 to10189bb2c. It allocates16B, stores kind1 at+8 and vptr102481c10 at+0, then returns directly through the result pointer. This branch does not use the Ray common+10 initializer.',
                'dispatch': 'Vtable slot+40 at102481c38 selects the complete function1018d5924..1018d5fa8. The inherited queue witness traces Complex definitions to the legacy consumer and its primitive virtual dispatch.',
                'inputs': 'The builder loads definition modulation RGBA at+E0 through X22+10, and draw RGBA at+4 of a44-byte record. FMUL at1018d5ce4/ce8 forms four float32 products into X29-B0 scratch.',
                'premultiply': 'The blend byte at definition+14 is ORed with2. If that equals2, RGB is multiplied by A and A becomes1. The checked Gromp shadow mode1 skips this branch.',
                'packing': 'The call1018d5a30 passes the RGBA scratch to inherited helper10167faf0, which multiplies float32 components by255, converts with unsigned truncation and keeps low bytes. The resulting BGRA word is stored at+12 in four28-byte vertices.',
                'scope': 'The original source group4/profile4 is the single legacy p-type1 Gromp plane candidate. Its runtime color remains unchanged in this source-only witness.'},
            'nativeExecuted': False, 'nativeShaderExecuted': False, 'applicationBehaviorChanged': False,
            'limits': [
                'Bounded static linkage and conditional color arithmetic; actual native loader, draw admission, backing mode/cache mutation, phase, clocks/RNG, external modifiers and FPCR remain unobserved.',
                'The first28-byte declaration is inherited evidence, not proof of the live plane material/layout/shader binding or complete native appearance.',
                'UV half-conversion sites are present in the complete bytes, but UV phase/frame/lookup sources and geometry are outside this color witness.',
                'No runtime plane color, geometry, UV, blend or texture behavior changes. Independent arithmetic and GPU projections are required before a local color correction.',
                'Fresh static bytes do not reconstruct missing historical evidence closures.']}


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--output', type=Path, default=OUTPUT)
    args = parser.parse_args()
    result = observe()
    write_outputs([(args.output, (json.dumps(result, indent=2, allow_nan=False) + '\n').encode())], args.check)
    print(json.dumps({'functions': len(result['functionSpans']), 'instructions': len(result['selectedInstructions']),
                      'primitive': result['primitive'], 'source': result['source'], 'nativeExecuted': False}))
