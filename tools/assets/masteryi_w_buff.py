"""Complete four-emitter Meditate buff projection; raw source defaults stay distinct."""
from masteryi_w_cast import value, uv, ALLOWED as CAST_ALLOWED
from masteryi_w_particles import require
ALLOWED = CAST_ALLOWED | set('birthColor startFrame texDiv numFrames isRandomStartFrame isLocalOrientation birthOrbitalVelocity colorLookUpScales'.split())

def layer(raw, mult=False):
    result=uv(raw,mult)
    result.update(divisions=raw.get('texDiv',[1,1]),frames=raw.get('numFrames',1),randomStart=bool(raw.get('isRandomStartFrame',False)),startFrame=raw.get('startFrame',0))
    require(len(result['divisions'])==2 and all(type(x)in(int,float) and x>=1 and int(x)==x for x in result['divisions']), 'Unsupported buff atlas divisions')
    require(1<=result['frames']<=result['divisions'][0]*result['divisions'][1] and 0<=result['startFrame']<result['divisions'][0]*result['divisions'][1], 'Unsupported buff atlas frames')
    return result

def attraction(fields):
    if not fields:return None
    require(set(fields)=={'{c3e452a8}','fieldOrbitalDefinitions','__type'} and fields['__type']=='VfxFieldCollectionDefinitionData','Unhandled buff field collection')
    require(fields['fieldOrbitalDefinitions']==[{'isLocalSpace':False,'__type':'VfxFieldOrbitalDefinitionData'}],'Unhandled buff orbital field')
    require(len(fields['{c3e452a8}'])==1,'Buff attraction closure differs')
    field=fields['{c3e452a8}'][0]
    require(set(field)=={'Position','radius','{2fa0ba9d}','__type'} and field['__type']=='{1a7617fd}','Unhandled buff attraction field')
    return {'position':value(field['Position'],[0,0,0]),'radius':value(field['radius'],0),'strength':value(field['{2fa0ba9d}'],0)}

def profiles(pin, textures, mesh_url, defaults):
    definitions = pin['resources']['MasterYi_W_Buf']['definition']['complexEmitterDefinitionData']
    require(len(definitions) == 4, 'Meditate buff emitter closure differs')
    out = []
    for index, e in enumerate(definitions):
        require(not set(e) - ALLOWED, 'Unhandled Meditate buff emitter field')
        primitive = e.get('primitive', {}); kind = primitive.get('__type', 'billboard')
        require(kind in ('billboard', 'VfxPrimitiveMesh', 'VfxPrimitiveRay', 'VfxPrimitiveArbitraryQuad'), 'Unhandled Meditate buff primitive')
        if kind == 'VfxPrimitiveMesh':
            require(primitive == {'mMesh': {'mSimpleMeshName': 'ASSETS/Characters/MasterYi/Skins/Base/Particles/MasterYi_Base_W_Heal_Mesh.scb', '__type': 'VfxMeshDefinitionData'}, '__type': 'VfxPrimitiveMesh'}, 'Meditate buff mesh differs')
        else: require(not set(primitive) - {'__type'}, 'Unhandled Meditate primitive field')
        shape = e.get('SpawnShape', {})
        require(not set(shape) - {'emitOffset', 'emitRotationAngles', 'emitRotationAxes', '__type'} and shape.get('__type', '{ee39916f}') in ('{ee39916f}', 'VfxShapeLegacy'), 'Unhandled Meditate buff shape')
        mult = e.get('textureMult')
        require(e.get('blendMode', 0) in (0, 4) and e.get('meshRenderFlags', 0) == 0 and e.get('uvMode', 0) in (0, 2), 'Unhandled Meditate buff render mode')
        p = {'system': 'MasterYi_W_Buf', 'role': 'buff', 'index': index, 'name': e['emitterName'],
             'kind': {'billboard': 'billboard', 'VfxPrimitiveMesh': 'mesh', 'VfxPrimitiveRay': 'ray', 'VfxPrimitiveArbitraryQuad': 'quad'}[kind],
             'mesh': mesh_url if kind == 'VfxPrimitiveMesh' else None,
             'texture': textures[e['texture'].lower()], 'lookup': textures[e['particleColorTexture'].lower()] if 'particleColorTexture' in e else None,
             'rate': value(e['rate'], 0), 'single': bool(e.get('isSingleParticle', False)), 'delay': 0,
             'emitterLife': e['lifetime'], 'emitterLinger': e.get('emitterLinger'), 'linger': e.get('particleLinger'),
             'life': value(e['particleLifetime'], 3), 'bind': value(e.get('bindWeight', {}), 0),
             'position': value(e.get('EmitterPosition', {}), [0, 0, 0]),
             'shape': {'kind': 'legacy' if shape.get('__type') == 'VfxShapeLegacy' else 'point', 'offset': value(shape.get('emitOffset', {}), [0, 0, 0]), 'angles': [value(a, 0) for a in shape.get('emitRotationAngles', [])], 'axes': shape.get('emitRotationAxes', [])},
             'velocity': value(e.get('birthVelocity', {}), [0, 0, 0]), 'worldAcceleration': value({}, [0,0,0]), 'attraction': attraction(e.get('fieldCollectionDefinition')),
             'orbitalField': {'axis': [0, 1, 0], 'localSpace': False, 'directionAuthored': False} if e.get('fieldCollectionDefinition') else None,
             'orbitalVelocity': value(e.get('birthOrbitalVelocity', {}), [0,0,0]), 'rotation': value(e.get('birthRotation0', {}), [0, 0, 0]), 'spin': value(e.get('birthRotationalVelocity0', {}), [0, 0, 0]),
             'size': value(e.get('birthScale0', {}), defaults['birthScale']), 'scale': value(e.get('scale0', {}), defaults['scale']),
             'uniform': bool(e.get('isUniformScale', False)), 'birthColor': value(e.get('birthColor', {}), defaults['color']), 'color': value(e.get('Color', {}), defaults['color']),
             'uv': layer(e), 'uvMode': e.get('uvMode', 0),
             'multiplier': {'texture': textures[mult['textureMult'].lower()], 'uv': layer(mult, True)} if mult else None,
             'lookupTypes': [defaults['lookupTypes'][0], e.get('colorLookUpTypeY', defaults['lookupTypes'][1])],
             'lookupScales': e.get('colorLookUpScales', defaults['lookupScales']), 'lookupOffsets': defaults['lookupOffsets'],
             'local': bool(e.get('isLocalOrientation', True)), 'particleLocal': False, 'directionOriented': False, 'directionVelocityScale': 0,
             'ground': False, 'navmesh': False, 'blend': e.get('blendMode', 0), 'renderOrder': e.get('pass', 0),
             'miscRenderFlags': 0, 'meshRenderFlags': e.get('meshRenderFlags', 0), 'noCull': bool(e.get('disableBackfaceCull', False)),
             'depthBias': [0, 0], 'alphaRef': 5 / 255, 'erosion': None, 'distortion': None, 'soft': None, 'palette': None,
             'explicitFields': sorted(e)}
        require(p['rate']['times'] == [0] and len(p['rate']['values']) == 1, 'Unsupported Meditate animated rate')
        require(len(p['shape']['angles'])==len(p['shape']['axes']), 'Buff spawn rotation extent differs')
        out.append(p)
    return out
