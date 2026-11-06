"""Strict parameter projection for all 21 original Baron attack emitters."""
from copy import deepcopy
import math
from baron_attack_decode import require
from baron_attack_fields import relabel
from masteryi_w_cast import value as base_value

CURVES = {
    'rate': 0, 'particleLifetime': 3, 'bindWeight': 0, 'uvRotation': 0,
    'birthVelocity': [0, 0, 0], 'birthDrag': [0, 0, 0], 'worldAcceleration': [0, 0, 0],
    'birthRotation0': [0, 0, 0], 'birthRotationalVelocity0': [0, 0, 0],
    'birthScale0': [1, 1, 1], 'scale0': [1, 1, 1], 'EmitterPosition': [0, 0, 0],
    'birthColor': [1, 1, 1, 1], 'Color': [1, 1, 1, 1], 'uvScale': [1, 1],
    'birthUVOffset': [0, 0], 'birthUvScrollRate': [0, 0],
}
SETTINGS = set('particleLinger emitterLinger lifetime isSingleParticle emitterName blendMode pass alphaRef disableBackfaceCull particleIsLocalOrientation isUniformScale miscRenderFlags numFrames texDiv isRandomStartFrame isRotationEnabled isLocalOrientation importance timeBeforeFirstEmission frameRate startFrame isDirectionOriented directionVelocityScale directionVelocityMinScale ParticlesShareRandomValue period timeActiveDuringPeriod isGroundLayer depthBiasFactors'.split())
SPECIAL = set('__type primitive SpawnShape texture textureMult alphaErosionDefinition paletteDefinition Audio emissionMeshName emissionMeshScale FlexShapeDefinition'.split())


def value(raw, fallback, integrated=False):
    dimension = len(fallback) if isinstance(fallback, list) else 1
    types = {1: ('ValueFloat', 'VfxAnimatedFloatVariableData'),
             2: ('ValueVector2', 'VfxAnimatedVector2fVariableData'),
             3: ('ValueVector3', 'VfxAnimatedVector3fVariableData'),
             4: ('ValueColor', 'VfxAnimatedColorVariableData')}
    require(isinstance(raw, (dict, list)), 'Invalid Baron curve container')
    if isinstance(raw, dict):
        allowed = {types[dimension][0]} | ({'IntegratedValueVector3'} if integrated and dimension == 3 else set())
        require(raw.get('__type', types[dimension][0]) in allowed, 'Unexpected Baron value type')
        dynamics = raw.get('dynamics', {})
        require(isinstance(dynamics, dict) and dynamics.get('__type', types[dimension][1]) == types[dimension][1],
                'Unexpected Baron dynamics type')
        require(all(table.get('__type', 'VfxProbabilityTableData') == 'VfxProbabilityTableData'
                    for table in dynamics.get('probabilityTables', [])), 'Unexpected Baron probability type')
    result = base_value(raw, fallback)
    result['sourceType'] = raw.get('__type') if isinstance(raw, dict) else 'literal-vector'
    dynamics = raw.get('dynamics', {}) if isinstance(raw, dict) else {}
    require(('times' in dynamics) == ('values' in dynamics), 'Baron authored curve times/values presence differs')
    result['authoredKeyCount'] = len(dynamics.get('times', []))
    return result


def finite(value):
    if isinstance(value, dict):
        for child in value.values(): finite(child)
    elif isinstance(value, list):
        for child in value: finite(child)
    elif type(value) in (int, float):
        require(math.isfinite(value), 'Nonfinite Baron emitter parameter')


def settings(emitter):
    result = {key: deepcopy(emitter[key]) for key in sorted(SETTINGS) if key in emitter}
    flags = set('isSingleParticle disableBackfaceCull particleIsLocalOrientation isUniformScale isRandomStartFrame isRotationEnabled isLocalOrientation isDirectionOriented ParticlesShareRandomValue isGroundLayer'.split())
    for key, raw in result.items():
        if key == 'emitterName':
            require(isinstance(raw, str), 'Invalid emitter name')
        elif key in ('texDiv', 'depthBiasFactors'):
            require(isinstance(raw, list) and len(raw) == 2 and all(type(v) in (int, float) for v in raw), 'Invalid paired emitter setting')
        elif key in flags:
            require(type(raw) in (bool, int) and raw in (0, 1), 'Invalid emitter flag')
        else:
            require(type(raw) in (int, float), 'Invalid numeric emitter setting')
    return result


def shape(raw):
    kind = raw.get('__type')
    if not raw:
        return dict(kind='point', offset=[0, 0, 0], declared=False)
    if kind == '{ee39916f}':
        require(set(raw) <= {'__type', 'emitOffset'}, 'Unhandled source point field')
        offset = raw.get('emitOffset', [0, 0, 0])
        require(isinstance(offset, list) and len(offset) == 3, 'Invalid source point extent')
        return dict(kind='point', offset=deepcopy(offset), declared=True, sourceType=kind)
    if kind in ('VfxShapeSphere', 'VfxShapeCylinder'):
        allowed = {'__type', 'flags', 'radius'} | ({'height'} if kind.endswith('Cylinder') else set())
        require(set(raw) <= allowed and raw.get('flags', 0) in (0, 1), 'Unhandled source volume-shape field/flags')
        result = dict(kind='cylinder' if kind.endswith('Cylinder') else 'sphere', radius=raw.get('radius', 0),
                      volume=bool(raw.get('flags', 0) & 1), sourceType=kind)
        if kind.endswith('Cylinder'): result['height'] = raw.get('height', 0)
        return result
    require(kind == 'VfxShapeLegacy' and set(raw) <= {'__type', 'emitOffset', 'emitRotationAngles', 'emitRotationAxes'},
            'Unhandled Baron shape type/fields')
    angles, axes = raw.get('emitRotationAngles', []), raw.get('emitRotationAxes', [])
    require(len(angles) == len(axes) and all(len(axis) == 3 for axis in axes), 'Legacy shape angle/axis extent differs')
    return dict(kind='legacy', sourceType=kind, offset=value(raw.get('emitOffset', {}), [0, 0, 0]),
                angles=[value(angle, 0) for angle in angles], axes=deepcopy(axes))


def profiles(source, maps, texture_keys, mesh_keys):
    systems = relabel(source['systems'], maps)
    require(set(systems) == {'missile', 'hit'}, 'Baron system closure differs')
    result, textures_used, meshes_used = [], set(), set()
    def texture(path):
        key = path.lower()
        require(key in texture_keys, 'Missing Baron texture binding: ' + path)
        textures_used.add(key)
        return texture_keys[key]
    def mesh(path):
        key = path.lower()
        require(key in mesh_keys, 'Missing Baron mesh binding: ' + path)
        meshes_used.add(key)
        return mesh_keys[key]
    for role in ('missile', 'hit'):
        emitters = systems[role]['definition']['complexEmitterDefinitionData']
        require(len(emitters) == (9 if role == 'missile' else 12), 'Baron emitter closure differs')
        for index, emitter in enumerate(emitters):
            finite(emitter)
            require(not set(emitter) - (set(CURVES) | SETTINGS | SPECIAL), 'Unhandled Baron emitter field: ' + ','.join(sorted(set(emitter) - (set(CURVES) | SETTINGS | SPECIAL))))
            require(emitter['__type'] == 'VfxEmitterDefinitionData', 'Unexpected Baron emitter type')
            primitive = emitter.get('primitive', {})
            kind = primitive.get('__type')
            geometry = dict(kind='billboard', declared=bool(primitive))
            if kind == 'VfxPrimitiveArbitraryQuad':
                require(set(primitive) == {'__type'}, 'Unhandled arbitrary quad field')
                geometry['kind'] = 'quad'
            elif kind == 'VfxPrimitiveMesh':
                require(set(primitive) == {'__type', 'mMesh'} and set(primitive['mMesh']) == {'__type', 'mSimpleMeshName'} and primitive['mMesh']['__type'] == 'VfxMeshDefinitionData',
                        'Unhandled mesh primitive field')
                geometry = dict(kind='mesh', asset=mesh(primitive['mMesh']['mSimpleMeshName']), declared=True)
            elif kind in ('VfxPrimitiveArbitraryTrail', 'VfxPrimitiveCameraTrail'):
                require(set(primitive) == {'__type', 'mTrail'}, 'Unhandled trail primitive field')
                trail = primitive['mTrail']
                require(set(trail) <= {'__type', 'mBirthTilingSize', 'mMode', 'mCutoff'} and trail['__type'] == 'VfxTrailDefinitionData', 'Unhandled source trail field')
                geometry = dict(kind='camera-trail' if kind == 'VfxPrimitiveCameraTrail' else 'arbitrary-trail', declared=True,
                    mode=trail.get('mMode', 0), smoothing=0, cutoff=trail.get('mCutoff', 0),
                    tiling=value(trail.get('mBirthTilingSize', {}), [0, 0, 0]))
            else:
                require(not primitive, 'Unhandled Baron primitive type')
            curves = {key: value(emitter[key], fallback, integrated=(key == 'worldAcceleration'))
                      for key, fallback in CURVES.items() if key in emitter}
            material = dict(texture=texture(emitter['texture']))
            if 'textureMult' in emitter:
                mult = emitter['textureMult']
                require(set(mult) <= {'__type', 'textureMult', 'birthUvScrollRateMult', 'birthUVOffsetMult'} and mult['__type'] == 'VfxTextureMultDefinitionData', 'Unhandled multiplier field')
                material['multiplier'] = dict(texture=texture(mult['textureMult']),
                    scroll=value(mult.get('birthUvScrollRateMult', {}), [0, 0]), offset=value(mult.get('birthUVOffsetMult', {}), [0, 0]))
            if 'alphaErosionDefinition' in emitter:
                erosion = emitter['alphaErosionDefinition']
                require(set(erosion) == {'__type', 'erosionMapName', 'erosionMapChannelMixer', 'erosionDriveCurve'} and erosion['__type'] == 'VfxAlphaErosionDefinitionData', 'Unhandled erosion field')
                material['erosion'] = dict(texture=texture(erosion['erosionMapName']),
                    mixer=value(erosion['erosionMapChannelMixer'], [0, 0, 0, 1]), drive=value(erosion['erosionDriveCurve'], 1))
            if 'paletteDefinition' in emitter:
                palette = emitter['paletteDefinition']
                require(set(palette) == {'__type', 'paletteCount', 'paletteTexture'} and palette['__type'] == 'VfxPaletteDefinitionData', 'Unhandled palette field')
                material['palette'] = dict(texture=texture(palette['paletteTexture']), count=palette['paletteCount'])
            audio = emitter.get('Audio')
            require(audio is None or audio == {'__type': 'VfxEmitterAudio'}, 'Unhandled Baron emitter audio')
            flex = emitter.get('FlexShapeDefinition')
            require(flex is None or (set(flex) <= {'__type', 'scaleBirthScaleByBoundObjectSize', 'scaleEmitOffsetByBoundObjectSize'} and flex['__type'] == 'VfxFlexShapeDefinitionData'),
                    'Unhandled bound-size shape field')
            emission = None
            if 'emissionMeshName' in emitter:
                emission = dict(asset=mesh(emitter['emissionMeshName']), scale=emitter.get('emissionMeshScale', 1), useNormal=True)
            require('emissionMeshScale' not in emitter or emission is not None, 'Orphan emission mesh scale')
            result.append(dict(role=role, index=index, name=emitter['emitterName'], geometry=geometry,
                shape=shape(emitter.get('SpawnShape', {})), curves=curves, material=material,
                emissionMesh=emission, flex=deepcopy(flex), audio=deepcopy(audio),
                settings=settings(emitter),
                explicitFields=sorted(emitter)))
    require(textures_used == set(texture_keys) and meshes_used == set(mesh_keys), 'Unused/missing Baron asset closure')
    return result
