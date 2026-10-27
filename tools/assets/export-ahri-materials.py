"""Project exact Ahri skin material declarations and current GLB transport.

This is source evidence, not a native shader implementation. Missing fields stay
missing. --check never writes; differing existing output is never overwritten.
"""
import argparse
import copy
import hashlib
import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PINS = {
    'docs/reference/ahri-model.json': ('74d0b55f5aad08646fbd24f660ed533bc8fd5798e8a60dc0983d97960b47a377', 234866),
    'docs/reference/ahri/skin0.bin': ('cea16ff8c3ef87fe6892595ad26dd710b3a7e9db33dfb05d30e1938ff27bbb17', 20378),
    'docs/reference/ahri/mesh-submeshes.bin': ('787b1b497a7a70af39e8f4bf3ce191c3d17d3bf8a44deee12c018692e036756f', 332),
    'public/assets/models/ahri-base.glb': ('587c1741a908e23874a87d069505e0e233d4f88c22a828c9d7edda195328e202', 19854544),
    'public/assets/models/ahri-base.json': ('c6a42818e2b02c8e4f4e2db7a313beb439521934d083e4262b79210bef27eca4', 25427),
}
SKIN = 'Characters/Ahri/Skins/Skin0'
MATERIALS = [SKIN + '/Materials/MAT_Body_inst', SKIN + '/Materials/MAT_Tails_inst']
SKN_PATH = 'assets/characters/ahri/skins/base/ahri_base.skn'
SKN_SHA = '22179a3e0e95b94845fe5a3d3c35ba5f21dec6e2fee34de371ad0e4a3e2a3ae3'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def load(root=ROOT):
    data = {}
    for name, (digest, size) in PINS.items():
        raw = (root / name).read_bytes()
        require(len(raw) == size and sha(raw) == digest, 'Frozen material input changed: ' + name)
        data[name] = raw
    model = json.loads(data['docs/reference/ahri-model.json'])
    require(model['extraction']['referenceVersion'] == '16.18.8175716', 'Unexpected source cohort')
    require(model['extraction']['manifest']['sha256'] == '564984ff169e7554607cae96d3cdca7812dfc5978736e889f347def39142a0cb', 'Manifest differs')
    require(model['extraction']['archive'] == 'DATA/FINAL/Champions/Ahri.wad.client', 'Archive differs')
    return data, model


def f32_word(value):
    require(type(value) in (int, float) and math.isfinite(value), 'Expected finite source number')
    try:
        raw = struct.pack('<f', value)
    except (OverflowError, struct.error) as error:
        raise ValueError('Source number is outside float32') from error
    require(struct.unpack('<f', raw)[0] == value, 'Source number is not exact float32')
    return '%08x' % struct.unpack('<I', raw)[0]


def submeshes(raw):
    require(len(raw) == 332 and struct.unpack_from('<IHHI', raw) == (0x112233, 4, 1, 4), 'Source SKN table differs')
    rows = []
    for index in range(4):
        at = 12 + index * 80
        name_bytes = raw[at:at + 64]
        require(b'\0' in name_bytes, 'Unterminated source submesh name')
        name = name_bytes.split(b'\0')[0].decode('utf8')
        first_vertex, vertices, first_index, indices = struct.unpack_from('<IIII', raw, at + 64)
        rows.append(dict(name=name, firstVertex=first_vertex, vertices=vertices,
                         firstIndex=first_index, indices=indices))
    require([row['name'] for row in rows] == ['Body', 'Eyes', 'Tails', 'Tail_Large'], 'Source submesh names differ')
    return rows


def glb_json(raw):
    magic, version, length = struct.unpack_from('<III', raw)
    require((magic, version, length) == (0x46546c67, 2, len(raw)), 'Invalid GLB envelope')
    size, kind = struct.unpack_from('<II', raw, 12)
    require(kind == 0x4e4f534a and 20 + size <= len(raw), 'Invalid GLB JSON chunk')
    return json.loads(raw[20:20 + size])


def project(model, mesh_rows, glb):
    records = model['skin']['data']
    require(len(records) == 5 and type(records['__linked']) is list, 'Unexpected local skin record closure')
    require(len(records['__linked']) == 23 and sha(json.dumps(records['__linked'],separators=(',',':'),ensure_ascii=True).encode()) == 'ab44938dfa24a4eb8a5ffcc495170c68076573dee51e4741f5096d804c2aa989', 'Linked package declarations differ')
    require({key for key, value in records.items() if isinstance(value, dict) and value.get('__type') == 'StaticMaterialDef'} == set(MATERIALS), 'Material set differs')
    skin = records[SKIN]['skinMeshProperties']
    resources = {row['path']: row for row in model['extraction']['files']}
    skn = resources[SKN_PATH]
    require(skn['bytes'] == 847032 and skn['sha256'] == SKN_SHA, 'Full source SKN pin differs')
    overrides = {row['submesh']: row for row in skin['materialOverride']}
    require(len(overrides) == 3 and set(overrides) == {'Body', 'Tails', 'Tail_Large'}, 'Submesh override set differs')
    declared_hidden = skin['initialSubmeshToHide'].split(' ')
    materials, sampler_count, missing_values, missing_switches = [], 0, [], []
    for key in MATERIALS:
        material = records[key]
        require(material['name'] == key and material['__type'] == 'StaticMaterialDef', 'Material identity differs')
        parameters, switches, samplers = [], [], []
        require(len({p['name'] for p in material['paramValues']}) == len(material['paramValues']), 'Duplicate parameter')
        require(len({p['name'] for p in material['switches']}) == len(material['switches']), 'Duplicate switch')
        require(len({p['TextureName'] for p in material['samplerValues']}) == len(material['samplerValues']), 'Duplicate sampler')
        for parameter in material['paramValues']:
            row = dict(name=parameter['name'], valuePresent='value' in parameter)
            if row['valuePresent']:
                require(type(parameter['value']) is list and len(parameter['value']) == 4, 'Expected source float4')
                row['value'] = copy.deepcopy(parameter['value'])
                row['float32Words'] = [f32_word(value) for value in parameter['value']]
            else:
                missing_values.append(dict(material=key, parameter=parameter['name']))
            parameters.append(row)
        for switch in material['switches']:
            row = dict(name=switch['name'], onPresent='on' in switch)
            if row['onPresent']:
                require(type(switch['on']) is bool, 'Switch state must be boolean')
                row['on'] = switch['on']
            else:
                missing_switches.append(dict(material=key, switch=switch['name']))
            switches.append(row)
        for sampler in material['samplerValues']:
            path = sampler['texturePath'].lower()
            require(path in resources, 'Sampler is outside the frozen extraction')
            samplers.append(dict(definition=copy.deepcopy(sampler), source=copy.deepcopy(resources[path])))
        sampler_count += len(samplers)
        materials.append(dict(record=key, definition=copy.deepcopy(material), parameters=parameters,
                              switches=switches, samplers=samplers))
    require(sampler_count == 5, 'Unexpected sampler count')
    source_bindings, preview = [], []
    glb_materials = glb['materials']
    require(len(glb_materials) == 4 and len(glb['images']) == 2, 'Preview material/image count differs')
    primitive_counts = {}
    for mesh in glb['meshes']:
        for primitive in mesh['primitives']:
            index = primitive['material']
            primitive_counts[index] = primitive_counts.get(index, 0) + glb['accessors'][primitive['indices']]['count']
    for index, row in enumerate(mesh_rows):
        name, override = row['name'], overrides.get(row['name'])
        if override and 'Material' in override:
            route, material = 'customMaterial', override['Material']
            require(material in MATERIALS, 'Unknown material link')
            diffuse = next(s['texturePath'] for s in records[material]['samplerValues'] if s['TextureName'] == 'Diffuse_Texture')
        elif override and 'texture' in override:
            route, material, diffuse = 'textureOverride', None, override['texture']
        else:
            route, material, diffuse = 'defaultSkinMeshProperties', None, skin['texture']
        source_bindings.append(dict(submesh=name, route=route, material=material, diffuse=diffuse,
                                    sourceDraw=copy.deepcopy(row), declaredHidden=name in declared_hidden))
        current = glb_materials[index]
        require(current['name'] == name and current['extras']['sourceSubmesh'] == name, 'Preview submesh identity differs')
        require(type(current['extras']['defaultHidden']) is bool and current['extras']['defaultHidden'] == (name in declared_hidden), 'Preview hidden flag differs')
        require(primitive_counts.get(index) == row['indices'], 'Preview draw index count differs')
        require('KHR_materials_unlit' in current.get('extensions', {}), 'Preview shading scope changed')
        preview.append(dict(submesh=name, material=copy.deepcopy(current), indexCount=primitive_counts[index]))
    return dict(format=1, sourceSkinRecord=SKIN, linkedPackageNames=copy.deepcopy(records['__linked']), linkedPackagesDecoded=False, sourceMeshProperties=copy.deepcopy(skin),
                sourceBindings=source_bindings, materials=materials,
                fieldPresence=dict(absentParameterValues=missing_values, absentSwitchStates=missing_switches),
                sourceMeshTable=dict(source=copy.deepcopy(skn), retainedOffset=0, retainedBytes=332,
                                     retainedSha256=PINS['docs/reference/ahri/mesh-submeshes.bin'][0]),
                declaredHiddenWithoutMesh=[name for name in declared_hidden if name not in {r['name'] for r in mesh_rows}],
                currentPreviewTransport=dict(materials=preview, images=copy.deepcopy(glb['images']),
                                             textures=copy.deepcopy(glb['textures']), samplers=copy.deepcopy(glb.get('samplers', []))),
                nativeDefaultsVerified=False, nativeShaderArithmeticVerified=False,
                nativeBlendEnumMappingVerified=False, nativeDynamicDriverDispatchVerified=False,
                previewPixelConversionReaudited=False,
                limits=['Missing value/on/driver fields remain absent; no constructor defaults supplied.',
                        'Shader paths, pass factors and driver declarations are source records, not recovered native execution.',
                        'Current GLB transport is inspected structurally; texture conversion and native pixels are not recertified.'])


def generate(root=ROOT):
    data, model = load(root)
    result = project(model, submeshes(data['docs/reference/ahri/mesh-submeshes.bin']),
                     glb_json(data['public/assets/models/ahri-base.glb']))
    result['sourceInputs'] = [dict(path=name, bytes=size, sha256=digest) for name, (digest, size) in PINS.items()]
    return (json.dumps(result, indent=2) + '\n').encode()


def publish(content, output, check=False):
    if output.exists():
        require(output.read_bytes() == content, 'Generated output differs; refusing overwrite')
    else:
        require(not check, 'Generated output is missing')
        with output.open('xb') as handle:
            handle.write(content)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--output', type=Path, default=ROOT / 'docs/reference/ahri-materials.json')
    args = parser.parse_args()
    content = generate()
    publish(content, args.output, args.check)
    print(json.dumps(dict(result='passed', materials=2, samplers=5, submeshes=4,
                          nativeDefaultsVerified=False, runtimeChanged=False)))
