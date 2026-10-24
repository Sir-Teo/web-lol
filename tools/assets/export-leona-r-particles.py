"""Compile every enabled Solar Flare emitter; retain every disabled record verbatim.

Unknown emitter fields and primitive/shape classes fail closed. Defaults follow pinned reconstruction evidence;
native CPU dispatch/update/PRNG/default behavior remains unverified.
"""
from pathlib import Path
import hashlib,json,sys,math
sha=lambda b:hashlib.sha256(b).hexdigest()
pin_path=Path('docs/reference/leona-r-particles.json')
pin=json.loads(pin_path.read_text())
decoded_path=Path('docs/reference/leona-r-particles-decoded.json')
decoded=json.loads(decoded_path.read_text())
assert decoded['sourcePinSha256']==sha(pin_path.read_bytes())
textures={t['source']['path']:t['path'].removeprefix('public/') for t in decoded['textures']}
meshes={m['source']['path']:m['output']['path'].removeprefix('/') for m in decoded['meshes']}
for t in decoded['textures']:assert sha(Path(t['path']).read_bytes())==t['sha256']
for m in decoded['meshes']:assert sha(Path('public'+m['output']['path']).read_bytes())==m['output']['sha256']
reader_path=Path('docs/reference/leona-w-emission-reader.json')
reader=json.loads(reader_path.read_text())
if '--readers' in sys.argv:
    for f in reader['files']:assert sha((Path('.cache/leona-w-emission-readers-v2-20261023')/f['name']).read_bytes())==f['sha256']
def vector(v):return v if isinstance(v,list) else [v]
def value(v,fallback):
    if isinstance(v,list):v=dict(constantValue=v)
    assert set(v)<=set('constantValue dynamics __type'.split())
    d=v.get('dynamics',{})
    assert set(d)<=set('probabilityTables times values __type'.split())
    times=d.get('times',[0]);values=[vector(x) for x in d.get('values',[v.get('constantValue',fallback)])]
    assert len(times)==len(values)>0 and all(a<=b for a,b in zip(times,times[1:]))
    assert all(len(x)==len(vector(fallback)) and all(math.isfinite(y) for y in x) for x in values)
    probs=[]
    for t in d.get('probabilityTables',[]):
        assert set(t)<=set('keyTimes keyValues singleValue __type'.split())
        assert len(t.get('keyTimes',[]))==len(t.get('keyValues',[]))
        probs.append(dict(times=t.get('keyTimes',[]),values=t.get('keyValues',[]),single=t.get('singleValue',1)))
    return dict(constant=vector(v.get('constantValue',fallback)),times=times,values=values,probabilities=probs)
def asset(p):return textures[p.lower()] if p else None
def uv(e,mult=False):
    names=['uvScale','birthUVOffset','birthUvScrollRate','particleUVScrollRate','uvScrollClamp','texAddressModeBase'] if not mult else ['uvScaleMult','birthUVOffsetMult','birthUvScrollRateMult','ParticleIntegratedUvScrollMult','uvScrollClampMult','texAddressModeMult']
    scale,offset,birth,scroll,clamp,address=names
    assert not mult or set(e)<=set('textureMult birthUvScrollRateMult birthUVOffsetMult uvScrollClampMult __type'.split())
    return dict(scale=value(e.get(scale,{}),[1,1]),offset=value(e.get(offset,{}),[0,0]),birthScroll=value(e.get(birth,{}),[0,0]),
        scroll=value(e.get(scroll,{}),[0,0]),clamp=bool(e.get(clamp,False)),address=e.get(address,0),
        divisions=e.get('texDiv',[1,1]),frames=e.get('numFrames',1),randomStart=bool(e.get('isRandomStartFrame',False)))
roles={'Leona_R_buf':'buff','Leona_R_cas':'cast','Leona_R_tar':'contact','Leona_R_hit_aoe_green':'area-green','Leona_R_hit_aoe_red':'area-red','Leona_R_hit_impact':'impact'}
routes={
 'rate':'rate','particleLifetime':'life','particleLinger':'linger','lifetime':'emitterLife','isSingleParticle':'single',
 'emitterName':'name','bindWeight':'bind','primitive':'primitive/kind/mesh/trail','blendMode':'blend','birthColor':'birthColor','Color':'color',
 'alphaRef':'alphaRef','alphaErosionDefinition':'erosion','reflectionDefinition':'reflection','depthBiasFactors':'depthBias',
 'disableBackfaceCull':'noCull','particleIsLocalOrientation':'particleLocal','isUniformScale':'uniform','texture':'texture',
 '__type':'sourceType','timeBeforeFirstEmission':'delay','SpawnShape':'shape','particleColorTexture':'lookup','pass':'renderOrder',
 'miscRenderFlags':'miscRenderFlags','birthScale0':'size','uvMode':'uvMode','birthUvScrollRate':'uv.birthScroll','birthUVOffset':'uv.offset',
 'meshRenderFlags':'meshRenderFlags','EmitterPosition':'position','birthRotation0':'rotation','scale0':'scale','textureMult':'multiplier',
 'Linger':'lingerColor','worldAcceleration':'acceleration','softParticleParams':'soft','birthRotationalVelocity0':'spin',
 'particleUVScrollRate':'uv.scroll','uvScale':'uv.scale','distortionDefinition':'distortion','importance':'importance',
 'isRandomStartFrame':'uv.randomStart','isGroundLayer':'ground','useNavmeshMask':'navmesh','texAddressModeBase':'uv.address',
 'birthVelocity':'velocity','birthDrag':'drag','isDirectionOriented':'directionOriented','directionVelocityScale':'directionVelocityScale',
 'FlexShapeDefinition':'boundScale/boundOffset','isRotationEnabled':'rotationEnabled','paletteDefinition':'palette',
}
routes.update({
 'emitterLinger':'emitterLinger','isLocalOrientation':'local',
 'birthAcceleration':'birthAcceleration','colorLookUpTypeX':'lookupTypes[0]',
 'colorLookUpTypeY':'lookupTypes[1]','colorRenderFlags':'colorRenderFlags',
 'useEmissionMeshNormalForBirth':'emissionMeshNormal', 'period':'period',
 'timeActiveDuringPeriod':'activePeriod','numFrames':'uv.frames','texDiv':'uv.divisions',
 'uvScrollClamp':'uv.clamp',
 'colorLookUpScales':'lookupScales','colorLookUpOffsets':'lookupOffsets',
 'particleLingerType':'lingerType','stencilRef':'stencilRef',
 'birthOrbitalVelocity':'orbitalVelocity','fieldCollectionDefinition':'noise',
})
profiles=[];disabled=[];systems=[]
for system,r in pin['resources'].items():
    definition=r['definition']
    assert set(definition)<=set('complexEmitterDefinitionData particleName particlePath overrideScaleCap soundOnCreateDefault soundPersistentDefault materialOverrideDefinitions flags visibilityRadius objectPath __type'.split())
    systems.append(dict(key=system,role=roles[system],declaration={k:v for k,v in definition.items() if k!='complexEmitterDefinitionData'}))
    for index,e in enumerate(definition['complexEmitterDefinitionData']):
        if e.get('disabled',False):
            disabled.append(dict(system=system,index=index,definition=e));continue
        assert set(e)<=set(routes),(system,index,set(e)-set(routes))
        primitive=e.get('primitive',{});kind=primitive.get('__type','billboard')
        assert kind in ['billboard','VfxPrimitiveAttachedMesh','VfxPrimitiveMesh','VfxPrimitiveArbitraryQuad','VfxPrimitiveRay','VfxPrimitiveArbitraryTrail','VfxPrimitivePlanarProjection']
        assert e.get('blendMode',0) in [0,1,4] and e.get('meshRenderFlags',0)==0
        if kind=='VfxPrimitiveMesh':assert set(primitive)=={'mMesh','__type'} and set(primitive['mMesh'])=={'mSimpleMeshName','__type'}
        elif kind=='VfxPrimitiveArbitraryTrail':
            assert set(primitive)=={'mTrail','__type'}
            assert set(primitive['mTrail'])==set('mMode mCutoff mBirthTilingSize mSmoothingMode __type'.split())
            assert primitive['mTrail']['mMode']==1 and primitive['mTrail']['mSmoothingMode']==1
        elif kind=='VfxPrimitiveAttachedMesh':
            assert set(primitive)=={'mMesh','__type'} and set(primitive['mMesh'])=={'mLockMeshToAttachment','__type'}
            assert primitive['mMesh']['mLockMeshToAttachment'] is True
        elif kind=='VfxPrimitivePlanarProjection':
            assert set(primitive)=={'mProjection','__type'}
            assert set(primitive['mProjection'])=={'mYRange','mFading','__type'}
            assert primitive['mProjection']['mYRange']==500 and primitive['mProjection']['mFading']==500
        else:assert set(primitive)<=set(['__type'])
        shape=e.get('SpawnShape',{})
        assert set(shape)<=set('emitOffset emitRotationAngles emitRotationAxes flags size radius height __type'.split())
        shape_type=shape.get('__type','{ee39916f}')
        assert shape_type in ['{ee39916f}','VfxShapeLegacy','VfxShapeBox','VfxShapeSphere','VfxShapeCylinder']
        assert shape_type not in ['VfxShapeBox','VfxShapeSphere','VfxShapeCylinder'] or shape.get('flags')==1
        flex=e.get('FlexShapeDefinition',{})
        assert set(flex)<=set('scaleBirthScaleByBoundObjectSize scaleEmitOffsetByBoundObjectSize __type'.split())
        erosion=e.get('alphaErosionDefinition')
        if erosion:
            assert set(erosion)<=set('erosionDriveCurve erosionFeatherIn erosionFeatherOut erosionSliceWidth erosionMapName erosionMapChannelMixer erosionMapAddressMode __type'.split())
            erosion=dict(texture=asset(erosion['erosionMapName']),mixer=value(erosion.get('erosionMapChannelMixer',{}),[0,0,0,1]),drive=value(erosion.get('erosionDriveCurve',{}),1),
                featherIn=erosion.get('erosionFeatherIn',0.1),featherOut=erosion.get('erosionFeatherOut',0.1),sliceWidth=erosion.get('erosionSliceWidth',1.5),address=erosion.get('erosionMapAddressMode',1))
        distortion=e.get('distortionDefinition')
        if distortion:
            assert set(distortion)<=set('distortion distortionMode normalMapTexture __type'.split())
            assert distortion.get('distortionMode',1) in [1,2]
            distortion=dict(strength=distortion['distortion'],texture=asset(distortion['normalMapTexture']),mode=distortion.get('distortionMode',1))
        reflection=e.get('reflectionDefinition')
        if reflection:
            assert set(reflection)==set('fresnel fresnelColor __type'.split())
            reflection=dict(power=reflection['fresnel'],color=reflection['fresnelColor'])
        palette=e.get('paletteDefinition')
        if palette:
            assert set(palette)<=set('palleteSrcMixColor paletteSelector paletteCount paletteTexture __type'.split())
            palette=dict(texture=asset(palette.get('paletteTexture')),mix=value(palette.get('palleteSrcMixColor',{}),[0.299,0.587,0.114,0]),selector=value(palette['paletteSelector'],[0,0,0]),count=palette['paletteCount'])
        linger=e.get('Linger')
        if linger:assert set(linger)==set('UseSeparateLingerColor SeparateLingerColor __type'.split()) and linger['UseSeparateLingerColor']==1
        soft=e.get('softParticleParams')
        if soft:
            assert set(soft)<=set('beginIn deltaIn beginOut deltaOut __type'.split())
            soft=dict(beginIn=soft.get('beginIn',0),deltaIn=soft.get('deltaIn',0),beginOut=soft.get('beginOut',0),deltaOut=soft.get('deltaOut',0))
        mult=e.get('textureMult')
        fields=e.get('fieldCollectionDefinition')
        if fields:
            assert set(fields)=={'fieldNoiseDefinitions','__type'}
            assert len(fields['fieldNoiseDefinitions'])==1
            n=fields['fieldNoiseDefinitions'][0]
            assert set(n)=={'axisFraction','__type'} and n['axisFraction']==[1,1,1]
            assert n['__type']=='VfxFieldNoiseDefinitionData'
        assert e.get('particleLingerType',0) in [0,1]
        assert 'stencilRef' not in e or e['stencilRef']==7

        p=dict(system=system,role=roles[system],index=index,name=e['emitterName'],sourceType=e['__type'],
            kind={'billboard':'billboard','VfxPrimitiveAttachedMesh':'skin','VfxPrimitiveMesh':'mesh','VfxPrimitiveArbitraryQuad':'quad','VfxPrimitiveRay':'ray','VfxPrimitiveArbitraryTrail':'trail','VfxPrimitivePlanarProjection':'projection'}[kind],
            primitive=primitive,mesh=meshes[primitive['mMesh']['mSimpleMeshName'].lower()] if kind=='VfxPrimitiveMesh' else None,
            texture=asset(e.get('texture')),lookup=asset(e.get('particleColorTexture')),rate=value(e['rate'],0),single=bool(e.get('isSingleParticle',False)),delay=e.get('timeBeforeFirstEmission',0),
            emitterLife=e.get('lifetime'),emitterLinger=e.get('emitterLinger',0),linger=e.get('particleLinger') or 0,lingerType=e.get('particleLingerType',0),life=value(e.get('particleLifetime',{}),1),
            bind=value(e.get('bindWeight',{}),0),position=value(e.get('EmitterPosition',{}),[0,0,0]),
            shape=dict(kind={'{ee39916f}':'point','VfxShapeLegacy':'legacy','VfxShapeBox':'box','VfxShapeSphere':'sphere','VfxShapeCylinder':'cylinder'}[shape_type],offset=value(shape.get('emitOffset',{}),[0,0,0]),
                angles=[value(a,0) for a in shape.get('emitRotationAngles',[])],axes=shape.get('emitRotationAxes',[]),boxSize=shape.get('size',[0,0,0]),sphereRadius=shape.get('radius',0),height=shape.get('height',0),flags=shape.get('flags',0)),
            boundScale=flex.get('scaleBirthScaleByBoundObjectSize'),boundOffset=flex.get('scaleEmitOffsetByBoundObjectSize'),
            birthAcceleration=value(e.get('birthAcceleration',{}),[0,0,0]),velocity=value(e.get('birthVelocity',{}),[0,0,0]),drag=value(e.get('birthDrag',{}),[0,0,0]),acceleration=value(e.get('worldAcceleration',{}),[0,0,0]),
            rotation=value(e.get('birthRotation0',{}),[0,0,0]),spin=value(e.get('birthRotationalVelocity0',{}),[0,0,0]),rotationEnabled=bool(e.get('isRotationEnabled',False)),
            size=value(e.get('birthScale0',{}),[1,1,1]),scale=value(e.get('scale0',{}),[1,1,1]),uniform=bool(e.get('isUniformScale',False)),
            birthColor=value(e.get('birthColor',{}),[1,1,1,1]),color=value(e.get('Color',{}),[1,1,1,1]),lingerColor=value(linger['SeparateLingerColor'],[1,1,1,1]) if linger else None,
            uv=uv(e),uvMode=e.get('uvMode',0),multiplier=dict(texture=asset(mult['textureMult']),uv=uv(mult,True)) if mult else None,
            lookupTypes=[e.get('colorLookUpTypeX',1),e.get('colorLookUpTypeY',0)],lookupScales=e.get('colorLookUpScales',[1,1]),lookupOffsets=e.get('colorLookUpOffsets',[0,0]),ground=bool(e.get('isGroundLayer',False)),navmesh=bool(e.get('useNavmeshMask',False)),
            local=bool(e.get('isLocalOrientation',True)),particleLocal=bool(e.get('particleIsLocalOrientation',False)),directionOriented=bool(e.get('isDirectionOriented',False)),directionVelocityScale=e.get('directionVelocityScale',0),
            blend=e.get('blendMode',0),renderOrder=e.get('pass',0),importance=e.get('importance'),miscRenderFlags=e.get('miscRenderFlags',0),meshRenderFlags=e.get('meshRenderFlags',0),
            period=e.get('period'),activePeriod=e.get('timeActiveDuringPeriod'),colorRenderFlags=e.get('colorRenderFlags',0),emissionMeshNormal=bool(e.get('useEmissionMeshNormalForBirth',False)),
            trail=dict(mode=primitive['mTrail']['mMode'],smoothing=primitive['mTrail']['mSmoothingMode'],cutoff=primitive['mTrail']['mCutoff'],tiling=value(primitive['mTrail']['mBirthTilingSize'],[0,0,0])) if kind=='VfxPrimitiveArbitraryTrail' else None,
            noCull=bool(e.get('disableBackfaceCull',False)),alphaRef=e.get('alphaRef',5)/255,depthBias=e.get('depthBiasFactors',[0,0]),
            erosion=erosion,distortion=distortion,reflection=reflection,palette=palette,soft=soft,
            orbitalVelocity=value(e.get('birthOrbitalVelocity',{}),[0,0,0]),
            noise=fields,stencilRef=e.get('stencilRef'),stencilMode=None,
            projection=primitive.get('mProjection'),lockMeshToAttachment=primitive.get('mMesh',{}).get('mLockMeshToAttachment'),
            sourceFields=sorted(e))
        assert len(p['shape']['angles'])==len(p['shape']['axes'])
        assert p['rate']['times']==[0] and len(p['rate']['values'])==1
        profiles.append(p)
assert len(profiles)==44 and len(disabled)==9
assert all(not p['emissionMeshNormal'] for p in profiles)
assert all(p['period'] is None or (p['single'] and p['period']==5 and p['activePeriod']==0.5 and p['delay']<p['activePeriod']) for p in profiles)
assert all(p['palette'] is None and p['reflection'] is None and p['trail'] is None for p in profiles)
out=dict(systems=systems,profiles=profiles,disabled=disabled,
    noiseDefaults=dict(origin=[0,0,0],frequency=0,radius=0,velocityDelta=0,provenance='Pinned external readMotion defaults, not native CPU evidence'),
    pathResolutions=[dict(r,resolvedAsset=asset(r['path'])) for r in pin.get('pathResolutions',[])])
raw=(json.dumps(out,indent=2)+'\n').encode();path=Path('src/content/leona-r-particles.json')
kernel_reader_path=Path('docs/reference/leona-r-kernel-readers.json')
kernel_reader=json.loads(kernel_reader_path.read_text())
if '--readers' in sys.argv:
    for f in kernel_reader['files']:assert sha(Path(f['path']).read_bytes())==f['sha256']
audit=dict(kernelReadersPinSha256=sha(kernel_reader_path.read_bytes()),sourcePinSha256=sha(pin_path.read_bytes()),decodedAssetsSha256=sha(decoded_path.read_bytes()),readerPinSha256=sha(reader_path.read_bytes()),
    output=dict(path=str(path),bytes=len(raw),sha256=sha(raw)),fieldRoutes=routes,
    compiled=[dict(system=p['system'],index=p['index'],fields=p['sourceFields']) for p in profiles],
    disabled=[dict(system=p['system'],index=p['index']) for p in disabled],
    localChoices=['Missing particle lifetime is one second, matching conservative saved-history retention.',
      'Noise source records author only axisFraction; the pinned reconstruction defaults all omitted noise delta/frequency/radius to zero. Native defaults remain unverified.',
      'Orbital angular rate is retained separately from integrated velocity/acceleration and uses authored radians.',
      'Type1 linger, projection parameters, attachment lock, stencilRef without a mode, missing texture and independent multiplier UV remain explicit.',
      'Cosmetic chance/roll hashes do not consume World RNG or shared identities. Native CPU/PRNG/dispatch/defaults remain unverified.'],
    nativeCpuVerified=False)
for target,data in [(path,raw),(Path('docs/reference/leona-r-particle-profiles.json'),(json.dumps(audit,indent=2)+'\n').encode())]:
    if '--check' in sys.argv:assert target.read_bytes()==data
    elif not target.exists() or target.read_bytes()!=data:target.write_bytes(data)
print(json.dumps(dict(result='passed',enabled=len(profiles),disabled=len(disabled),bytes=len(raw),nativeCpuVerified=False)))
