"""Bind original missile emitter classes and raw colors to checked legacy routes."""
from pathlib import Path
import argparse, json, runpy
import legacy_troy
import native_gromp_emitter_routes as routes
import native_plane_color_packets as plane
from masteryi_audio_graph import write_outputs
witness = routes.witness
require = witness.require
OUTPUT = Path('docs/reference/native-gromp-attack-colors.json')
SOURCE = Path('.cache/gromp-attack-color-source/sru_gromp_ba1_mis.troybin')
NAME = 'data/particles/sru_gromp_ba1_mis.troybin'
SOURCE_SHA256 = '22800fca4d3b9b9e9b339692e29325e13739927973399862dba7aecd7130a4c0'
PINS = {str(routes.OUTPUT): '8e268d02303addefa4c70b311215329d4ef1782eac4ae12378a54039dd6eff3c',
        str(plane.OUTPUT): 'bb9528c072b7223dd85c9a2ab678b1cb1564ea28885a97ec438d626b2d3bb2ea',
        'docs/reference/native-legacy-color-curves.json': 'b41ba9cea4d747af9e39b94ab59738120e83e83743179c5851bf2e4e8d282e72',
        'docs/reference/gromp-effects.json': '3cb54cd774fbfd66cc52846bb8775d17ab0adb473a570600e274e5f2ae0a1033',
        'src/content/gromp-attack.json': '6d42ccb6a3e2b60076abd9a5112ffc8f59def01271c3468f128c00141ee345a8'}
NAMES = ['Mis_orb', 'black_background', 'mis_plane', 'trailorbs']
TYPES = [0, 1, 1, 0]
MODES = [0, 2, 4, 0]

def source_rows(pin, compiled, raw):
    require(len(raw) == 1114 and witness.sha(raw) == SOURCE_SHA256, 'Original missile source bytes differ')
    witness.pinned(routes.colors.TROY_READER, routes.colors.TROY_READER_SHA256)
    parsed = legacy_troy.read(raw)
    record = pin['records'][NAME]
    require(parsed == record['typed'] and legacy_troy.decode(parsed, record['labels']) == record['decoded'], 'Original typed or decoded missile record differs')
    require(len(parsed['rows']) == 114, 'Original missile row count differs')
    require(len(compiled['profiles']) == 4 and [p['name'] for p in compiled['profiles']] == NAMES, 'Missile profile order differs')
    typed = {r['hash']: r for r in parsed['rows']}
    fields = record['decoded']['values']
    rows = []
    for index, profile in enumerate(compiled['profiles']):
        section = NAMES[index]
        group = index + 1
        require(profile['sourceRecord'] == NAME and profile['sourceIndex'] == index and fields['System'][f'GroupPart{group}'] == section, 'Missile source linkage differs')
        type_field = f'GroupPart{group}Type'
        type_key = legacy_troy.ihash('System', type_field)
        require(type_key not in typed and type_field not in fields['System'], 'Missile Complex fallback has an override')
        original = fields[section]
        require(original['p-type'] == TYPES[index] and profile['kind'] == ['billboard', 'quad'][TYPES[index]], 'Missile primitive route differs')
        require(original['rendermode'] == MODES[index] and profile['blend'] == MODES[index], 'Missile premultiplication mode differs')
        base_key = legacy_troy.ihash(section, 'p-xrgba')
        base_row = typed.get(base_key)
        base = routes.colors.numeric_string(base_row, 4) if base_row else {'raw': None, 'values': [1.] * 4, 'words': ['3f800000'] * 4}
        require(profile['color'] == (legacy_troy.semantic(base['raw']) if base['raw'] else [1] * 4), 'Missile base color differs')
        keys = []
        for ordinal, key in enumerate(profile['colorCurve'], 1):
            field = f'p-xrgba{ordinal}'
            hashed = legacy_troy.ihash(section, field)
            require(hashed in typed, 'Missile color key missing')
            value = routes.colors.numeric_string(typed[hashed], 5)
            require(legacy_troy.semantic(value['raw']) == [key['time'], *key['value']], 'Compiled missile color key differs')
            prepared = [routes.colors.f32(value['values'][i + 1] * base['values'][i]) for i in range(4)]
            keys.append({'field': field, 'sdbm': hashed, 'source': value, 'timeWord': value['words'][0], 'preparedRgba': prepared, 'preparedWords': [routes.colors.word(v) for v in prepared]})
        require(legacy_troy.ihash(section, f'p-xrgba{len(keys) + 1}') not in typed, 'Missile color key scope expands')
        require(all(keys[k - 1]['source']['values'][0] < keys[k]['source']['values'][0] for k in range(1, len(keys))), 'Missile float32 key order differs')
        omissions = []
        for field in ['e-rgba', 'e-rgba1', *[f'p-xrgba{c}P{s}' for c in 'RGBA' for s in ['', 1]]]:
            hashed = legacy_troy.ihash(section, field)
            require(hashed not in typed, 'Missile birth/probability color field is present')
            omissions.append({'field': field, 'sdbm': hashed})
        require(all(0 <= v <= 1 for v in base['values']) and all(0 <= v <= 1 for k in keys for v in k['preparedRgba']), 'Missile unit color contract differs')
        rows.append({'profileIndex': index, 'section': section, 'group': group, 'groupType': {'sdbm': type_key, 'present': False, 'effective': 'Complex'}, 'pType': TYPES[index], 'kind': profile['kind'], 'blendMode': MODES[index], 'premultiply': MODES[index] in [0, 2], 'colorHelper': '0x10167faf0', 'base': base, 'keys': keys, 'constantBaseWithoutKeys': not keys, 'absentBirthAndProbabilityKeys': omissions})
    require([len(r['keys']) for r in rows] == [4, 5, 4, 0], 'Missile raw color scope differs')
    return {'resource': {'path': str(SOURCE), 'bytes': len(raw), 'sha256': SOURCE_SHA256}, 'typedRows': 114, 'originalTypedAndDecodedRecordsExact': True, 'profiles': rows, 'hostScanfSourceWordsExact': True}

def verify(image, core):
    for name, digest in PINS.items():
        witness.pinned(Path(name), digest)
    routes.verify(image, core)
    routes.colors.verify(image, core)
    plane.verify(image, core)

def observe(source_path=SOURCE):
    core = json.loads(witness.pinned(routes.queues.quad.ray.defaults.CORE, routes.queues.quad.ray.defaults.CORE_SHA256))
    raw = witness.restored.checked(Path(core['native']['path']).read_bytes(), core['native'])
    witness.pinned(witness.PARSER, witness.PARSER_SHA256)
    data, sections = runpy.run_path(str(witness.PARSER))['arm64_sections'](raw, core['native']['architecture'])
    verify(witness.Image(data, sections), core)
    pin = json.loads(Path('docs/reference/gromp-effects.json').read_bytes())
    compiled = json.loads(Path('src/content/gromp-attack.json').read_bytes())
    return {'format': 1, 'native': core['native'], 'inputs': [{'path': p, 'sha256': h} for p, h in PINS.items()], 'source': source_rows(pin, compiled, Path(source_path).read_bytes()), 'reading': {'routes': 'All four original GroupPartNType fields are absent. The checked loader defaults them to Complex, selecting the legacy record queue. Original p-type0 selects CameraQuad and p-type1 selects plane. Both checked color paths call the truncating helper10167faf0 after conditional mode0/2 premultiplication and alpha replacement.', 'rawColor': 'The common Complex reader prepares p-xrgba raw keys using float32 base-times-key products. Conditional raw-key interpolation uses separate float32 operations. Trailorbs has no keys and retains the unit default/base. All four omit the checked birth/probability color fields.', 'scope': 'The local adapter may use these checked conditional color routes at its own normalized phases. This does not authenticate native event clocks, live layout/material admission, actual modifier values or complete appearance.'}, 'nativeExecuted': False, 'nativeShaderExecuted': False, 'applicationBehaviorChanged': False, 'limits': ['Static source and instruction replay only; no native game execution.', 'Live cache backing mode, parser flags, external/birth/modulation values and FPCR remain unobserved.', 'Local phase, emission, RNG, motion, geometry and blending remain separate from this color component.', 'No hit-effect, sound, root/gravity solver or full native composition claim.']}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=SOURCE)
    parser.add_argument('--output', type=Path, default=OUTPUT)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = observe(args.source)
    write_outputs([(args.output, (json.dumps(result, indent=2, allow_nan=False) + '\n').encode())], args.check)
    print(json.dumps({'profiles': 4, 'typedRows': 114, 'keys': 13, 'nativeExecuted': False}))
