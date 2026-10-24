"""Compile every enabled Eclipse emitter; retain every disabled record verbatim.

Unknown fields/types fail closed. Defaults follow pinned reconstruction evidence;
native CPU dispatch/update/PRNG/default behavior remains unverified.
"""
from pathlib import Path
import hashlib,json,sys,math
sha=lambda b:hashlib.sha256(b).hexdigest()
pin_path=Path('docs/reference/leona-w-particles.json')
pin=json.loads(pin_path.read_text())
decoded_path=Path('docs/reference/leona-w-particles-decoded.json')
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
    assert not mult or set(e)<=set('textureMult birthUvScrollRateMult uvScrollClampMult __type'.split())
    return dict(scale=value(e.get(scale,{}),[1,1]),offset=value(e.get(offset,{}),[0,0]),birthScroll=value(e.get(birth,{}),[0,0]),
        scroll=value(e.get(scroll,{}),[0,0]),clamp=bool(e.get(clamp,False)),address=e.get(address,0),
        divisions=e.get('texDiv',[1,1]),frames=e.get('numFrames',1),randomStart=bool(e.get('isRandomStartFrame',False)))
roles={'Leona_W_buf_1':'buff-initial','Leona_W_buf_2':'buff-extended','Leona_W_cas_fail':'cast-miss','Leona_W_cas_hit':'cast-hit','Leona_W_tar':'target'}
routes={
 'rate':'rate','particleLifetime':'life','particleLinger':'linger','lifetime':'emitterLife','isSingleParticle':'single',
 'emitterName':'name','bindWeight':'bind','primitive':'primitive/kind/mesh','blendMode':'blend','birthColor':'birthColor','Color':'color',
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
profiles=[];disabled=[];systems=[]
for system,r in pin['resources'].items():
    definition=r['definition']
    assert set(definition)<=set('complexEmitterDefinitionData particleName particlePath overrideScaleCap soundOnCreateDefault flags objectPath __type'.split())
    systems.append(dict(key=system,role=roles[system],declaration={k:v for k,v in definition.items() if k!='complexEmitterDefinitionData'}))
    for index,e in enumerate(definition['complexEmitterDefinitionData']):
        if e.get('disabled',False):
            disabled.append(dict(system=system,index=index,definition=e));continue
        assert set(e)<=set(routes),(system,index,set(e)-set(routes))
        primitive=e.get('primitive',{});kind=primitive.get('__type','billboard')
        assert kind in ['billboard','VfxPrimitiveAttachedMesh','VfxPrimitiveMesh','VfxPrimitiveArbitraryQuad','VfxPrimitiveRay']
        assert e.get('blendMode',0) in [0,1,4] and e.get('meshRenderFlags',0)==0
        if kind=='VfxPrimitiveMesh':assert set(primitive)=={'mMesh','__type'} and set(primitive['mMesh'])=={'mSimpleMeshName','__type'}
        else:assert set(primitive)<=set(['__type'])
        shape=e.get('SpawnShape',{})
        assert set(shape)<=set('emitOffset emitRotationAngles emitRotationAxes flags size __type'.split())
        shape_type=shape.get('__type','{ee39916f}')
        assert shape_type in ['{ee39916f}','VfxShapeLegacy','VfxShapeBox']
        assert shape_type!='VfxShapeBox' or shape.get('flags')==1
        flex=e.get('FlexShapeDefinition',{})
        assert set(flex)<=set('scaleBirthScaleByBoundObjectSize scaleEmitOffsetByBoundObjectSize __type'.split())
        erosion=e.get('alphaErosionDefinition')
        if erosion:
            assert set(erosion)<=set('erosionDriveCurve erosionFeatherIn erosionFeatherOut erosionSliceWidth erosionMapName __type'.split())
            erosion=dict(texture=asset(erosion['erosionMapName']),mixer=value({},[0,0,0,1]),drive=value(erosion.get('erosionDriveCurve',{}),1),
                featherIn=erosion.get('erosionFeatherIn',0.1),featherOut=erosion.get('erosionFeatherOut',0.1),sliceWidth=erosion.get('erosionSliceWidth',1.5),address=1)
        distortion=e.get('distortionDefinition')
        if distortion:
            assert set(distortion)==set('distortion normalMapTexture __type'.split())
            distortion=dict(strength=distortion['distortion'],texture=asset(distortion['normalMapTexture']),mode=1)
        reflection=e.get('reflectionDefinition')
        if reflection:
            assert set(reflection)==set('fresnel fresnelColor __type'.split())
            reflection=dict(power=reflection['fresnel'],color=reflection['fresnelColor'])
        palette=e.get('paletteDefinition')
        if palette:
            assert set(palette)==set('palleteSrcMixColor paletteSelector paletteCount __type'.split())
            palette=dict(texture=None,mix=value(palette['palleteSrcMixColor'],[0.299,0.587,0.114,0]),selector=value(palette['paletteSelector'],[0,0,0]),count=palette['paletteCount'])
        linger=e.get('Linger')
        if linger:assert set(linger)==set('UseSeparateLingerColor SeparateLingerColor __type'.split()) and linger['UseSeparateLingerColor']==1
        soft=e.get('softParticleParams')
        if soft:
            assert set(soft)<=set('beginIn deltaIn beginOut deltaOut __type'.split())
            soft=dict(beginIn=soft.get('beginIn',0),deltaIn=soft.get('deltaIn',0),beginOut=soft.get('beginOut',0),deltaOut=soft.get('deltaOut',0))
        mult=e.get('textureMult')
        p=dict(system=system,role=roles[system],index=index,name=e['emitterName'],sourceType=e['__type'],
            kind={'billboard':'billboard','VfxPrimitiveAttachedMesh':'skin','VfxPrimitiveMesh':'mesh','VfxPrimitiveArbitraryQuad':'quad','VfxPrimitiveRay':'ray'}[kind],
            primitive=primitive,mesh=meshes[primitive['mMesh']['mSimpleMeshName'].lower()] if kind=='VfxPrimitiveMesh' else None,
            texture=asset(e['texture']),lookup=asset(e.get('particleColorTexture')),rate=value(e['rate'],0),single=bool(e.get('isSingleParticle',False)),delay=e.get('timeBeforeFirstEmission',0),
            emitterLife=e.get('lifetime'),emitterLinger=0,linger=e.get('particleLinger',0),lingerType=0,life=value(e.get('particleLifetime',{}),3),
            bind=value(e.get('bindWeight',{}),0),position=value(e.get('EmitterPosition',{}),[0,0,0]),
            shape=dict(kind={'{ee39916f}':'point','VfxShapeLegacy':'legacy','VfxShapeBox':'box'}[shape_type],offset=value(shape.get('emitOffset',{}),[0,0,0]),
                angles=[value(a,0) for a in shape.get('emitRotationAngles',[])],axes=shape.get('emitRotationAxes',[]),boxSize=shape.get('size',[0,0,0])),
            boundScale=flex.get('scaleBirthScaleByBoundObjectSize'),boundOffset=flex.get('scaleEmitOffsetByBoundObjectSize'),
            velocity=value(e.get('birthVelocity',{}),[0,0,0]),drag=value(e.get('birthDrag',{}),[0,0,0]),acceleration=value(e.get('worldAcceleration',{}),[0,0,0]),
            rotation=value(e.get('birthRotation0',{}),[0,0,0]),spin=value(e.get('birthRotationalVelocity0',{}),[0,0,0]),rotationEnabled=bool(e.get('isRotationEnabled',False)),
            size=value(e.get('birthScale0',{}),[1,1,1]),scale=value(e.get('scale0',{}),[1,1,1]),uniform=bool(e.get('isUniformScale',False)),
            birthColor=value(e.get('birthColor',{}),[1,1,1,1]),color=value(e.get('Color',{}),[1,1,1,1]),lingerColor=value(linger['SeparateLingerColor'],[1,1,1,1]) if linger else None,
            uv=uv(e),uvMode=e.get('uvMode',0),multiplier=dict(texture=asset(mult['textureMult']),uv=uv(mult,True)) if mult else None,
            lookupTypes=[1,0],lookupScales=[1,1],lookupOffsets=[0,0],ground=bool(e.get('isGroundLayer',False)),navmesh=bool(e.get('useNavmeshMask',False)),
            local=True,particleLocal=bool(e.get('particleIsLocalOrientation',False)),directionOriented=bool(e.get('isDirectionOriented',False)),directionVelocityScale=e.get('directionVelocityScale',0),
            blend=e.get('blendMode',0),renderOrder=e.get('pass',0),importance=e.get('importance'),miscRenderFlags=e.get('miscRenderFlags',0),meshRenderFlags=e.get('meshRenderFlags',0),
            noCull=bool(e.get('disableBackfaceCull',False)),alphaRef=e.get('alphaRef',5)/255,depthBias=e.get('depthBiasFactors',[0,0]),
            erosion=erosion,distortion=distortion,reflection=reflection,palette=palette,soft=soft,sourceFields=sorted(e))
        assert len(p['shape']['angles'])==len(p['shape']['axes'])
        assert p['rate']['times']==[0] and len(p['rate']['values'])==1
        profiles.append(p)
assert len(profiles)==30 and len(disabled)==20
def peak(v):
    base=max(x[0] for x in v['values'])
    if base<0:return math.inf
    p=v['probabilities'][0] if v['probabilities'] else None
    return base*(max(p['values'] or [p['single']]) if p else 1)
def burst_end(role):
    ends=[]
    for p in profiles:
        if p['role']!=role:continue
        delay=max(1,math.ceil(p['delay']*60-1e-5));rate=p['rate']['values'][0][0]
        count=max(1,math.floor(math.floor(p['emitterLife']*60)*rate/60)) if not p['single'] else 1
        last=delay+(math.ceil(count*60/rate)-1 if not p['single'] and count>1 else 0)
        ends.append(last+peak(p['life'])*60)
    return 1+math.ceil(max(ends))
presentation=dict(initialTailTicks=2+math.ceil(max(peak(p['life']) if math.isfinite(peak(p['life'])) else p['linger'] for p in profiles if p['role']=='buff-initial')*60),
    extendedTailTicks=2+math.ceil(max(peak(p['life']) if math.isfinite(peak(p['life'])) else p['linger'] for p in profiles if p['role']=='buff-extended')*60),
    missHistoryTicks=burst_end('cast-miss'),hitHistoryTicks=burst_end('cast-hit'),targetHistoryTicks=burst_end('target'))
out=dict(systems=systems,profiles=profiles,disabled=disabled)
raw=(json.dumps(out,indent=2)+'\n').encode();path=Path('src/content/leona-w-particles.json')
if '--check' in sys.argv:assert path.read_bytes()==raw
elif not path.exists() or path.read_bytes()!=raw:path.write_bytes(raw)
presentation['profileSha256']=sha(raw)
timing_raw=(json.dumps(presentation,indent=2)+'\n').encode();timing_path=Path('src/content/leona-w-presentation.json')
if '--check' in sys.argv:assert timing_path.read_bytes()==timing_raw
elif not timing_path.exists() or timing_path.read_bytes()!=timing_raw:timing_path.write_bytes(timing_raw)
audit=dict(sourcePinSha256=sha(pin_path.read_bytes()),decodedAssetsSha256=sha(decoded_path.read_bytes()),readerPinSha256=sha(reader_path.read_bytes()),
    output=dict(path=str(path),bytes=len(raw),sha256=sha(raw)),fieldRoutes=routes,
    compiled=[dict(system=p['system'],index=p['index'],fields=p['sourceFields']) for p in profiles],
    disabled=[dict(system=p['system'],index=p['index']) for p in disabled],
    localChoices=['A negative particle lifetime is phase-owned and finite after stop; the external reader otherwise retires it immediately.',
      'Emission samples deterministic rate curves; retained rate probability tables do not consume World RNG.',
      'Collision diameter supplies bound-object scale and offset.',
      'Absent palette/global textures remain unbound; no replacement image is invented.'],
    presentation=presentation,nativeCpuVerified=False)
audit_raw=(json.dumps(audit,indent=2)+'\n').encode();audit_path=Path('docs/reference/leona-w-particle-profiles.json')
if '--check' in sys.argv:assert audit_path.read_bytes()==audit_raw
elif not audit_path.exists() or audit_path.read_bytes()!=audit_raw:audit_path.write_bytes(audit_raw)
print(json.dumps(dict(result='passed',enabled=len(profiles),disabled=len(disabled),bytes=len(raw),nativeCpuVerified=False)))
