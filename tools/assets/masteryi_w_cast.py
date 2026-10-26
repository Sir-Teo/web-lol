"""Compile all seven Meditate cast emitters with explicit source/default policies."""
import math
from masteryi_w_particles import require

SYSTEM = 'MasterYi_W_Cas'
ALLOWED = set('rate particleLifetime particleLinger lifetime isSingleParticle emitterName EmitterPosition primitive blendMode Color pass birthRotation0 birthScale0 scale0 texture __type birthVelocity bindWeight SpawnShape particleColorTexture disableBackfaceCull birthRotationalVelocity0 birthUvScrollRate uvMode birthUVOffset textureMult meshRenderFlags colorLookUpTypeY isUniformScale emitterLinger fieldCollectionDefinition'.split())


def value(raw, fallback):
    if isinstance(raw, list): raw = {'constantValue': raw}
    require(not set(raw) - {'constantValue', 'dynamics', '__type'}, 'Unsupported Meditate value field')
    def vector(x): return x if isinstance(x, list) else [x]
    base = vector(raw.get('constantValue', fallback)); dimension = len(vector(fallback))
    dynamic = raw.get('dynamics', {})
    require(not set(dynamic) - {'times', 'values', 'probabilityTables', '__type'}, 'Unsupported Meditate value dynamics')
    times = dynamic.get('times', [0]); values = [vector(x) for x in dynamic.get('values', [base])]
    require(len(times) == len(values) > 0 and all(a <= b for a, b in zip(times, times[1:])), 'Meditate curve extent/order differs')
    require(all(type(t) in (int, float) and math.isfinite(t) for t in times) and
            all(len(v) == dimension and all(type(x) in (int, float) and math.isfinite(x) for x in v) for v in [base, *values]), 'Meditate value dimension/number differs')
    probabilities = []
    for table in dynamic.get('probabilityTables', []):
        require(not set(table) - {'keyTimes', 'keyValues', 'singleValue', '__type'}, 'Unsupported Meditate probability field')
        t, v = table.get('keyTimes', []), table.get('keyValues', [])
        require(len(t) == len(v) and all(a <= b for a, b in zip(t, t[1:])) and
                all(type(x) in (int, float) and math.isfinite(x) for x in [*t, *v, table.get('singleValue', 1)]), 'Meditate probability extent/number differs')
        probabilities.append({'times': t, 'values': v, 'single': table.get('singleValue', 1)})
    require(len(probabilities) <= dimension, 'Meditate probability dimensions differ')
    return {'constant': base, 'times': times, 'values': values, 'probabilities': probabilities}


def uv(raw, mult=False):
    suffix = 'Mult' if mult else ''
    if mult: require(not set(raw) - {'textureMult', 'birthUvScrollRateMult', '__type'}, 'Unhandled Meditate multiplier field')
    return {'scale': value({}, [1, 1]), 'offset': value(raw.get('birthUVOffset'+suffix, {}), [0, 0]),
            'birthScroll': value(raw.get('birthUvScrollRate'+suffix, {}), [0, 0]),
            'scroll': value({}, [0, 0]), 'clamp': False, 'address': 0,
            'divisions': [1, 1], 'frames': 1, 'randomStart': False}


def binhash(name):
    result = 0x811c9dc5
    for byte in name.lower().encode('ascii'): result = ((result ^ byte) * 0x01000193) & 0xffffffff
    return '{%08x}' % result


def acceleration(fields):
    if not fields: return value({}, [0, 0, 0])
    names = {'fieldAccelerationDefinitions': '{5d60e987}', 'VfxFieldAccelerationDefinitionData': '{0a94f3d4}', 'acceleration': '{2fa0ba9d}'}
    require(all(binhash(name) == hashed for name, hashed in names.items()), 'Meditate field candidate hash differs')
    require(set(fields) == {'{5d60e987}', 'fieldOrbitalDefinitions', '__type'} and
            fields['__type'] == 'VfxFieldCollectionDefinitionData', 'Unhandled Meditate field collection')
    require(fields['fieldOrbitalDefinitions'] == [{'isLocalSpace': False, '__type': 'VfxFieldOrbitalDefinitionData'}], 'Unhandled Meditate orbital field')
    require(len(fields['{5d60e987}']) == 1, 'Meditate acceleration closure differs')
    field = fields['{5d60e987}'][0]
    require(set(field) == {'isLocalSpace', '{2fa0ba9d}', '__type'} and field['isLocalSpace'] is False and
            field['__type'] == '{0a94f3d4}', 'Unhandled Meditate acceleration field')
    return value(field['{2fa0ba9d}'], [0, 0, 0])


def profiles(pin, textures, mesh_url, defaults):
    definitions = pin['resources'][SYSTEM]['definition']['complexEmitterDefinitionData']
    require(len(definitions) == 7, 'Meditate cast emitter closure differs')
    out = []
    for index, e in enumerate(definitions):
        require(not set(e) - ALLOWED, 'Unhandled Meditate cast emitter field')
        primitive = e.get('primitive', {}); kind = primitive.get('__type', 'billboard')
        require(kind in ('billboard', 'VfxPrimitiveMesh', 'VfxPrimitiveRay', 'VfxPrimitiveArbitraryQuad'), 'Unhandled Meditate cast primitive')
        if kind == 'VfxPrimitiveMesh':
            require(primitive == {'mMesh': {'mSimpleMeshName': 'ASSETS/Characters/MasterYi/Skins/Base/Particles/common_Vlad_BloodKing_Torus.scb', '__type': 'VfxMeshDefinitionData'}, '__type': 'VfxPrimitiveMesh'}, 'Meditate cast mesh differs')
        else: require(not set(primitive) - {'__type'}, 'Unhandled Meditate primitive field')
        shape = e.get('SpawnShape', {})
        require(not set(shape) - {'emitOffset', '__type'} and shape.get('__type', '{ee39916f}') in ('{ee39916f}', 'VfxShapeLegacy'), 'Unhandled Meditate cast shape')
        mult = e.get('textureMult')
        require(e.get('blendMode', 0) in (0, 4) and e.get('meshRenderFlags', 0) == 0 and e.get('uvMode', 0) in (0, 2), 'Unhandled Meditate cast render mode')
        p = {'system': SYSTEM, 'role': 'cast', 'index': index, 'name': e['emitterName'],
             'kind': {'billboard': 'billboard', 'VfxPrimitiveMesh': 'mesh', 'VfxPrimitiveRay': 'ray', 'VfxPrimitiveArbitraryQuad': 'quad'}[kind],
             'mesh': mesh_url if kind == 'VfxPrimitiveMesh' else None,
             'texture': textures[e['texture'].lower()], 'lookup': textures[e['particleColorTexture'].lower()] if 'particleColorTexture' in e else None,
             'rate': value(e['rate'], 0), 'single': bool(e.get('isSingleParticle', False)), 'delay': 0,
             'emitterLife': e['lifetime'], 'emitterLinger': e.get('emitterLinger'), 'linger': e.get('particleLinger'),
             'life': value(e['particleLifetime'], 3), 'bind': value(e.get('bindWeight', {}), 0),
             'position': value(e.get('EmitterPosition', {}), [0, 0, 0]),
             'shape': {'kind': 'legacy' if shape.get('__type') == 'VfxShapeLegacy' else 'point', 'offset': value(shape.get('emitOffset', {}), [0, 0, 0])},
             'velocity': value(e.get('birthVelocity', {}), [0, 0, 0]), 'worldAcceleration': acceleration(e.get('fieldCollectionDefinition')),
             'rotation': value(e.get('birthRotation0', {}), [0, 0, 0]), 'spin': value(e.get('birthRotationalVelocity0', {}), [0, 0, 0]),
             'size': value(e.get('birthScale0', {}), defaults['birthScale']), 'scale': value(e.get('scale0', {}), defaults['scale']),
             'uniform': bool(e.get('isUniformScale', False)), 'birthColor': value({}, defaults['color']), 'color': value(e.get('Color', {}), defaults['color']),
             'uv': uv(e), 'uvMode': e.get('uvMode', 0),
             'multiplier': {'texture': textures[mult['textureMult'].lower()], 'uv': uv(mult, True)} if mult else None,
             'lookupTypes': [defaults['lookupTypes'][0], e.get('colorLookUpTypeY', defaults['lookupTypes'][1])],
             'lookupScales': defaults['lookupScales'], 'lookupOffsets': defaults['lookupOffsets'],
             'local': True, 'particleLocal': False, 'directionOriented': False, 'directionVelocityScale': 0,
             'ground': False, 'navmesh': False, 'blend': e.get('blendMode', 0), 'renderOrder': e.get('pass', 0),
             'miscRenderFlags': 0, 'meshRenderFlags': e.get('meshRenderFlags', 0), 'noCull': bool(e.get('disableBackfaceCull', False)),
             'depthBias': [0, 0], 'alphaRef': 5 / 255, 'erosion': None, 'distortion': None, 'soft': None, 'palette': None,
             'explicitFields': sorted(e)}
        require(p['rate']['times'] == [0] and len(p['rate']['values']) == 1, 'Unsupported Meditate animated rate')
        out.append(p)
    return out
