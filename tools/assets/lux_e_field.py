"""Export continuous E field geometry and animated material values without flattening emitter-age values."""
import json
from pathlib import Path


def variable(v, default):
    if isinstance(v, list):
        v = {'constantValue': v}
    d = v.get('dynamics', {})
    values = d.get('values', [v.get('constantValue', default)])
    times = d.get('times', [0])
    assert len(times) == len(values)
    assert all(a <= b for a,b in zip(times,times[1:])) or all(x == values[0] for x in values), times
    return dict(times=times, values=[x if isinstance(x, list) else [x] for x in values],
        probabilities=[dict(times=t.get('keyTimes', []), values=t.get('keyValues', []), single=t.get('singleValue', 1))
                       for t in d['probabilityTables']] if 'probabilityTables' in d else None)


def base_filter(e):
    f=e.get('{f50b1a41}',{})
    if not f: return None
    assert f['__type']=='{f4e37e07}'
    assert set(f)<={'__type','{14435bb0}','{c178fac7}','{47cc1fe9}'}
    required=f.get('{14435bb0}',[]); excluded=f.get('{c178fac7}',[]); included=f.get('{47cc1fe9}',[])
    return dict(required=required,excluded=excluded,included=included,keywords=[],enabled=not required and not included)


def export_field(pin, textures, inventory):
    result = []
    for role, record, indices in [('ally', 'Lux_E_tar_aoe_green', [5, 6]), ('enemy', 'Lux_E_tar_aoe_red', [11, 15]),
       ('ally','Lux_E_tar_aoe_green',[9,12,13,14,15,24]),('enemy','Lux_E_tar_aoe_red',[0,1,2,3,14]),
       ('flight','Lux_E_mis',[5,7,9]),('ally','Lux_E_tar_aoe_green',[20,22])]:
        for index in indices:
            e = pin['definitions'][record]['complexEmitterDefinitionData'][index]
            allowed = set('rate particleLifetime particleLinger lifetime emitterName importance birthVelocity bindWeight SpawnShape EmitterPosition particleColorTexture birthColor Color colorLookUpTypeY miscRenderFlags isDirectionOriented isUniformScale isGroundLayer birthRotation0 birthRotationalVelocity0 isLocalOrientation directionVelocityScale birthScale0 scale0 texture __type birthOrbitalVelocity birthDrag pass isRandomStartFrame numFrames paletteDefinition texDiv primitive blendMode alphaRef isSingleParticle isRotationEnabled {712b01bd} uvRotation textureMult FlexShapeDefinition worldAcceleration disableBackfaceCull'.split())
            assert set(e) <= allowed, set(e)-allowed
            primitive=e.get('primitive',{}).get('__type','camera')
            assert not e.get('bindWeight',{}).get('dynamics'), 'Moving attachment currently requires constant bind weight'
            if primitive=='VfxPrimitiveMesh':
                assert e['primitive']['mMesh']['mSimpleMeshName'].lower()=='assets/characters/lux/skins/base/particles/lux_base_slash.scb'
                assert e.get('disableBackfaceCull') is True
            assert primitive in ['camera','VfxPrimitiveArbitraryQuad','VfxPrimitiveRay','VfxPrimitiveMesh']
            assert e.get('alphaRef',0)==0 and not e.get('uvRotation',{}).get('dynamics')
            shape=e.get('SpawnShape',{})
            assert shape.get('__type','') in ['','VfxShapeLegacy','{ee39916f}','{3dbe415d}']
            mult=e.get('textureMult',{})
            assert set(mult) <= {'textureMult','{cd124686}','{22c3cf3e}','birthUVOffsetMult','__type'}
            assert set(shape) <= {'emitOffset', 'emitRotationAxes', 'emitRotationAngles', 'flags','radius','__type'}
            sphere=shape.get('__type')=='{3dbe415d}'
            if sphere: assert shape['flags']==1 and shape['radius']==40
            flex=e.get('FlexShapeDefinition',{})
            if flex: assert set(flex)=={'scaleEmitOffsetByBoundObjectSize','__type'} and flex['__type']=='VfxFlexShapeDefinitionData'
            palette=e.get('paletteDefinition')
            if palette:
                assert not palette['paletteSelector'].get('dynamics') and not palette['palleteSrcMixColor'].get('dynamics')
            result.append(dict(role=role, record=record, index=index, name=e['emitterName'],
                rate=variable(e['rate'],0), emitterLife=e['lifetime'], single=bool(e.get('isSingleParticle')),
                primitive={'camera':'camera','VfxPrimitiveArbitraryQuad':'quad','VfxPrimitiveRay':'ray','VfxPrimitiveMesh':'mesh'}[primitive],
                mesh='assets/models/lux-e-slash.glb' if primitive=='VfxPrimitiveMesh' else '',
                sphereRadius=shape.get('radius',0) if sphere else 0, sphereFlags=shape.get('flags') if sphere else None,
                flexBoundSizeScaler=flex.get('scaleEmitOffsetByBoundObjectSize'),
                bind=variable(e.get('bindWeight',{}),0), worldAcceleration=variable(e.get('worldAcceleration',{}),[0,0,0]),
                rotationRate=variable(e.get('{712b01bd}',{}),[0,0,0]), uvRotation=e.get('uvRotation',{}).get('constantValue',0),
                mult=textures[mult['textureMult'].lower()] if mult else '',
                multScale=variable(mult.get('{cd124686}',{}),[1,1]),
                multOffset=variable(mult.get('birthUVOffsetMult',{}),[0,0]),
                multScroll=variable(mult.get('{22c3cf3e}',{}),[0,0]),
                life=variable(e['particleLifetime'],1), size=variable(e['birthScale0'],[1,1,1]),
                velocity=variable(e.get('birthVelocity',{}),[0,0,0]), drag=variable(e.get('birthDrag',{}),[0,0,0]),
                orbit=variable(e.get('birthOrbitalVelocity',{}),[0,0,0]),
                offset=variable(shape.get('emitOffset',{}),[0,0,0]),
                position=variable(e.get('EmitterPosition',{}),[0,0,0]),
                shapeAngles=[variable(a,0) for a in shape.get('emitRotationAngles',[])], shapeAxes=shape.get('emitRotationAxes',[]),
                rotation=variable(e.get('birthRotation0',{}),[0,0,0]), angular=variable(e.get('birthRotationalVelocity0',{}),[0,0,0]),
                birthColor=variable(e.get('birthColor',{}),[1,1,1,1]), color=variable(e.get('Color',{}),[1,1,1,1]),
                scale=variable(e.get('scale0',{}),[1,1,1]), uniform=bool(e.get('isUniformScale')),
                ground=bool(e.get('isGroundLayer')), local=bool(e.get('isLocalOrientation',True)),
                direction=bool(e.get('isDirectionOriented')), directionScale=e.get('directionVelocityScale',0), directionMin=e.get('directionVelocityMinScale',1),
                passOrder=e.get('pass',0), blend=e.get('blendMode',0), depthTest=(e.get('miscRenderFlags',0)&1)==0,
                texture=textures[e['texture'].lower()],lookup=textures[e['particleColorTexture'].lower()] if e.get('particleColorTexture') else '',
                lookupTypes=[e.get('colorLookUpTypeX',1),e.get('colorLookUpTypeY',0)],lookupScales=e.get('colorLookUpScales',[1,1]),lookupOffsets=e.get('colorLookUpOffsets',[0,0]),
                atlas=dict(grid=e.get('texDiv',[1,1]),frames=e.get('numFrames',1),random=bool(e.get('isRandomStartFrame'))),
                palette=dict(texture=textures[palette['paletteTexture'].lower()],mix=palette['palleteSrcMixColor']['constantValue'],row=(palette['paletteSelector']['constantValue'][0]+0.5)/palette['paletteCount']) if palette else None,
                sourceParticleLinger=e.get('particleLinger')))
            item=next(x for x in inventory if x['record']==record and x['index']==index)
            item.update(status='rendered field motion batch',reason=None)
    out=Path('src/content/lux-e-field.json')
    out.write_text(json.dumps(result,indent=2)+'\n')
    return result,out
