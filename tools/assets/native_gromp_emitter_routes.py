"""Bind original Gromp Troy group types to the checked native particle queue classes."""
from pathlib import Path
import bisect, json, runpy, struct
import native_particle_queue_routes as queues
import native_legacy_color_curves as colors
import native_legacy_primitive_types as legacy
from masteryi_audio_graph import write_outputs
witness = queues.witness
require = witness.require
OUTPUT = Path('docs/reference/native-gromp-emitter-routes.json')
PINS = {'docs/reference/native-legacy-color-curves.json': 'b41ba9cea4d747af9e39b94ab59738120e83e83743179c5851bf2e4e8d282e72',
 'docs/reference/native-legacy-primitive-types.json': '2e56236915d08ec883f89de2848a0571dc2085081b837d75e5a412ef8cdfda61',
 'docs/reference/native-particle-queue-routes.json': '72d17aaf1287ca93f51d00c5d845cecf65c134526e3028a8fd4e1e34cbc6558e'}
SPANS = [('legacySystemReader',
  4320762408,
  4320764692,
  'fea81a026d71a6f47f4cb869d6294a8c25e8129420b9e8eff71da48ba01d5efa'),
 ('sectionFieldStringLookup',
  4318233308,
  4318233452,
  'fffb21b0afb18f459e26f2f2010c57c92b373d7d2d50a407f51c7a3ee7ae131a'),
 ('exactStringEquals', 4318733832, 4318733904, 'da100a09d6eada6bce289cd69af5d9122fc2484f01d47b2932f220bbbc7dd858')]
WORDS = [(4320762524, 1384120342, 'mov w22, #0'),
 (4320762528, 2432771048, 'add x8, sp, #0x48'),
 (4320762532, 2432712969, 'add x9, x8, #0x10'),
 (4320762536, 2432737928, 'add x8, x20, #0x28'),
 (4320762540, 4177528808, 'str x8, [sp, #8]'),
 (4320762544, 4026552053, 'adrp x21, #0x102278000'),
 (4320762548, 2434636469, 'add x21, x21, #0x766'),
 (4320762552, 4026552056, 'adrp x24, #0x102278000'),
 (4320762556, 2433331992, 'add x24, x24, #0x26c'),
 (4320762560, 4026552057, 'adrp x25, #0x102278000'),
 (4320762564, 2434646841, 'add x25, x25, #0x770'),
 (4320762568, 4026552055, 'adrp x23, #0x102278000'),
 (4320762572, 2434625271, 'add x23, x23, #0x75b'),
 (4320762576, 2432754312, 'add x8, x20, #0x38'),
 (4320762580, 2835425256, 'stp x8, x9, [sp, #0x10]'),
 (4320762748, 2433344480, 'add x0, sp, #0x278'),
 (4320762752, 4026552033, 'adrp x1, #0x102278000'),
 (4320762756, 2434653217, 'add x1, x1, #0x777'),
 (4320762760, 2549630620, 'bl #0x1016ab5f8'),
 (4320762764, 4181725160, 'ldr x8, [sp, #0x18]'),
 (4320762768, 4177537000, 'str x8, [sp, #0x48]'),
 (4320762772, 4244646888, 'str d8, [sp, #0x50]'),
 (4320762776, 956392447, 'strb wzr, [sp, #0x58]'),
 (4320762780, 4181802979, 'ldr x3, [sp, #0x278]'),
 (4320762784, 4181721696, 'ldr x0, [x19]'),
 (4320762788, 2432771041, 'add x1, sp, #0x48'),
 (4320762792, 2853700578, 'mov x2, x24'),
 (4320762796, 4026552036, 'adrp x4, #0x102278000'),
 (4320762800, 2434658436, 'add x4, x4, #0x77c'),
 (4320762804, 2549504458, 'bl #0x1016302dc'),
 (4320762808, 2432771040, 'add x0, sp, #0x48'),
 (4320762812, 4026552033, 'adrp x1, #0x102278000'),
 (4320762816, 2434666529, 'add x1, x1, #0x784'),
 (4320762820, 2549629585, 'bl #0x1016aa608'),
 (4320762824, 4181767137, 'ldr x1, [sp, #0x160]'),
 (4320762828, 872416128, 'cbz w0, #0x101899c3c'),
 (4320762832, 2853372896, 'mov x0, x19'),
 (4320762836, 2853897186, 'mov x2, x27'),
 (4320762840, 2483035781, 'bl #0x1018a15ec'),
 (4320762844, 692528789, 'ldp w21, w9, [x20, #0x38]'),
 (4320762848, 285214376, 'add w8, w21, #1'),
 (4320762852, 2453698857, 'and x9, x9, #0x7fffffff'),
 (4320762856, 1795686719, 'cmp w9, w8'),
 (4320762860, 1409289890, 'b.hs #0x101899dc0'),
 (4320762864, 2336818473, 'add x9, x9, x9, lsr #1'),
 (4320762868, 3943170367, 'cmp x9, x8'),
 (4320762872, 2592637242, 'csel x26, x9, x8, hi'),
 (4320762876, 3548246848, 'lsl x0, x26, #3'),
 (4320762940, 2853372896, 'mov x0, x19'),
 (4320762944, 2853897186, 'mov x2, x27'),
 (4320762948, 2483028404, 'bl #0x10189a314'),
 (4320763232, 692397717, 'ldp w21, w9, [x20, #0x28]'),
 (4320763236, 285214376, 'add w8, w21, #1'),
 (4320763240, 2453698857, 'and x9, x9, #0x7fffffff'),
 (4320763244, 1795686719, 'cmp w9, w8'),
 (4320763248, 1409286882, 'b.hs #0x101899dcc'),
 (4320763252, 2336818473, 'add x9, x9, x9, lsr #1'),
 (4320763256, 3943170367, 'cmp x9, x8'),
 (4320763260, 2592637242, 'csel x26, x9, x8, hi'),
 (4320763264, 3548246848, 'lsl x0, x26, #3'),
 (4320763268, 2549605748, 'bl #0x101693354'),
 (4320763272, 2852127740, 'mov x28, x0'),
 (4320763276, 3107990152, 'ldr w8, [x20, #0x28]'),
 (4320763280, 872418440, 'cbz w8, #0x101899f20'),
 (4320763284, 4181725834, 'ldr x10, [x20, #0x20]'),
 (4320763328, 4181727900, 'ldr x28, [x20, #0x30]'),
 (4320763332, 4181724136, 'ldr x8, [sp, #0x10]'),
 (4320763336, 335544413, 'b #0x101899f3c'),
 (4320763340, 4181725852, 'ldr x28, [x20, #0x20]'),
 (4320763344, 4181723112, 'ldr x8, [sp, #8]'),
 (4320763348, 335544410, 'b #0x101899f3c'),
 (4320763516, 4177533596, 'str x28, [x20, #0x30]'),
 (4320763520, 4181724136, 'ldr x8, [sp, #0x10]'),
 (4320763524, 688351893, 'stp w21, w26, [x20, #0x38]'),
 (4320763528, 335544365, 'b #0x101899f3c'),
 (4320763680, 3107991176, 'ldr w8, [x20, #0x2c]'),
 (4320763684, 938999912, 'tbnz w8, #0x1f, #0x101899f30'),
 (4320763688, 4181725824, 'ldr x0, [x20, #0x20]'),
 (4320763692, 2549605666, 'bl #0x1016933b4'),
 (4320763696, 4177531548, 'str x28, [x20, #0x20]'),
 (4320763700, 4181723112, 'ldr x8, [sp, #8]'),
 (4320763704, 688220821, 'stp w21, w26, [x20, #0x28]'),
 (4320763708, 4164246427, 'str x27, [x28, w21, uxtw #3]'),
 (4320763712, 3107979529, 'ldr w9, [x8]'),
 (4320763716, 285213993, 'add w9, w9, #1'),
 (4320763720, 3103785225, 'str w9, [x8]'),
 (4318233444, 2852389859, 'mov x3, x4'),
 (4318233448, 335544321, 'b #0x10163036c'),
 (4318733832, 4181721096, 'ldr x8, [x0]'),
 (4318733836, 960495881, 'ldrb w9, [x8]'),
 (4318733840, 960495658, 'ldrb w10, [x1]'),
 (4318733844, 1795817791, 'cmp w9, w10'),
 (4318733848, 446633952, 'cset w0, eq'),
 (4318733852, 1895825727, 'cmp w9, #0'),
 (4318733856, 2051674400, 'ccmp w9, w10, #0, ne'),
 (4318733860, 1409286465, 'b.ne #0x1016aa64c'),
 (4318733864, 2432697608, 'add x8, x8, #1'),
 (4318733868, 2432697385, 'add x9, x1, #1'),
 (4318733872, 943723786, 'ldrb w10, [x8], #1'),
 (4318733876, 943723819, 'ldrb w11, [x9], #1'),
 (4318733880, 1795883359, 'cmp w10, w11'),
 (4318733884, 446633952, 'cset w0, eq'),
 (4318733888, 1895825759, 'cmp w10, #0'),
 (4318733892, 2051739968, 'ccmp w10, w11, #0, ne'),
 (4318733896, 1426063168, 'b.eq #0x1016aa630'),
 (4318733900, 3596551104, 'ret '),
 (4320770836, 1384121088, 'mov w0, #0x18'),
 (4320770840, 2549603950, 'bl #0x1016934d0'),
 (4320770844, 956309535, 'strb wzr, [x0, #8]'),
 (4320770848, 3489685288, 'adrp x8, #0x102481000'),
 (4320770852, 2436620552, 'add x8, x8, #0xef8'),
 (4320770856, 335544522, 'b #0x10189be50')]

LITERALS = [(0x102278766, 'GroupPart'), (0x102278777, 'Type'),
            (0x10227877c, 'Complex'), (0x102278784, 'Simple')]
NAMES = ['flash', 'lightring', 'flashfrog', 'chunks', 'shadow', 'pop', 'skinshards', 'popshards']


def source_rows(pin, compiled, raw):
    # Reparse all original typed rows, decoded labels and compiled color/source
    # links through the existing strict original-byte witness.
    original = colors.source_rows(pin, compiled, raw)
    record = pin['records'][colors.SOURCE_NAME]
    values = record['decoded']['values']
    typed = {row['hash']: row for row in record['typed']['rows']}
    require([p['name'] for p in compiled['profiles']] == NAMES, 'Gromp profile order differs')
    rows = []
    for index, profile in enumerate(compiled['profiles']):
        group = profile['sourceIndex'] + 1
        field = f'GroupPart{group}Type'
        key = colors.modulation.source_key('System', field)
        declaration = typed.get(key)
        if declaration is not None:
            require(declaration['storage'] == 'string' and declaration['raw'] == 'Simple',
                    'Gromp declared group type differs')
        expected = index == 0
        require((declaration is not None) == expected, 'Gromp group-type presence differs')
        require(values['System'].get(field) == ('Simple' if expected else None),
                'Gromp decoded group-type declaration differs')
        ptype = values[profile['sourceSection']]['p-type']
        require(type(ptype) is int and ptype in range(4), 'Gromp primitive source differs')
        require(profile['kind'] == ['billboard', 'quad', 'ray', 'mesh'][ptype],
                'Gromp compiled primitive differs')
        effective = 'Simple' if expected else 'Complex'
        rows.append({
            'profileIndex': index, 'name': profile['name'], 'group': group,
            'sourceSection': profile['sourceSection'],
            'typeField': {'field': field, 'sdbm': key, 'present': declaration is not None,
                          'raw': declaration['raw'] if declaration else None,
                          'default': 'Complex', 'effective': effective},
            'pType': ptype, 'kind': profile['kind'],
            'queue': 'optimized-pointer' if effective == 'Simple' else 'legacy-record',
            'cameraQuadTruncatingCandidate': effective == 'Complex' and ptype == 0,
        })
    require([r['profileIndex'] for r in rows if r['cameraQuadTruncatingCandidate']] == [1, 2, 3],
            'Gromp CameraQuad candidate scope differs')
    return {'resource': original['resource'], 'typedRows': original['typedRows'],
            'originalTypedAndDecodedRecordsExact': True, 'profiles': rows,
            'simpleProfiles': [0], 'complexProfiles': list(range(1, 8)),
            'complexCameraQuadProfiles': [1, 2, 3]}


def verify(image, core):
    for name, digest in PINS.items():
        witness.pinned(Path(name), digest)
    queues.verify(image, core)
    legacy.verify(image, core)
    starts = queues.function_starts(image.data, core['functionStarts'])
    spans = []
    for name, start, end, digest in SPANS:
        slot = bisect.bisect_left(starts, start)
        require(starts[slot:slot + 2] == [start, end], 'Gromp route function bounds differ: ' + name)
        raw = image.at(start, end - start)
        require(witness.sha(raw) == digest, 'Gromp route function bytes differ: ' + name)
        spans.append({'name': name, 'start': hex(start), 'next': hex(end),
                      'bytes': len(raw), 'sha256': digest, 'hex': raw.hex()})
    selected = []
    for pc, word, reading in WORDS:
        require(image.word(pc) == word, 'Gromp route selected word differs: ' + reading)
        selected.append({'address': hex(pc), 'word': f'{word:08x}', 'reading': reading})
    for address, value in LITERALS:
        require(image.at(address, len(value) + 1) == value.encode() + b'\0',
                'Gromp route literal differs: ' + value)
    for pc, add, register, target in [
        (0x101899ab0, 0x101899ab4, 21, 0x102278766),
        (0x101899b80, 0x101899b84, 1, 0x102278777),
        (0x101899bac, 0x101899bb0, 4, 0x10227877c),
        (0x101899bbc, 0x101899bc0, 1, 0x102278784),
    ]:
        require(image.page_pointer(pc, add, register) == target, 'Gromp route field/default pointer differs')
    for pc, target in [(0x101899bb4, 0x1016302dc), (0x101899bc4, 0x1016aa608),
                       (0x101899bd8, 0x1018a15ec), (0x101899c44, 0x10189a314)]:
        require(image.branch(pc) == target, 'Gromp route reader call differs')
    require(image.branch(0x101630368, False) == 0x10163036c, 'Gromp route string lookup tail differs')
    require(image.word(0x101899bcc) == 0x34000380, 'Gromp simple/complex branch differs')
    require(image.page_pointer(0x10189bb20, 0x10189bb24, 8) == 0x102481ef8,
            'Legacy p-type zero CameraQuad vptr differs')
    require(struct.unpack('<Q', image.at(0x102481ef8 + 40, 8))[0] == 0x1018d7f34,
            'Legacy p-type zero CameraQuad method differs')
    return {'functionSpans': spans, 'selectedInstructions': selected,
            'literals': [{'address': hex(a), 'value': value} for a, value in LITERALS]}


def observe():
    core = json.loads(witness.pinned(queues.quad.ray.defaults.CORE, queues.quad.ray.defaults.CORE_SHA256))
    native = witness.restored.checked(Path(core['native']['path']).read_bytes(), core['native'])
    witness.pinned(witness.PARSER, witness.PARSER_SHA256)
    data, sections = runpy.run_path(str(witness.PARSER))['arm64_sections'](native, core['native']['architecture'])
    pin = json.loads(witness.pinned(legacy.GROMP, legacy.GROMP_SHA256))
    compiled = json.loads(Path('src/content/gromp-death.json').read_bytes())
    return {
        'format': 1, 'native': core['native'],
        'inputs': [{'path': name, 'sha256': digest} for name, digest in PINS.items()],
        **verify(witness.Image(data, sections), core),
        'source': source_rows(pin, compiled, colors.SOURCE_PATH.read_bytes()),
        'reading': {
            'lookup': '101899a28 builds System GroupPartNType, passes literal Complex as the string fallback, and compares the result with literal Simple through1016aa608. That helper returns case-sensitive byte equality. Nonzero selects1018a15ec and source+30; zero selects10189a314 and source+20. The SDBM lookup wrapper transfers X4 fallback to X3 of10163036c.',
            'source': 'The original2720-byte Gromp Troy record explicitly authors only GroupPart1Type=Simple. Flash is group1/profile0. The remaining seven group-type keys are absent from the complete typed record and use Complex in this checked loader. Profile order differs from group order; sourceIndex links are validated.',
            'scope': 'Queue lineage and primitive factory identify profiles1/2/3 as complex p-type0 CameraQuad candidates. Flash is a separate Simple path; shadow p-type1 and skinshards p-type3 remain separate primitive families. Profiles5/7 retain the already checked Ray type2 lineage. No application packing changes follow automatically from this witness.',
        },
        'nativeExecuted': False, 'nativeShaderExecuted': False, 'applicationBehaviorChanged': False,
        'limits': [
            'Static checked loader/source branch, not captured native loading or drawing.',
            'Live loader modes, source mutation, actual admission, material/layout binding and final appearance remain unobserved.',
            'Simple flash orientation/packet selection and plane/mesh packing are outside this candidate audit.',
            'Color-component backing mode, phase/RNG, external modifiers and FPCR remain separate from source-class routing.',
        ],
    }


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--output', type=Path, default=OUTPUT)
    args = parser.parse_args()
    result = observe()
    write_outputs([(args.output, (json.dumps(result, indent=2, allow_nan=False) + '\n').encode())], args.check)
    print(json.dumps({'functions': len(result['functionSpans']),
                      'instructions': len(result['selectedInstructions']),
                      'simpleProfiles': result['source']['simpleProfiles'],
                      'complexCameraQuadProfiles': result['source']['complexCameraQuadProfiles'],
                      'nativeExecuted': False}))
