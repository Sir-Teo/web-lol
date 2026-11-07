"""Complete authored E profile projection; unresolved runtime bindings stay explicit."""
from copy import deepcopy
import math
from ahri_e_particles import require
from ahri_q_projectile import value, DEFAULTS as Q_DEFAULTS

SYSTEMS = {'Ahri_E_buf': ('buff', 4), 'Ahri_E_cas': ('cast', 4),
           'Ahri_E_mis': ('flight', 12), 'Ahri_E_tar': ('hit', 6),
           '{44fc6ec4}': ('buff', 3)}
ALLOWED = set('Color EmitterPosition FlexShapeDefinition SpawnShape __type alphaErosionDefinition alphaRef bindWeight birthColor birthDrag birthOrbitalVelocity birthRotation0 birthRotationalVelocity0 birthScale0 birthUVOffset birthUvScrollRate birthVelocity blendMode colorLookUpScales colorLookUpTypeY depthBiasFactors disableBackfaceCull emitterName emitterUvScrollRate hasPostRotateOrientation importance isGroundLayer isLocalOrientation isRandomStartFrame isRotationEnabled isSingleParticle isUniformScale lifetime meshRenderFlags miscRenderFlags numFrames paletteDefinition particleIsLocalOrientation particleLifetime particleLinger pass postRotateOrientationAxis primitive rate reflectionDefinition rotation0 scale0 texAddressModeBase texDiv texture timeBeforeFirstEmission useNavmeshMask uvScale uvScrollClamp worldAcceleration'.split())
KINDS = {'billboard':'billboard', 'VfxPrimitiveArbitraryQuad':'quad', 'VfxPrimitiveMesh':'mesh',
         'VfxPrimitiveAttachedMesh':'skin', 'VfxPrimitiveRay':'ray',
         'VfxPrimitiveCameraTrail':'trail', 'VfxPrimitiveArbitraryTrail':'trail'}
DEFAULTS = {**deepcopy(Q_DEFAULTS), 'uvDivisionNormalization':'max(round(value), 1), pinned external writer',
            'emitterLife':None, 'paletteTexture':None, 'paletteSourceMix':None,
            'orbitalAxis':None, 'frameRate':0, 'rotationEnabled':False}

def finite(value):
    return type(value) in (int,float) and math.isfinite(value)

def uv(raw, mult=False):
    suffix = 'Mult' if mult else ''
    divisions = raw.get('texDiv'+suffix, [1,1])
    require(len(divisions)==2 and all(finite(v) for v in divisions), 'Invalid E UV divisions')
    normalized = [max(math.floor(v+0.5),1) for v in divisions]
    frames = raw.get('numFrames'+suffix,1)
    start = raw.get('startFrame'+suffix,0)
    require(finite(frames) and frames>=1 and int(frames)==frames and finite(start), 'Invalid E frame controls')
    return dict(scale=value(raw.get('uvScale'+suffix,{}),[1,1]),
        offset=value(raw.get('birthUVOffset'+suffix,{}),[0,0]),
        birthScroll=value(raw.get('birthUvScrollRate'+suffix,{}),[0,0]),
        scroll=value(raw.get('particleUVScrollRate'+suffix,{}),[0,0]),
        emitterScroll=raw.get('emitterUvScrollRate'+suffix,[0,0]),
        divisions=normalized,sourceDivisions=divisions,frames=frames,startFrame=start,
        frameRate=raw.get('frameRate'+suffix,0),randomStart=bool(raw.get('isRandomStartFrame'+suffix,False)),
        clamp=bool(raw.get('uvScrollClamp',False)),address=raw.get('texAddressModeBase',0),
        authoredBookFields={f:deepcopy(raw[f]) for f in ['texDiv'+suffix,'numFrames'+suffix,
            'startFrame'+suffix,'frameRate'+suffix,'isRandomStartFrame'+suffix] if f in raw})

def shape(raw):
    kind=raw.get('__type','{ee39916f}')
    allowed={'{ee39916f}':{'emitOffset','__type'},
             'VfxShapeLegacy':{'emitOffset','emitRotationAngles','emitRotationAxes','__type'},
             'VfxShapeSphere':{'flags','radius','__type'},
             'VfxShapeCylinder':{'flags','radius','height','__type'}}
    require(kind in allowed and not set(raw)-allowed[kind], 'Unhandled E spawn shape')
    angles=[value(v,0) for v in raw.get('emitRotationAngles',[])]
    axes=raw.get('emitRotationAxes',[])
    require(len(angles)==len(axes) and all(len(a)==3 for a in axes), 'W spawn axes differ')
    return dict(kind={'{ee39916f}':'point','VfxShapeLegacy':'legacy',
        'VfxShapeSphere':'sphere','VfxShapeCylinder':'cylinder'}[kind],sourceType=kind,
        offset=value(raw.get('emitOffset',{}),[0,0,0]),angles=angles,axes=axes,
        radius=raw.get('radius'),height=raw.get('height'),flags=raw.get('flags'),
        explicitFields=sorted(raw))

def profiles(pin, textures, meshes):
    out=[]
    for system,(role,count) in SYSTEMS.items():
        emitters=pin['resources'][system]['definition'].get('complexEmitterDefinitionData',[])
        require(len(emitters)==count, 'W emitter closure differs')
        for index,e in enumerate(emitters):
            require(not set(e)-ALLOWED, 'Unhandled E emitter field')
            if 'colorLookUpScales' in e:require(len(e['colorLookUpScales'])==2 and all(finite(v) for v in e['colorLookUpScales']),'Invalid E lookup scales')
            if 'hasPostRotateOrientation' in e:require(type(e['hasPostRotateOrientation']) is int and e['hasPostRotateOrientation'] in (0,1),'Invalid E post-rotation native flag')
            if 'postRotateOrientationAxis' in e:require(len(e['postRotateOrientationAxis'])==3 and all(finite(v) for v in e['postRotateOrientationAxis']),'Invalid E post-rotation axis')
            primitive=e.get('primitive',{});source_kind=primitive.get('__type','billboard')
            require(source_kind in KINDS, 'Unhandled E primitive')
            kind=KINDS[source_kind];mesh=None;trail=None;attached=None
            if kind in ('mesh','skin'):
                require(set(primitive)=={'mMesh','__type'}, 'Unhandled E mesh primitive field')
                raw=primitive['mMesh']
                if kind=='mesh':
                    require(set(raw)=={'mSimpleMeshName','__type'}, 'Unhandled E mesh field')
                    mesh=meshes[raw['mSimpleMeshName'].lower()]
                else:
                    require('__type' in raw and not set(raw)-{'mSubmeshesToDraw','mLockMeshToAttachment','__type'},
                            'Unhandled E attached mesh field')
                    attached=deepcopy(raw)
            elif kind=='trail':
                require(set(primitive)=={'mTrail','__type'}, 'Unhandled E trail primitive')
                raw=primitive['mTrail']
                require(not set(raw)-{'mBirthTilingSize','mMode','mSmoothingMode','mCutoff','__type'},
                        'Unhandled E trail field')
                trail=dict(cameraFacing=source_kind=='VfxPrimitiveCameraTrail',mode=raw.get('mMode'),
                    smoothing=raw.get('mSmoothingMode'),cutoff=raw.get('mCutoff'),
                    tiling=value(raw.get('mBirthTilingSize',{}),[0,0,0]),explicitFields=sorted(raw))
            else:require(not set(primitive)-{'__type'}, 'Unhandled E primitive field')
            mult=e.get('textureMult')
            if mult:
                require(not set(mult)-{'textureMult','birthUvScrollRateMult','birthUVOffsetMult','__type'},
                        'Unhandled E multiplier field')
            multiplier=dict(texture=textures[mult['textureMult'].lower()],uv=uv(mult,True),
                explicitFields=sorted(mult)) if mult else None
            erosion=e.get('alphaErosionDefinition');eroded=None
            if erosion:
                require(not set(erosion)-{'erosionDriveCurve','erosionFeatherIn','erosionFeatherOut',
                    'erosionSliceWidth','erosionMapName','erosionMapChannelMixer','erosionMapAddressMode','__type'},
                    'Unhandled E erosion field')
                eroded=dict(texture=textures[erosion['erosionMapName'].lower()],
                    drive=value(erosion.get('erosionDriveCurve',{}),1),
                    mixer=value(erosion.get('erosionMapChannelMixer',{}),DEFAULTS['erosionMixer']),
                    featherIn=erosion.get('erosionFeatherIn',DEFAULTS['erosionFeather']),
                    featherOut=erosion.get('erosionFeatherOut',DEFAULTS['erosionFeather']),
                    sliceWidth=erosion.get('erosionSliceWidth',DEFAULTS['erosionSliceWidth']),
                    address=erosion.get('erosionMapAddressMode',DEFAULTS['erosionAddress']),
                    explicitFields=sorted(erosion))
            distortion=e.get('distortionDefinition');distorted=None
            if distortion:
                require(set(distortion)=={'distortion','distortionMode','normalMapTexture','__type'},
                        'Unhandled E distortion field')
                distorted=dict(texture=textures[distortion['normalMapTexture'].lower()],
                    strength=distortion['distortion'],mode=distortion['distortionMode'],explicitFields=sorted(distortion))
            soft=e.get('softParticleParams')
            if soft:require(not set(soft)-{'beginIn','deltaIn','beginOut','deltaOut','__type'},'Unhandled E soft field')
            palette=e.get('paletteDefinition');mapped_palette=None
            if palette:
                require(not set(palette)-{'paletteSelector','paletteCount','paletteTexture','paletteSourceMix','__type'},
                        'Unhandled E palette field')
                mapped_palette=dict(texture=textures[palette['paletteTexture'].lower()] if 'paletteTexture' in palette else None,
                    selector=value(palette.get('paletteSelector',{}),[0,0,0]),
                    count=palette.get('paletteCount'),sourceMix=palette.get('paletteSourceMix'),
                    explicitFields=sorted(palette))
            reflection=e.get('reflectionDefinition')
            if reflection:require(set(reflection)=={'fresnel','fresnelColor','__type'},'Unhandled E reflection field')
            fields=e.get('fieldCollectionDefinition')
            if fields:require(set(fields)=={'fieldAccelerationDefinitions','fieldOrbitalDefinitions','__type'},
                              'Unhandled E field collection')
            flex=e.get('FlexShapeDefinition')
            if flex:require(not set(flex)-{'scaleBirthScaleByBoundObjectSize','scaleEmitOffsetByBoundObjectSize','__type'},
                            'Unhandled E flex shape field')
            needs=[]
            if 'lifetime' not in e:needs.append('emitter-lifetime')
            if mapped_palette and mapped_palette['texture'] is None:needs.append('palette-texture')
            if e.get('falloffTexture'):needs.append('falloff-dispatch')
            if flex:needs.append('bound-object-size')
            if fields:needs.append('field-defaults')
            if reflection:needs.append('skin-fresnel-input')
            if attached:
                needs.append('attached-submesh-binding')
                if 'mSubmeshesToDraw' not in attached:needs.append('attached-selector-policy')
            if 'hasPostRotateOrientation' in e or 'postRotateOrientationAxis' in e:needs.append('post-rotate-orientation')
            if 'ParticlesShareRandomValue' in e:needs.append('random-sharing')
            if any(v<=0 for v in e.get('texDiv',[1,1])):needs.append('signed-uv-divisions')
            p=dict(system=system,role=role,index=index,name=e['emitterName'],sourceType=e['__type'],
                primitiveSourceType=source_kind,kind=kind,mesh=mesh,trail=trail,attached=attached,
                texture=textures[e['texture'].lower()],
                lookup=textures[e['particleColorTexture'].lower()] if 'particleColorTexture' in e else None,
                falloff=textures[e['falloffTexture'].lower()] if 'falloffTexture' in e else None,
                rate=value(e['rate'],0),single=bool(e.get('isSingleParticle',False)),
                delay=e.get('timeBeforeFirstEmission',0),emitterLife=e.get('lifetime'),
                emitterLinger=e.get('emitterLinger'),linger=e.get('particleLinger'),
                life=value(e['particleLifetime'],1),bind=value(e.get('bindWeight',{}),0),
                position=value(e.get('EmitterPosition',{}),[0,0,0]),shape=shape(e.get('SpawnShape',{})),
                velocity=value(e.get('birthVelocity',{}),[0,0,0]),
                orbitalVelocity=value(e.get('birthOrbitalVelocity',{}),[0,0,0]),
                worldAcceleration=value(e.get('worldAcceleration',{}),[0,0,0]),
                fieldCollection=deepcopy(fields),flex=deepcopy(flex),
                postRotateOrientation=dict(enabled=e.get('hasPostRotateOrientation'),
                    axis=deepcopy(e.get('postRotateOrientationAxis')),
                    explicitFields=[f for f in ['hasPostRotateOrientation','postRotateOrientationAxis'] if f in e]),
                drag=value(e.get('birthDrag',{}),[0,0,0]),rotation=value(e.get('birthRotation0',{}),[0,0,0]),
                spin=value(e.get('birthRotationalVelocity0',{}),[0,0,0]),
                rotationEnabled=e.get('isRotationEnabled'),liveRotation=value(e.get('rotation0',{}),[0,0,0]),
                size=value(e.get('birthScale0',{}),DEFAULTS['scale']),
                scale=value(e.get('scale0',{}),DEFAULTS['scale']),
                uniform=bool(e.get('isUniformScale',False)),
                birthColor=value(e.get('birthColor',{}),DEFAULTS['color']),
                color=value(e.get('Color',{}),DEFAULTS['color']),uv=uv(e),multiplier=multiplier,
                lookupTypes=[1,e.get('colorLookUpTypeY',0)],lookupScales=deepcopy(e.get('colorLookUpScales',[1,1])),lookupOffsets=[0,0],
                local=bool(e.get('isLocalOrientation',DEFAULTS['local'])),
                particleLocal=bool(e.get('particleIsLocalOrientation',DEFAULTS['particleLocal'])),
                directionOriented=bool(e.get('isDirectionOriented',False)),
                directionVelocityScale=e.get('directionVelocityScale'),
                directionVelocityMinScale=e.get('directionVelocityMinScale'),
                ground=bool(e.get('isGroundLayer',False)),navmesh=bool(e.get('useNavmeshMask',False)),
                blend=e.get('blendMode',DEFAULTS['blend']),renderOrder=e.get('pass',0),
                miscRenderFlags=e.get('miscRenderFlags',0),meshRenderFlags=e.get('meshRenderFlags',0),
                noCull=bool(e.get('disableBackfaceCull',False)),depthBias=e.get('depthBiasFactors',[0,0]),
                alphaRef=e.get('alphaRef',DEFAULTS['alphaRef']),importance=e.get('importance'),
                erosion=eroded,distortion=distorted,soft=deepcopy(soft),palette=mapped_palette,
                reflection=deepcopy(reflection),sharedRandomValue=e.get('ParticlesShareRandomValue'),
                explicitFields=sorted(e),bindingRequirements=needs,
                rawFlags={key:e.get(key) for key in ['isLocalOrientation','particleIsLocalOrientation',
                    'isSingleParticle','blendMode','isUniformScale','isRotationEnabled','ParticlesShareRandomValue']})
            require(p['rate']['times']==[0] and len(p['rate']['values'])==1,'Animated E rate needs explicit integration')
            out.append(p)
    require(len(out)==29, 'Incomplete E projection')
    return out
