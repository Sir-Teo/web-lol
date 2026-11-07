"""Complete authored R profile projection; unresolved runtime bindings stay explicit."""
from copy import deepcopy
import math
from ahri_r_particles import require
from ahri_q_projectile import value, DEFAULTS as Q_DEFAULTS

SYSTEMS = {'Ahri_R_Tar': ('joined', 11), 'Ahri_R_mis': ('unjoined', 11), 'Ahri_R_mis_02': ('joined', 12), 'Ahri_R_Indicator_1': ('joined', 1), 'Ahri_R_Indicator_2': ('joined', 2), 'Ahri_R_Indicator_3': ('joined', 3), 'Ahri_R_Ready_Aura': ('unjoined', 1), 'Ahri_R_TextureSwaps': ('joined', 0), 'Ahri_R_cas': ('unjoined', 4), 'Ahri_R_Eyes': ('joined', 4), 'Ahri_R_Ready_tar': ('joined', 6)}
ALLOWED = set('Color EmitterPosition FlexShapeDefinition ParticlesShareRandomValue SpawnShape __type alphaErosionDefinition alphaRef bindWeight birthColor birthDrag birthOrbitalVelocity birthRotation0 birthRotationalVelocity0 birthScale0 birthUVOffset birthUvScrollRate birthVelocity blendMode colorLookUpScales colorLookUpTypeX colorLookUpTypeY depthBiasFactors directionVelocityMinScale directionVelocityScale disableBackfaceCull distortionDefinition emitterLinger emitterName emitterUvScrollRate falloffTexture fieldCollectionDefinition importance isDirectionOriented isGroundLayer isLocalOrientation isRandomStartFrame isRotationEnabled isSingleParticle isUniformScale lifetime meshRenderFlags miscRenderFlags numFrames paletteDefinition particleColorTexture particleIsLocalOrientation particleLifetime particleLinger particleUVScrollRate pass period primitive rate rotation0 scale0 softParticleParams startFrame texAddressModeBase texDiv texture textureMult timeActiveDuringPeriod timeBeforeFirstEmission useNavmeshMask uvRotation uvScale worldAcceleration'.split())
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
    require(len(divisions)==2 and all(finite(v) for v in divisions), 'Invalid R UV divisions')
    normalized = [max(math.floor(v+0.5),1) for v in divisions]
    frames = raw.get('numFrames'+suffix,1)
    start = raw.get('startFrame'+suffix,0)
    require(finite(frames) and frames>=1 and int(frames)==frames and finite(start), 'Invalid R frame controls')
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
             'VfxShapeCylinder':{'flags','radius','height','__type'},
             'VfxShapeBox':{'flags','__type'}}
    require(kind in allowed and not set(raw)-allowed[kind], 'Unhandled R spawn shape')
    angles=[value(v,0) for v in raw.get('emitRotationAngles',[])]
    axes=raw.get('emitRotationAxes',[])
    require(len(angles)==len(axes) and all(len(a)==3 for a in axes), 'W spawn axes differ')
    return dict(kind={'{ee39916f}':'point','VfxShapeLegacy':'legacy',
        'VfxShapeSphere':'sphere','VfxShapeCylinder':'cylinder','VfxShapeBox':'box'}[kind],sourceType=kind,
        offset=value(raw.get('emitOffset',{}),[0,0,0]),angles=angles,axes=axes,
        radius=raw.get('radius'),height=raw.get('height'),flags=raw.get('flags'),
        explicitFields=sorted(raw))

def projected_profiles(pin, textures, meshes):
    out=[]
    for system,(role,count) in SYSTEMS.items():
        emitters=pin['resources'][system]['definition'].get('complexEmitterDefinitionData',[])
        require(len(emitters)==count, 'W emitter closure differs')
        for index,e in enumerate(emitters):
            require(not set(e)-ALLOWED, 'Unhandled R emitter field')
            if 'colorLookUpScales' in e:require(len(e['colorLookUpScales'])==2 and all(finite(v) for v in e['colorLookUpScales']),'Invalid R lookup scales')
            if 'hasPostRotateOrientation' in e:require(type(e['hasPostRotateOrientation']) is int and e['hasPostRotateOrientation'] in (0,1),'Invalid R post-rotation native flag')
            if 'postRotateOrientationAxis' in e:require(len(e['postRotateOrientationAxis'])==3 and all(finite(v) for v in e['postRotateOrientationAxis']),'Invalid R post-rotation axis')
            primitive=e.get('primitive',{});source_kind=primitive.get('__type','billboard')
            require(source_kind in KINDS, 'Unhandled R primitive')
            kind=KINDS[source_kind];mesh=None;trail=None;attached=None
            if kind in ('mesh','skin'):
                require(set(primitive)=={'mMesh','__type'}, 'Unhandled R mesh primitive field')
                raw=primitive['mMesh']
                if kind=='mesh':
                    require(set(raw)=={'mSimpleMeshName','__type'}, 'Unhandled R mesh field')
                    mesh=meshes[raw['mSimpleMeshName'].lower()]
                else:
                    require('__type' in raw and not set(raw)-{'mSubmeshesToDraw','mLockMeshToAttachment','__type'},
                            'Unhandled R attached mesh field')
                    attached=deepcopy(raw)
            elif kind=='trail':
                require(set(primitive)=={'mTrail','__type'}, 'Unhandled R trail primitive')
                raw=primitive['mTrail']
                require(not set(raw)-{'mBirthTilingSize','mMode','mSmoothingMode','mCutoff','__type'},
                        'Unhandled R trail field')
                trail=dict(cameraFacing=source_kind=='VfxPrimitiveCameraTrail',mode=raw.get('mMode'),
                    smoothing=raw.get('mSmoothingMode'),cutoff=raw.get('mCutoff'),
                    tiling=value(raw.get('mBirthTilingSize',{}),[0,0,0]),explicitFields=sorted(raw))
            else:require(not set(primitive)-{'__type'}, 'Unhandled R primitive field')
            mult=e.get('textureMult')
            if mult:
                require(not set(mult)-{'textureMult','birthUvScrollRateMult','birthUVOffsetMult','texDivMult','__type'},
                        'Unhandled R multiplier field')
            multiplier=dict(texture=textures[mult['textureMult'].lower()],uv=uv(mult,True),
                explicitFields=sorted(mult)) if mult else None
            erosion=e.get('alphaErosionDefinition');eroded=None
            if erosion:
                require(not set(erosion)-{'erosionDriveCurve','erosionFeatherIn','erosionFeatherOut',
                    'erosionSliceWidth','erosionMapName','erosionMapChannelMixer','erosionMapAddressMode','__type'},
                    'Unhandled R erosion field')
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
                        'Unhandled R distortion field')
                distorted=dict(texture=textures[distortion['normalMapTexture'].lower()],
                    strength=distortion['distortion'],mode=distortion['distortionMode'],explicitFields=sorted(distortion))
            soft=e.get('softParticleParams')
            if soft:require(not set(soft)-{'beginIn','deltaIn','beginOut','deltaOut','__type'},'Unhandled R soft field')
            palette=e.get('paletteDefinition');mapped_palette=None
            if palette:
                require(not set(palette)-{'paletteSelector','paletteCount','paletteTexture','paletteSourceMix','{143f06d1}','__type'},
                        'Unhandled R palette field')
                mapped_palette=dict(texture=textures[palette['paletteTexture'].lower()] if 'paletteTexture' in palette else None,
                    selector=value(palette.get('paletteSelector',{}),[0,0,0]),
                    count=palette.get('paletteCount'),sourceMix=palette.get('paletteSourceMix'),
                    unresolvedFields={k:deepcopy(v) for k,v in palette.items() if k.startswith('{')},
                    explicitFields=sorted(palette))
            reflection=e.get('reflectionDefinition')
            if reflection:require(set(reflection)=={'fresnel','fresnelColor','__type'},'Unhandled R reflection field')
            fields=e.get('fieldCollectionDefinition')
            if fields:require(set(fields)=={'fieldNoiseDefinitions','__type'},
                              'Unhandled R field collection')
            flex=e.get('FlexShapeDefinition')
            if flex:require(not set(flex)-{'scaleBirthScaleByBoundObjectSize','scaleEmitOffsetByBoundObjectSize','__type'},
                            'Unhandled R flex shape field')
            needs=[]
            if 'lifetime' not in e:needs.append('emitter-lifetime')
            if mapped_palette and mapped_palette['texture'] is None:needs.append('palette-texture')
            if mapped_palette and mapped_palette['unresolvedFields']:needs.append('native-palette-field')
            if e.get('falloffTexture'):needs.append('falloff-dispatch')
            if flex:needs.append('bound-object-size')
            if fields:needs.append('field-defaults')
            if reflection:needs.append('skin-fresnel-input')
            if attached:
                needs.append('attached-submesh-binding')
                if 'mSubmeshesToDraw' not in attached:needs.append('attached-selector-policy')
            if 'hasPostRotateOrientation' in e or 'postRotateOrientationAxis' in e:needs.append('post-rotate-orientation')
            if 'ParticlesShareRandomValue' in e:needs.append('random-sharing')
            if 'period' in e or 'timeActiveDuringPeriod' in e:needs.append('emitter-period-policy')
            if 'uvRotation' in e:needs.append('uv-rotation-policy')
            if soft:needs.append('soft-depth-input')
            if distorted:needs.append('distortion-scene-input')
            if e.get('SpawnShape',{}).get('__type')=='VfxShapeBox':needs.append('box-shape-dimensions')
            if any(v<=0 for v in e.get('texDiv',[1,1])):needs.append('signed-uv-divisions')
            p=dict(system=system,role=role,index=index,name=e['emitterName'],sourceType=e['__type'],
                primitiveSourceType=source_kind,kind=kind,mesh=mesh,trail=trail,attached=attached,
                texture=textures[e['texture'].lower()],
                lookup=textures[e['particleColorTexture'].lower()] if 'particleColorTexture' in e else None,
                falloff=textures[e['falloffTexture'].lower()] if 'falloffTexture' in e else None,
                period=e.get('period'),timeActiveDuringPeriod=e.get('timeActiveDuringPeriod'),
                uvRotation=value(e.get('uvRotation',{}),0),
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
                lookupTypes=[e.get('colorLookUpTypeX',1),e.get('colorLookUpTypeY',0)],lookupScales=deepcopy(e.get('colorLookUpScales',[1,1])),lookupOffsets=[0,0],
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
            require(p['rate']['times']==[0] and len(p['rate']['values'])==1,'Animated R rate needs explicit integration')
            out.append(p)
    require(len(out)==55, 'Incomplete R projection')
    return out


ALIASES = {'ffa711fb': 'paletteTexture', '17d9c5ce': 'timeActiveDuringPeriod', '99c94704': 'period', '2574b022': 'colorLookUpTypeX', 'f02bd44d': 'colorLookUpScales', '164b5733': 'texDivMult', 'fa390047': 'fieldNoiseDefinitions', '634db850': 'VfxFieldNoiseDefinitionData', '2fb31c01': 'frequency', '0bad81a4': 'velocityDelta', 'cf0bf7fe': 'axisFraction'}

def canonical(value):
    def named(text):
        if not isinstance(text,str) or len(text)!=10 or text[0]!='{' or text[-1]!='}':return text
        return ALIASES.get(text[1:-1],text)
    if isinstance(value,dict):
        result={}
        for key,child in value.items():
            name=named(key)
            require(name not in result,'Colliding R source alias')
            result[name]=canonical(child)
        return result
    if isinstance(value,list):return [canonical(child) for child in value]
    return named(value)

def profiles(pin,textures,meshes):
    flags={'ParticlesShareRandomValue','isDirectionOriented','isGroundLayer','isLocalOrientation',
           'isRandomStartFrame','isRotationEnabled','isSingleParticle','isUniformScale',
           'particleIsLocalOrientation','useNavmeshMask'}
    for resource in pin['resources'].values():
        for emitter in resource['definition'].get('complexEmitterDefinitionData',[]):
            require(all(type(emitter[f]) is int for f in flags if f in emitter),
                    'Native R FLAG payload cannot be coerced to boolean')
    for digest,name in ALIASES.items():
        actual=0x811c9dc5
        for byte in name.lower().encode('ascii'):actual=((actual^byte)*0x1000193)&0xffffffff
        require(f'{actual:08x}'==digest,'Unverified R source alias')
    result=projected_profiles(canonical(deepcopy(pin)),textures,meshes)
    for profile in result:
        source=pin['resources'][profile['system']]['definition']['complexEmitterDefinitionData'][profile['index']]
        profile['sourceExplicitFields']=sorted(source)
        profile['sourceDeclaration']=deepcopy(source)
        if profile['fieldCollection']:profile['bindingRequirements'].append('noise-field-arithmetic')
        if profile['role']=='unjoined':profile['bindingRequirements'].append('native-producer-dispatch')
    return result
