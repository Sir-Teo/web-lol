"""Complete Q projectile profile projection. Defaults are explicit local adapters."""
from masteryi_w_cast import value as project_value
from masteryi_w_buff import layer
from ahri_q_particles import require

SYSTEMS = ('Ahri_Q_mis', 'Ahri_Q_mis_02')
ALLOWED=set('Color EmitterPosition SpawnShape __type alphaErosionDefinition alphaRef bindWeight birthColor birthDrag birthRotation0 birthRotationalVelocity0 birthScale0 birthUVOffset birthUvScrollRate birthVelocity blendMode depthBiasFactors disableBackfaceCull emitterName emitterUvScrollRate isDirectionOriented isGroundLayer isLocalOrientation isSingleParticle isUniformScale lifetime meshRenderFlags miscRenderFlags particleColorTexture particleIsLocalOrientation particleLifetime particleLinger particleUVScrollRate pass primitive rate scale0 texAddressModeBase texture textureMult timeBeforeFirstEmission useNavmeshMask uvScale uvScrollClamp worldAcceleration'.split())
KINDS={'billboard':'billboard','VfxPrimitiveArbitraryQuad':'quad','VfxPrimitiveMesh':'mesh','VfxPrimitiveRay':'ray','VfxPrimitiveCameraTrail':'trail','VfxPrimitiveArbitraryTrail':'trail'}
DEFAULTS=dict(local=True,particleLocal=False,blend=0,scale=[1,1,1],color=[1,1,1,1],alphaRef=5/255,erosionMixer=[0,0,0,1],erosionFeather=.1,erosionSliceWidth=1.5,erosionAddress=1,lookupTypes=[1,0])

def value(raw,fallback):
    result=project_value(raw,fallback)
    authored=raw if isinstance(raw,dict)else{}
    dynamics=authored.get('dynamics',{})
    result.update(sourceType=authored.get('__type'),authoredKeyCount=len(dynamics.get('times',[])),dynamicType=dynamics.get('__type'),explicitFields=sorted(authored),probabilityMetadata=[dict(sourceType=t.get('__type'),explicitFields=sorted(t))for t in dynamics.get('probabilityTables',[])])
    return result

def uv_layer(raw,mult=False):
    result=layer(raw,mult);suffix='Mult'if mult else''
    result.update(scale=value(raw.get('uvScale'+suffix,{}),[1,1]),offset=value(raw.get('birthUVOffset'+suffix,{}),[0,0]),birthScroll=value(raw.get('birthUvScrollRate'+suffix,{}),[0,0]),scroll=value(raw.get('particleUVScrollRate'+suffix,{}),[0,0]),emitterScroll=raw.get('emitterUvScrollRate'+suffix,[0,0]),clamp=bool(raw.get('uvScrollClamp',False)),address=raw.get('texAddressModeBase',0))
    return result

def profiles(pin,textures,meshes):
    out=[]
    for system,count in zip(SYSTEMS,(16,20)):
        emitters=pin['resources'][system]['definition']['complexEmitterDefinitionData'];require(len(emitters)==count,'Projectile emitter closure differs')
        for index,e in enumerate(emitters):
            require(not(set(e)-ALLOWED),'Unhandled Q projectile emitter field')
            primitive=e.get('primitive',{});kind=primitive.get('__type','billboard');require(kind in KINDS,'Unhandled Q projectile primitive')
            mesh=None;trail=None
            if kind=='VfxPrimitiveMesh':
                require(set(primitive)=={'mMesh','__type'} and set(primitive['mMesh'])=={'mSimpleMeshName','__type'},'Unhandled Q mesh field')
                mesh=meshes[primitive['mMesh']['mSimpleMeshName'].lower()]
            elif KINDS[kind]=='trail':
                require(set(primitive)=={'mTrail','__type'},'Unhandled Q trail primitive field');raw=primitive['mTrail']
                require(not(set(raw)-{'mBirthTilingSize','mMode','mSmoothingMode','mCutoff','__type'}) and raw['__type']=='VfxTrailDefinitionData' and raw['mMode']==1,'Unhandled Q trail field/mode')
                trail=dict(cameraFacing=kind=='VfxPrimitiveCameraTrail',mode=raw['mMode'],smoothing=raw.get('mSmoothingMode'),cutoff=raw.get('mCutoff'),tiling=value(raw['mBirthTilingSize'],[0,0,0]),explicitFields=sorted(raw))
            else:require(not(set(primitive)-{'__type'}),'Unhandled Q primitive field')
            shape=e.get('SpawnShape',{});shape_type=shape.get('__type','{ee39916f}')
            require(shape_type in ('{ee39916f}','VfxShapeLegacy','VfxShapeCylinder'),'Unhandled Q spawn primitive')
            fields={'emitOffset','__type'} if shape_type=='{ee39916f}' else {'emitOffset','emitRotationAngles','emitRotationAxes','__type'} if shape_type=='VfxShapeLegacy' else {'flags','radius','height','__type'}
            require(not(set(shape)-fields),'Unhandled Q spawn field')
            angles=[value(v,0)for v in shape.get('emitRotationAngles',[])];axes=shape.get('emitRotationAxes',[]);require(len(angles)==len(axes) and all(len(a)==3 for a in axes),'Unhandled Q legacy rotation axes')
            spawn=dict(kind='point'if shape_type=='{ee39916f}'else'legacy'if shape_type=='VfxShapeLegacy'else'cylinder',sourceType=shape_type,offset=value(shape.get('emitOffset',{}),[0,0,0]),angles=angles,axes=axes,radius=shape.get('radius',0),height=shape.get('height',0),flags=shape.get('flags',0),explicitFields=sorted(shape))
            uv=uv_layer(e)
            require(len(uv['emitterScroll'])==2 and uv['address'] in (0,1,2),'Unsupported Q UV frame/address')
            mult=e.get('textureMult');multiplier=dict(texture=textures[mult['textureMult'].lower()],uv=uv_layer(mult,True))if mult else None
            erosion=e.get('alphaErosionDefinition');compiled_erosion=None
            if erosion:
                require(not(set(erosion)-{'erosionDriveCurve','erosionFeatherIn','erosionFeatherOut','erosionSliceWidth','erosionMapName','erosionMapChannelMixer','erosionMapAddressMode','__type'}),'Unhandled Q erosion field')
                compiled_erosion=dict(texture=textures[erosion['erosionMapName'].lower()],drive=value(erosion['erosionDriveCurve'],1),mixer=value(erosion.get('erosionMapChannelMixer',{}),DEFAULTS['erosionMixer']),featherIn=erosion.get('erosionFeatherIn',DEFAULTS['erosionFeather']),featherOut=erosion.get('erosionFeatherOut',DEFAULTS['erosionFeather']),sliceWidth=erosion.get('erosionSliceWidth',DEFAULTS['erosionSliceWidth']),address=erosion.get('erosionMapAddressMode',DEFAULTS['erosionAddress']),explicitFields=sorted(erosion))
            p=dict(system=system,role='missile'if system==SYSTEMS[0]else'return',index=index,name=e['emitterName'],sourceType=e['__type'],primitiveSourceType=kind,kind=KINDS[kind],mesh=mesh,trail=trail,texture=textures[e['texture'].lower()],lookup=textures[e['particleColorTexture'].lower()]if'particleColorTexture'in e else None,rate=value(e['rate'],0),single=bool(e.get('isSingleParticle',False)),delay=e.get('timeBeforeFirstEmission',0),emitterLife=e['lifetime'],emitterLinger=None,linger=e.get('particleLinger'),life=value(e['particleLifetime'],1),bind=value(e.get('bindWeight',{}),0),position=value(e.get('EmitterPosition',{}),[0,0,0]),shape=spawn,velocity=value(e.get('birthVelocity',{}),[0,0,0]),worldAcceleration=value(e.get('worldAcceleration',{}),[0,0,0]),drag=value(e.get('birthDrag',{}),[0,0,0]),rotation=value(e.get('birthRotation0',{}),[0,0,0]),spin=value(e.get('birthRotationalVelocity0',{}),[0,0,0]),size=value(e.get('birthScale0',{}),DEFAULTS['scale']),scale=value(e.get('scale0',{}),DEFAULTS['scale']),uniform=bool(e.get('isUniformScale',False)),birthColor=value(e.get('birthColor',{}),DEFAULTS['color']),color=value(e.get('Color',{}),DEFAULTS['color']),uv=uv,uvMode=0,multiplier=multiplier,lookupTypes=DEFAULTS['lookupTypes'],lookupScales=[1,1],lookupOffsets=[0,0],local=bool(e.get('isLocalOrientation',DEFAULTS['local'])),particleLocal=bool(e.get('particleIsLocalOrientation',DEFAULTS['particleLocal'])),directionOriented=bool(e.get('isDirectionOriented',False)),directionVelocityScale=0,ground=bool(e.get('isGroundLayer',False)),navmesh=bool(e.get('useNavmeshMask',False)),blend=e.get('blendMode',DEFAULTS['blend']),renderOrder=e.get('pass',0),miscRenderFlags=e.get('miscRenderFlags',0),meshRenderFlags=e.get('meshRenderFlags',0),noCull=bool(e.get('disableBackfaceCull',False)),depthBias=e.get('depthBiasFactors',[0,0]),alphaRef=e.get('alphaRef',DEFAULTS['alphaRef']),erosion=compiled_erosion,distortion=None,soft=None,palette=None,explicitFields=sorted(e),rawFlags={key:e.get(key)for key in ['isLocalOrientation','particleIsLocalOrientation','isSingleParticle','blendMode','isUniformScale']})
            require(p['rate']['times']==[0] and len(p['rate']['values'])==1,'Animated Q rate requires explicit source count integration')
            require(p['blend'] in (0,1,4) and p['life']['values'][0][0]>0 and p['emitterLife']>0,'Unsupported Q render/life mode')
            out.append(p)
    require(len(out)==36,'Incomplete Q projectile projection')
    return out
