"""Distinguish legacy mesh color transfer from quad byte packing; static only."""
from pathlib import Path
import bisect, json, runpy, struct
import native_gromp_emitter_routes as routes
from masteryi_audio_graph import write_outputs
witness = routes.witness
require = witness.require
OUTPUT = Path('docs/reference/native-mesh-color-route.json')
PINS = {'docs/reference/native-gromp-emitter-routes.json': '8e268d02303addefa4c70b311215329d4ef1782eac4ae12378a54039dd6eff3c',
        'docs/reference/native-legacy-primitive-types.json': '2e56236915d08ec883f89de2848a0571dc2085081b837d75e5a412ef8cdfda61'}
SPANS = [('legacyQuadConsumer',
  4321045692,
  4321046320,
  '1f9413be802ab97b14fbc46ea8009d8fa0f8d3d83614e180613bf1ca77ee3a0e'),
 ('meshQuadSlotStub',
  4321265300,
  4321265304,
  '110f46b5b35c069160560c6ad6786f647dd44e8760a52a46fc22dbbcd7630b91'),
 ('separateDrawSelector',
  4321055296,
  4321057752,
  'de864c756d2409e5770ac08bfb3f6509426417c0843e365c95eb6d042ffb7eac'),
 ('meshDrawCandidate',
  4321046924,
  4321051416,
  '1b2769297b6957a89c16f4af661f87cf9dbad98d3460b13fc3a8f197bcc41189'),
 ('float4ParameterSetter',
  4321523396,
  4321523672,
  'b2ea84f33c309ad62868574781d43b84f5f19b77e10569afc8984d7d22a8fd98')]
WORDS = [(4320770932, 1384124928, 'mov w0, #0x90'),
 (4320770936, 2549603926, 'bl #0x1016934d0'),
 (4320770940, 1384120424, 'mov w8, #3'),
 (4320770944, 956309512, 'strb w8, [x0, #8]'),
 (4320770948, 4026556040, 'adrp x8, #0x10246e000'),
 (4320770952, 3573751839, 'nop '),
 (4320770956, 4181745928, 'ldr x8, [x8, #0xc0]'),
 (4320770960, 4177528840, 'str x8, [x0, #0x10]'),
 (4320770964, 1862329344, 'movi v0.2d, #0000000000000000'),
 (4320770968, 4244638720, 'str d0, [x0, #0x18]'),
 (4320770972, 4177530888, 'str x8, [x0, #0x20]'),
 (4320770976, 4244640768, 'str d0, [x0, #0x28]'),
 (4320770980, 4177532936, 'str x8, [x0, #0x30]'),
 (4320770984, 1015250944, 'stur q0, [x0, #0x38]'),
 (4320770988, 1015316480, 'stur q0, [x0, #0x48]'),
 (4320770992, 1015353344, 'stur q0, [x0, #0x51]'),
 (4320770996, 2835807240, 'stp x8, xzr, [x0, #0x68]'),
 (4320771000, 2835872799, 'stp xzr, xzr, [x0, #0x78]'),
 (4320771004, 3087560735, 'stur wzr, [x0, #0x87]'),
 (4320771008, 4026556232, 'adrp x8, #0x102486000'),
 (4320771012, 2433188104, 'add x8, x8, #0x1e0'),
 (4320771016, 4177526792, 'str x8, [x0]'),
 (4320771020, 4177527392, 'str x0, [x19]'),
 (4320771024, 2839641085, 'ldp x29, x30, [sp, #0x10]'),
 (4320771028, 2831306740, 'ldp x20, x19, [sp], #0x20'),
 (4320771032, 3596551104, 'ret '),
 (4321265300, 3596551104, 'ret '),
 (4321045728, 4181722389, 'ldr x21, [x8, #8]'),
 (4321045732, 4181723817, 'ldr x9, [x21, #0x10]'),
 (4321045736, 4181733664, 'ldr x0, [x9, #0x60]'),
 (4321045740, 960503818, 'ldrb w10, [x0, #8]'),
 (4321045744, 1895843167, 'cmp w10, #0x11'),
 (4321045748, 1384120363, 'mov w11, #1'),
 (4321045752, 449454442, 'lsl w10, w11, w10'),
 (4321045756, 1384190219, 'mov w11, #0x888'),
 (4321045760, 1923088491, 'movk w11, #3, lsl #16'),
 (4321045764, 168493386, 'and w10, w10, w11'),
 (4321045768, 2051053892, 'ccmp w10, #0, #4, ls'),
 (4321045772, 1409286400, 'b.eq #0x1018ded2c'),
 (4321045776, 2840034301, 'ldp x29, x30, [sp, #0x70]'),
 (4321045780, 2839957492, 'ldp x20, x19, [sp, #0x60]'),
 (4321045784, 2839894006, 'ldp x22, x21, [sp, #0x50]'),
 (4321045788, 2839830520, 'ldp x24, x23, [sp, #0x40]'),
 (4321045792, 2839767034, 'ldp x26, x25, [sp, #0x30]'),
 (4321045796, 2432828415, 'add sp, sp, #0x80'),
 (4321045800, 3596551104, 'ret '),
 (4321056084, 3107987113, 'ldr w9, [x21, #0x1c]'),
 (4321056088, 822084927, 'cmn w9, #1'),
 (4321056092, 1409286689, 'b.ne #0x1018e15a0'),
 (4321056096, 3107989161, 'ldr w9, [x21, #0x24]'),
 (4321056100, 822084927, 'cmn w9, #1'),
 (4321056104, 1409286593, 'b.ne #0x1018e15a0'),
 (4321056108, 3107990185, 'ldr w9, [x21, #0x28]'),
 (4321056112, 822084927, 'cmn w9, #1'),
 (4321056116, 1409286497, 'b.ne #0x1018e15a0'),
 (4321056120, 4181733640, 'ldr x8, [x8, #0x60]'),
 (4321056124, 960504072, 'ldrb w8, [x8, #8]'),
 (4321056128, 1895844127, 'cmp w8, #0x12'),
 (4321056132, 1409288200, 'b.hi #0x1018e1684'),
 (4321056136, 1384120361, 'mov w9, #1'),
 (4321056140, 449323305, 'lsl w9, w9, w8'),
 (4321056144, 1384188170, 'mov w10, #0x848'),
 (4321056148, 1923088618, 'movk w10, #7, lsl #16'),
 (4321056152, 1779040575, 'tst w9, w10'),
 (4321056156, 1409289792, 'b.eq #0x1018e1764'),
 (4321056160, 2853372896, 'mov x0, x19'),
 (4321056164, 2853438433, 'mov x1, x20'),
 (4321056168, 2853700578, 'mov x2, x24'),
 (4321056172, 2550134520, 'bl #0x1018df18c'),
 (4321056176, 335544373, 'b #0x1018e1684'),
 (4321047340, 1384121736, 'mov w8, #0x2c'),
 (4321047344, 2611510984, 'umull x8, w22, w8'),
 (4321047348, 3506454808, 'sub x24, x8, #0x10'),
 (4321047420, 3506483992, 'sub x24, x24, #0x2c'),
 (4321047440, 4181721761, 'ldr x1, [x21]'),
 (4321047444, 4181741608, 'ldr x8, [x1, #0xa0]'),
 (4321047448, 4181740820, 'ldr x20, [x8, #0x98]'),
 (4321048152, 2333606548, 'add x20, x20, x24'),
 (4321048200, 1021215360, 'ldur q0, [x20, #-0x18]'),
 (4321048204, 1016136608, 'stur q0, [x29, #-0xf0]'),
 (4321048208, 4181723880, 'ldr x8, [x23, #0x10]'),
 (4321048212, 1833830656, 'ldp d0, d2, [x8, #0xe0]'),
 (4321048216, 1836126113, 'ldp d1, d3, [x29, #-0xf0]'),
 (4321048220, 773970945, 'fmul v1.2s, v0.2s, v1.2s'),
 (4321048224, 774102080, 'fmul v0.2s, v2.2s, v3.2s'),
 (4321048228, 1831928737, 'stp d1, d0, [x29, #-0xf0]'),
 (4321048232, 960516360, 'ldrb w8, [x8, #0x14]'),
 (4321048236, 840892680, 'orr w8, w8, #2'),
 (4321048240, 1895827743, 'cmp w8, #2'),
 (4321048244, 1409286369, 'b.ne #0x1018df6d0'),
 (4321048248, 262180897, 'fmul v1.2s, v1.2s, v0.s[1]'),
 (4321048252, 4228973473, 'stur d1, [x29, #-0xf0]'),
 (4321048256, 262180864, 'fmul v0.2s, v0.2s, v0.s[1]'),
 (4321048260, 3155264416, 'stur s0, [x29, #-0xe8]'),
 (4321048264, 1386737672, 'mov w8, #0x3f800000'),
 (4321048268, 3088171944, 'stur w8, [x29, #-0xe4]'),
 (4321048272, 4166026144, 'ldur x0, [x29, #-0xf8]'),
 (4321048276, 2952816712, 'adrp x8, #0x1025e8000'),
 (4321048280, 4181898497, 'ldr x1, [x8, #0x568]'),
 (4321048284, 3506684834, 'sub x2, x29, #0xf0'),
 (4321048288, 2483146745, 'bl #0x1019536c4'),
 (4321523488, 4181721352, 'ldr x8, [x8]'),
 (4321523492, 2839554313, 'ldp x9, x10, [x8]'),
 (4321523496, 2839556779, 'ldp x11, x12, [x21]'),
 (4321523500, 3943366975, 'cmp x9, x11'),
 (4321523504, 4199285056, 'ccmp x10, x12, #0, eq'),
 (4321523508, 1384120375, 'mov w23, #1'),
 (4321523512, 1409287200, 'b.eq #0x1019537bc'),
 (4321523516, 1035993760, 'ldr q0, [x21]'),
 (4321523520, 1031799040, 'str q0, [x8]')]


def verify(image, core):
    for name, digest in PINS.items():
        witness.pinned(Path(name), digest)
    selected = []
    for pc, word, reading in WORDS:
        require(image.word(pc) == word, 'Mesh color selected instruction differs: ' + reading)
        selected.append({'address': hex(pc), 'word': f'{word:08x}', 'reading': reading})
    starts = routes.queues.function_starts(image.data, core['functionStarts'])
    spans = []
    for name, start, end, digest in SPANS:
        slot = bisect.bisect_left(starts, start)
        require(starts[slot:slot + 2] == [start, end], 'Mesh color function bounds differ: ' + name)
        raw = image.at(start, end - start)
        require(witness.sha(raw) == digest, 'Mesh color function bytes differ: ' + name)
        spans.append({'name': name, 'start': hex(start), 'next': hex(end),
                      'bytes': len(raw), 'sha256': digest, 'hex': raw.hex()})
    table = image.at(0x10213342b, 13)
    require(table.hex() == routes.legacy.TABLE_HEX, 'Mesh primitive switch differs')
    require(0x10189bb14 + table[3] * 4 == 0x10189bb74, 'Mesh p-type3 branch differs')
    image.movz(0x10189bb74, 0, 144)
    image.movz(0x10189bb7c, 8, 3)
    require(image.branch(0x10189bb78) == 0x1016934d0, 'Mesh allocation call differs')
    require(image.page_pointer(0x10189bbc0, 0x10189bbc4, 8) == 0x1024861e0,
            'Mesh constructor vptr differs')
    slot = 0x1024861e0 + 40
    target = struct.unpack('<Q', image.at(slot, 8))[0]
    require(target == 0x101914694 and image.word(target) == 0xd65f03c0,
            'Mesh quad slot is not the checked RET stub')
    branch = routes.queues.quad.conditional_branch
    require(branch(image, 0x1018ded0c) == (0, 0x1018ded2c), 'Quad exclusion branch differs')
    require(branch(image, 0x1018e1584) == (8, 0x1018e1684), 'Mesh selector bounds branch differs')
    require(branch(image, 0x1018e159c) == (0, 0x1018e1764), 'Mesh selector mask branch differs')
    require(branch(image, 0x1018df6b4) == (1, 0x1018df6d0), 'Mesh premultiply bypass differs')
    require(image.branch(0x1018e15ac) == 0x1018df18c, 'Mesh draw call differs')
    require(image.branch(0x1018df6e0) == 0x1019536c4, 'Mesh float4 transfer call differs')
    routes.verify(image, core)
    return {'functionSpans': spans, 'selectedInstructions': selected,
            'primitive': {'legacyPType': 3, 'factoryBranch': '0x10189bb74',
                          'allocationBytes': 144, 'kind': 3, 'kindOffset': 8,
                          'vptr': '0x1024861e0', 'quadSlotOffset': 40,
                          'quadSlotAddress': hex(slot), 'quadSlotMethod': hex(target),
                          'quadSlotBytes': image.at(slot, 8).hex(), 'quadSlotBehavior': 'RET only'},
            'quadExclusion': {'mask': '0x30888', 'comparedKindUpperBound': 17,
                              'excludedKinds': [3, 7, 11, 16, 17], 'kind3CallsQuadBuilder': False},
            'separateSelector': {'mask': '0x70848', 'comparedKindUpperBound': 18,
                                 'maskSelectedKinds': [3, 6, 11, 16, 17, 18],
                                 'call': '0x1018e15ac', 'target': '0x1018df18c',
                                 'limit': 'Mask path applies when the three preceding override fields equal -1; otherwise the call can also be selected.'},
            'floatTransfer': {'call': '0x1018df6e0', 'target': '0x1019536c4',
                              'mutableParameterKeyGlobal': '0x1025e8568', 'bytes': 16,
                              'load': '0x10195373c', 'store': '0x101953740',
                              'limit': 'Matched parameter identity and changed16-byte value select the Q0 copy; live key/shader binding remains unobserved.'}}


def source_rows(pin, compiled, raw):
    rows = routes.source_rows(pin, compiled, raw)['profiles']
    candidates = [r for r in rows if r['pType'] == 3]
    require(len(candidates) == 1, 'Gromp mesh candidate count differs')
    row = candidates[0]
    require((row['profileIndex'], row['group'], row['kind'], row['queue'],
             row['typeField']['effective']) == (6, 7, 'mesh', 'legacy-record', 'Complex'),
            'Gromp mesh source route differs')
    profile = compiled['profiles'][6]
    require(profile['blend'] == 1, 'Gromp mesh blend differs')
    return {'profileIndex': 6, 'name': profile['name'], 'group': 7,
            'legacyPType': 3, 'effectiveGroupType': 'Complex', 'blendMode': 1,
            'quadBytePolicyApplicable': False, 'applicationPolicyChanged': False}


def observe():
    defaults = routes.queues.quad.ray.defaults
    core = json.loads(witness.pinned(defaults.CORE, defaults.CORE_SHA256))
    native = witness.restored.checked(Path(core['native']['path']).read_bytes(), core['native'])
    witness.pinned(witness.PARSER, witness.PARSER_SHA256)
    data, sections = runpy.run_path(str(witness.PARSER))['arm64_sections'](native, core['native']['architecture'])
    pin = json.loads(witness.pinned(routes.legacy.GROMP, routes.legacy.GROMP_SHA256))
    compiled = json.loads(Path('src/content/gromp-death.json').read_bytes())
    return {'format': 1, 'native': core['native'],
            'inputs': [{'path': name, 'sha256': digest} for name, digest in PINS.items()],
            **verify(witness.Image(data, sections), core),
            'source': source_rows(pin, compiled, routes.colors.SOURCE_PATH.read_bytes()),
            'reading': {
                'factory': 'Legacy p-type3 allocates144B, stores kind3 at+8 and vptr1024861e0. Its slot+40 selects a separate four-byte RET stub, not CameraQuad, plane or Ray.',
                'excludedQuad': 'The legacy quad consumer forms a kind bit and compares it against mask0x30888 under the checked <=17 condition. Kind3 returns through the epilogue before the virtual builder call. Kinds3/7/11/16/17 are excluded; this is not a new global primitive catalog.',
                'separateRoute': '1018e1240 has an independent <=18/mask0x70848 selector after three override checks. The mask includes kind3 and calls1018df18c. Queue scheduling/live admission and complete material selection remain unobserved.',
                'color': 'The draw routine steps44-byte records. Count*44-16 and the per-iteration decrement locate RGBA at record+4 through an LDURQ at adjusted pointer-24. It multiplies definition modulation+E0 by draw RGBA in float32. Modes where (blend|2)==2 premultiply RGB and set A=1; checked Gromp mode1 skips that branch.',
                'transfer': 'A call to1019536c4 supplies the16-byte scratch and an identity loaded from a mutable global. On a matching identity whose stored value differs, the setter copies Q0 from the supplied RGBA to the stored value. No byte conversion occurs on that checked color-to-value copy path; the later shader binding remains unresolved.'},
            'nativeExecuted': False, 'nativeShaderExecuted': False, 'applicationBehaviorChanged': False,
            'limits': [
                'Static factory, exclusion, selector and conditional16-byte color-copy paths, not live native mesh drawing or complete visual parity.',
                'Mutable parameter key1025e8568 is zero-fill in the image; its runtime name, initialization, shader binding and later conversions are not established.',
                'Source raw-key float32 arithmetic, backing mode/cache mutation, phase, clocks/RNG, external modulation and FPCR require their own conditional projection before a local change.',
                'Mesh geometry, textures, UVs, material selection, draw ordering and actual queue scheduling remain separate.',
                'No runtime sampler or color storage is changed. Do not extend quad BGRA packing to Gromp mesh profile6.']}


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
