"""Compile the two complete native Q target systems and verified delivery assets.

Source fields, pinned-reader defaults and local contact/attachment policy remain
separate. The empty Q_Hit record does not gain an invented emitter.
"""
from pathlib import Path
import argparse
import importlib.util
import json
import math
from masteryi_q_particles import SOURCE_ROOT, checked, load, require
from masteryi_q_decode import sha

TRANSPORT = Path('docs/reference/masteryi/q-contact-texture-transport.json')
TRANSPORT_SHA256 = '2851d25d5639cab3476a0161862fb96ba4296f6a6f4af82ede6beb1aebfcd687'


def json_bytes(value): return (json.dumps(value, indent=2, allow_nan=False) + '\n').encode()


def birth(value, fallback):
    if isinstance(value, list): value = {'constantValue': value}
    require(not set(value) - {'constantValue', 'dynamics', '__type'}, 'Unsupported birth field')
    dynamics = value.get('dynamics')
    if dynamics:
        require(not set(dynamics) - {'times', 'values', 'probabilityTables', '__type'}, 'Unsupported birth dynamics')
        require(dynamics['times'] == [0] and len(dynamics['values']) == 1, 'Unsupported animated birth')
    result = dynamics['values'][0] if dynamics else value.get('constantValue', fallback)
    tables = []
    for table in dynamics.get('probabilityTables', []) if dynamics else []:
        require(not set(table) - {'keyTimes', 'keyValues', 'singleValue', '__type'}, 'Unsupported probability field')
        times, values = table.get('keyTimes', []), table.get('keyValues', [])
        require(len(times) == len(values), 'Probability table extent differs')
        tables.append({'times': times, 'values': values, 'single': table.get('singleValue', 1)})
    return {'value': result if isinstance(result, list) else [result], 'probabilities': tables or None}


def curve(value, fallback):
    require(not set(value) - {'constantValue', 'dynamics', '__type'}, 'Unsupported curve field')
    dynamics = value.get('dynamics')
    if not dynamics: return {'times': [0], 'values': [value.get('constantValue', fallback)]}
    require(not set(dynamics) - {'times', 'values', 'probabilityTables', '__type'}, 'Unsupported curve dynamics')
    require(len(dynamics['times']) == len(dynamics['values']) > 0, 'Curve extent differs')
    for table in dynamics.get('probabilityTables', []):
        require(not set(table) - {'__type'} or table == {'singleValue': 1, '__type': 'VfxProbabilityTableData'}, 'Unsupported curve probability')
    return {'times': dynamics['times'], 'values': dynamics['values']}


def build():
    pin, _ = load()
    raw = checked(TRANSPORT, TRANSPORT_SHA256); transport = json.loads(raw)
    spec = importlib.util.spec_from_file_location('contact_transport', Path(__file__).with_name('pack-masteryi-q-contact-textures.py'))
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    module.verify(transport, SOURCE_ROOT)
    require(Path('.cache/masteryi-q-contact-packed-v2/textures.json').read_bytes() == raw, 'Staged texture record differs')
    defaults_path = Path('docs/reference/garen-spin-defaults.json')
    defaults_raw = checked(defaults_path, '51aaa77125b84ae77e05586d31c7e45de3037028345222a0addd1ed188debefb'); defaults = json.loads(defaults_raw)['defaults']
    require(defaults['birthScale'] == [1, 1, 1] and defaults['scale'] == [1, 1, 1]
            and defaults['color'] == [1, 1, 1, 1], 'Reader defaults differ')
    textures = {}; assets = []; outputs = []
    for row in transport['textures']:
        source = row['source']; key = source['wadPathHash']; textures[source['path']] = key
        url = f'assets/effects/masteryi-q-contact-{key}.png'
        png = checked(row['path'], row['sha256'], row['bytes'])
        assets.append({**row, 'key': key, 'url': url})
        outputs.append((Path('public') / url, png, True))
    mesh_record = Path('.cache/masteryi-q-contact-packed-v2/masteryi-q-contact-trail.glb.json')
    mesh = json.loads(checked(mesh_record, 'f3aa1adfb0834c7c0e8c1c40ba32b9e6fac50a0480209227ad20d56190000acf')); out = mesh['output']
    require(out['sha256'] == '11e8d520c3ba72a1e301d1ab7ecaad4ac0f0c2e4b426d46948185fc6891f2192' and out['bytes'] == 112976, 'Contact GLB identity differs')
    require(mesh['source']['sha256'] == 'dff8b7119ea6e2ae3d215aa42afe13b13a47d964a7f8b62a67a28aead5357ccf'
            and mesh['validation'] == {'errors': 0, 'warnings': 0, 'roundTripAttributesExact': True}
            and mesh['sourceHasVertexColors'] is False and mesh['sourceFaceRgbAppliedAsMaterial'] is False
            and mesh['normalsGenerated'] is False, 'Contact mesh provenance differs')
    mesh_url = 'assets/models/masteryi-q-contact-trail.glb'
    outputs.append((Path('public') / mesh_url, checked(out['path'], out['sha256'], out['bytes']), True))
    allowed = set('rate particleLifetime lifetime isSingleParticle emitterLinger particleLinger emitterName bindWeight EmitterPosition '
        'particleColorTexture pass miscRenderFlags birthRotation0 birthScale0 scale0 texture __type FlexShapeDefinition primitive '
        'blendMode disableBackfaceCull birthRotationalVelocity0 birthUvScrollRate SpawnShape meshRenderFlags isUniformScale'.split())
    profiles = []
    for system in module.SYSTEMS:
        for index, e in enumerate(pin['resources'][system]['definition']['complexEmitterDefinitionData']):
            require(not set(e) - allowed, 'Unhandled target emitter field')
            primitive = e.get('primitive', {})
            require(not primitive or primitive == {'mMesh': {'mSimpleMeshName':
                'ASSETS/Characters/MasterYi/Skins/Base/Particles/common_Hecarim_QTrail.scb', '__type': 'VfxMeshDefinitionData'}, '__type': 'VfxPrimitiveMesh'}, 'Unsupported primitive')
            shape = e.get('SpawnShape', {})
            require(not set(shape) - {'emitOffset', '__type'} and shape.get('__type', '{ee39916f}') == '{ee39916f}', 'Unsupported spawn shape')
            flex = e.get('FlexShapeDefinition', {})
            require(not set(flex) - {'scaleBirthScaleByBoundObjectSize', 'scaleEmitOffsetByBoundObjectSize', '__type'}, 'Unsupported bound-size field')
            profiles.append({'system': system, 'index': index, 'name': e['emitterName'], 'critical': system == 'MasterYi_Q_Crit_tar',
                'kind': 'mesh' if primitive else 'billboard', 'texture': textures[e['texture'].lower()],
                'lookup': textures[e['particleColorTexture'].lower()], 'rate': e['rate']['constantValue'],
                'single': bool(e.get('isSingleParticle', False)), 'emitterLife': e['lifetime'],
                'emitterLinger': e.get('emitterLinger'), 'particleLinger': e.get('particleLinger'),
                'life': birth(e['particleLifetime'], 3), 'position': birth(e.get('EmitterPosition', {}), [0, 0, 0]),
                'spawnOffset': birth(shape.get('emitOffset', {}), [0, 0, 0]),
                'size': birth(e.get('birthScale0', {}), defaults['birthScale']),
                'rotation': birth(e.get('birthRotation0', {}), [0, 0, 0]),
                'angularVelocity': birth(e.get('birthRotationalVelocity0', {}), [0, 0, 0]),
                'scroll': birth(e.get('birthUvScrollRate', {}), [0, 0]),
                'scale': curve(e.get('scale0', {}), defaults['scale']), 'color': {'times': [0], 'values': [defaults['color']]},
                'bindWeight': e.get('bindWeight', {}).get('constantValue', 0), 'uniform': bool(e.get('isUniformScale', False)),
                'boundSize': flex.get('scaleBirthScaleByBoundObjectSize'), 'boundOffset': flex.get('scaleEmitOffsetByBoundObjectSize'),
                'lookupTypes': defaults['lookupTypes'], 'lookupScales': defaults['lookupScales'], 'lookupOffsets': defaults['lookupOffsets'],
                'blend': e.get('blendMode', 0), 'renderOrder': e.get('pass', 0),
                'miscRenderFlags': e.get('miscRenderFlags', 0), 'meshRenderFlags': e.get('meshRenderFlags'),
                'doubleSided': bool(e.get('disableBackfaceCull', False)), 'explicitFields': sorted(e)})
    require(len(profiles) == 7, 'Target emitter closure differs')
    def endpoint(p):
        count = 1 if p['single'] else max(1, math.floor(math.floor(p['emitterLife'] * 60) * p['rate'] / 60))
        return (1 if count == 1 else math.ceil(count * 60 / p['rate'])) + math.ceil(p['life']['value'][0] * 60) + 1
    retention = max(map(endpoint, profiles)); require(retention == 22, 'Contact history grid differs')
    content = {'textures': assets, 'mesh': {'url': mesh_url, 'sha256': out['sha256'], 'bytes': out['bytes']}, 'profiles': profiles}
    outputs.append((Path('src/content/masteryi-q-contact-particles.json'), json_bytes(content), False))
    reading = {'format': 1, 'sourcePinSha256': sha(Path('docs/reference/masteryi/q-particles.json').read_bytes()),
        'transport': {'path': str(TRANSPORT), 'sha256': TRANSPORT_SHA256}, 'mesh': mesh,
        'readerDefaults': {'path': str(defaults_path), 'sha256': sha(defaults_raw)},
        'profileSha256': sha(json_bytes(content)), 'historyTicks': retention,
        'limits': ['Native target systems retained completely: ordinary four emitters and critical three.',
            'Local accepted-contact dispatch, first-update timing, indexed cosmetic randomness, root attachment, collision-diameter bound-size reading and captured source-to-target heading are not native callback/frame certificates.',
            'Omitted fields stay visible through explicitFields and full source pin; compiled fallbacks are pinned-reader/local rendering policy.',
            'Particle/emitter linger values are retained, not invented visible lifespan extensions. Empty Q_Hit and Q_AP_Mis/cast/missile/end systems are not dispatched here.']}
    outputs.append((Path('docs/reference/masteryi/q-contact-particle-reading.json'), json_bytes(reading), False))
    return outputs, content


def main():
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--check', action='store_true'); args = parser.parse_args()
    outputs, content = build()
    for path, raw, immutable in outputs:
        if args.check or (immutable and path.exists()): require(path.read_bytes() == raw, 'Output differs: ' + str(path))
    if not args.check:
        for path, raw, _ in outputs:
            if not path.exists() or path.read_bytes() != raw:
                path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(raw)
    print(json.dumps({'profiles': len(content['profiles']), 'textures': len(content['textures']), 'meshes': 1,
                      'historyTicks': 22, 'mode': 'check' if args.check else 'export'}))


if __name__ == '__main__': main()
