"""Derive Q profiles from frozen source; local dispatch is documented separately."""
from pathlib import Path
import hashlib
import json
import math
sha=lambda b:hashlib.sha256(b).hexdigest()
def write_changed(path, value):
    raw=(json.dumps(value,indent=2)+'\n').encode()
    if not path.exists() or path.read_bytes()!=raw:path.write_bytes(raw)
pin_path=Path('docs/reference/garen-q-particles.json')
pin=json.loads(pin_path.read_text())
asset_path=Path('docs/reference/garen-q-particles-decoded.json')
assets=json.loads(asset_path.read_text())
assert assets['sourcePinSha256']==sha(pin_path.read_bytes())
default_path=Path('docs/reference/garen-spin-defaults.json')
defaults=json.loads(default_path.read_text())['defaults']
system='Garen_Q_Sword_Trail'
e,=pin['resources'][system]['definition']['complexEmitterDefinitionData']
assert set(e)=={'rate','particleLifetime','lifetime','isSingleParticle','emitterName','bindWeight',
    'EmitterPosition','primitive','particleColorTexture','blendMode','disableBackfaceCull',
    'birthRotation0','birthScale0','texture','birthUvScrollRate','__type'}
event=assets['animationParticleEvents']['Spell1:{e35b3364}']
assert event['mEffectKey']==system and event['mStartFrame']==8 and not event['mIsLoop']
binding,=event['mParticleEventDataPairList']
assert binding['mBoneName']=='C_Buffbone_Glb_Center_Loc'
assert e['primitive']['__type']=='VfxPrimitiveMesh' and e['isSingleParticle']==1
assert e['bindWeight']['constantValue']==1 and e['blendMode']==4 and e['disableBackfaceCull']
for field in ['textureMult','worldAcceleration','birthDrag','particleLinger','particleIsLocalOrientation','Color','scale0']:
    assert field not in e, field
texture=lambda path:next(t for t in assets['textures'] if t['source']['path']==path.lower())
base=texture(e['texture']);lookup=texture(e['particleColorTexture'])
mesh=next(m for m in assets['meshes'] if m['source']['path']==e['primitive']['mMesh']['mSimpleMeshName'].lower())
for t in [base,lookup]: assert sha(Path(t['path']).read_bytes())==t['sha256']
assert sha(Path('public'+mesh['output']['path']).read_bytes())==mesh['output']['sha256']
profile=dict(system=system,index=0,name=e['emitterName'],bone=binding['mBoneName'],startFrame=event['mStartFrame'],
    mesh=mesh['output']['path'].removeprefix('/'),texture=base['path'].removeprefix('public/'),lookup=lookup['path'].removeprefix('public/'),
    count=int(e['rate']['constantValue']),life=e['particleLifetime']['constantValue'],emitterLife=e['lifetime'],
    position=e['EmitterPosition']['constantValue'],rotation=e['birthRotation0']['constantValue'],
    scale=e['birthScale0']['constantValue'],scroll=e['birthUvScrollRate']['constantValue'],
    color=defaults['color'],lookupTypes=defaults['lookupTypes'],lookupScales=defaults['lookupScales'],lookupOffsets=defaults['lookupOffsets'],
    blend=e['blendMode'],doubleSided=e['disableBackfaceCull'])
output=Path('src/content/garen-q-particles.json');write_changed(output,profile)
# Activation/sword appearance profiles. Every selected field is retained or asserted.
reader_path=Path('docs/reference/garen-q-cast-reader.json')
reader=json.loads(reader_path.read_text())
for f in reader['files']:
    cached=Path('.cache/garen-q-cast-readers')/f['name'];cached.parent.mkdir(exist_ok=True)
    if not cached.exists():
        import urllib.request
        cached.write_bytes(urllib.request.urlopen(f['url'],timeout=30).read())
    assert sha(cached.read_bytes())==f['sha256']
def vector(value):return value if isinstance(value,list) else [value]
def birth(value,fallback):
    if isinstance(value,list):value={'constantValue':value}
    dynamics=value.get('dynamics')
    if dynamics:assert dynamics['times']==[0] and len(dynamics['values'])==1
    return dict(value=vector(dynamics['values'][0] if dynamics else value.get('constantValue',fallback)),
        probabilities=[dict(times=t.get('keyTimes',[]),values=t.get('keyValues',[]),single=t.get('singleValue',1))
            for t in dynamics.get('probabilityTables',[])] if dynamics else None)
def curve(value,fallback):
    dynamics=value.get('dynamics')
    if dynamics:
        for t in dynamics.get('probabilityTables',[]):
            assert not t.get('keyTimes') and not t.get('keyValues') and t.get('singleValue',1)==1
        return dict(times=dynamics['times'],values=[vector(v) for v in dynamics['values']])
    return dict(times=[0],values=[vector(value.get('constantValue',fallback))])
textures={t['source']['path']:t['path'].removeprefix('public/') for t in assets['textures']}
meshes={m['source']['path']:m['output']['path'].removeprefix('/') for m in assets['meshes']}
cast=[]
for key in ['Garen_Q_Cas','Garen_Q_Cas_Sword']:
    for index,e in enumerate(pin['resources'][key]['definition']['complexEmitterDefinitionData']):
        shape=e.get('SpawnShape',{});primitive=e.get('primitive',{}).get('__type');mult=e.get('textureMult')
        assert primitive in [None,'VfxPrimitiveArbitraryQuad','VfxPrimitiveMesh']
        assert e['bindWeight']['constantValue']==1
        assert not any(k in e for k in ['worldAcceleration','birthDrag','distortionDefinition','birthColor'])
        assert e.get('particleLingerType',0)==0 and e.get('frameRate',0)==0
        assert e.get('blendMode',0) in [0,2,4]
        if mult:assert set(mult)=={'birthUvScrollRateMult','__type'} # No named multiplier texture.
        cast.append(dict(system=key,index=index,name=e['emitterName'],role='activation' if key=='Garen_Q_Cas' else 'armed',
            kind='mesh' if primitive=='VfxPrimitiveMesh' else 'quad' if primitive else 'billboard',
            mesh=meshes[e['primitive']['mMesh']['mSimpleMeshName'].lower()] if primitive=='VfxPrimitiveMesh' else None,
            texture=textures[e['texture'].lower()],lookup=textures[e['particleColorTexture'].lower()] if e.get('particleColorTexture') else None,
            multiplier=None,multiplierDeclared=mult is not None,multScroll=birth(mult.get('birthUvScrollRateMult',{}) if mult else {},[0,0]),
            rate=e['rate']['constantValue'],single=bool(e.get('isSingleParticle',False)),
            delay=e.get('timeBeforeFirstEmission',0),emitterLife=e.get('lifetime'),emitterLinger=e.get('emitterLinger',0),
            linger=e.get('particleLinger',0),lingerType=e.get('particleLingerType',0),life=birth(e['particleLifetime'],3),
            size=birth(e.get('birthScale0',{}),defaults['birthScale']),rotation=birth(e.get('birthRotation0',{}),[0,0,0]),
            angularVelocity=birth(e.get('birthRotationalVelocity0',{}),[0,0,0]),velocity=birth(e.get('birthVelocity',{}),[0,0,0]),
            position=birth(e.get('EmitterPosition',{}),[0,0,0]),spawnOffset=birth(shape.get('emitOffset',{}),[0,0,0]),
            scale=curve(e.get('scale0',{}),[1,1,1]),color=curve(e.get('Color',{}),[1,1,1,1]),
            uniform=bool(e.get('isUniformScale',False)),local=bool(e.get('isLocalOrientation',True)),
            particleLocal=bool(e.get('particleIsLocalOrientation',False)),scroll=birth(e.get('birthUvScrollRate',{}),[0,0]),
            lookupTypes=[e.get('colorLookUpTypeX',1),e.get('colorLookUpTypeY',0)],lookupScales=e.get('colorLookUpScales',[1,1]),lookupOffsets=e.get('colorLookUpOffsets',[0,0]),
            atlas=dict(grid=e.get('texDiv',[1,1]),frames=e.get('numFrames',1),start=e.get('startFrame',0),random=bool(e.get('isRandomStartFrame',False))),
            blend=e.get('blendMode',0),renderOrder=e.get('pass',0),uvMode=e.get('uvMode',0),miscRenderFlags=e.get('miscRenderFlags',0),
            explicitFields=sorted(e)))
assert len(cast)==8
cast_path=Path('src/content/garen-q-cast-particles.json');write_changed(cast_path,cast)
impact_reader_path=Path('docs/reference/garen-q-impact-reader.json')
impact_reader=json.loads(impact_reader_path.read_text())
assert impact_reader['baseEvidenceSha256']==sha(reader_path.read_bytes())
for f in impact_reader['files']:
    cached=Path('.cache/garen-q-cast-readers')/f['name']
    if not cached.exists():
        import urllib.request
        cached.write_bytes(urllib.request.urlopen(f['url'],timeout=30).read())
    assert sha(cached.read_bytes())==f['sha256']
impact=[]
for index,e in enumerate(pin['resources']['Garen_Q_Tar']['definition']['complexEmitterDefinitionData']):
    if 'distortionDefinition' in e:continue
    shape=e.get('SpawnShape',{});primitive=e.get('primitive',{}).get('__type')
    assert primitive in [None,'VfxPrimitiveArbitraryQuad','VfxPrimitiveMesh','VfxPrimitiveRay']
    assert e.get('blendMode',0) in [0,4]
    assert set(e)<=set(['rate','particleLifetime','particleLinger','lifetime','isSingleParticle','emitterName',
        'birthVelocity','bindWeight','SpawnShape','EmitterPosition','primitive','particleColorTexture','Color',
        'disableBackfaceCull','particleIsLocalOrientation','isRandomStartFrame','birthRotation0','birthScale0',
        'scale0','texture','numFrames','startFrame','texDiv','blendMode','pass','colorLookUpTypeY',
        'isDirectionOriented','directionVelocityScale','__type'])
    assert e.get('bindWeight',{}).get('constantValue',0) in [0,1]
    assert set(shape)<=set(['emitOffset','emitRotationAngles','emitRotationAxes','__type'])
    impact.append(dict(system='Garen_Q_Tar',index=index,name=e['emitterName'],
        kind='mesh' if primitive=='VfxPrimitiveMesh' else 'ray' if primitive=='VfxPrimitiveRay' else 'quad' if primitive else 'billboard',
        mesh=meshes[e['primitive']['mMesh']['mSimpleMeshName'].lower()] if primitive=='VfxPrimitiveMesh' else None,
        texture=textures[e['texture'].lower()],lookup=textures[e['particleColorTexture'].lower()] if e.get('particleColorTexture') else None,
        rate=e['rate']['constantValue'],single=bool(e.get('isSingleParticle',False)),emitterLife=e['lifetime'],
        linger=e.get('particleLinger',0),life=birth(e['particleLifetime'],3),
        velocity=birth(e.get('birthVelocity',{}),[0,0,0]),position=birth(e.get('EmitterPosition',{}),[0,0,0]),
        spawnOffset=birth(shape.get('emitOffset',{}),[0,0,0]),
        spawnAngles=[birth(v,0) for v in shape.get('emitRotationAngles',[])],spawnAxes=shape.get('emitRotationAxes',[]),
        size=birth(e.get('birthScale0',{}),defaults['birthScale']),rotation=birth(e.get('birthRotation0',{}),[0,0,0]),
        scale=curve(e.get('scale0',{}),[1,1,1]),color=curve(e.get('Color',{}),[1,1,1,1]),
        direction=bool(e.get('isDirectionOriented',False)),directionScale=e.get('directionVelocityScale',0),directionMinScale=1,
        local=e.get('isLocalOrientation',True),particleLocal=bool(e.get('particleIsLocalOrientation',False)),
        bindWeight=e.get('bindWeight',{}).get('constantValue'),
        lookupTypes=[e.get('colorLookUpTypeX',1),e.get('colorLookUpTypeY',0)],lookupScales=e.get('colorLookUpScales',[1,1]),lookupOffsets=e.get('colorLookUpOffsets',[0,0]),
        atlas=dict(grid=e.get('texDiv',[1,1]),frames=e.get('numFrames',1),start=e.get('startFrame',0),random=bool(e.get('isRandomStartFrame',False))),
        blend=e.get('blendMode',0),renderOrder=e.get('pass',0),miscRenderFlags=e.get('miscRenderFlags',0),explicitFields=sorted(e)))
assert len(impact)==7
impact_path=Path('src/content/garen-q-impact-particles.json');write_changed(impact_path,impact)
ground_reader_path=Path('docs/reference/garen-q-ground-reader.json')
ground_reader=json.loads(ground_reader_path.read_text())
assert ground_reader['castEvidenceSha256']==sha(reader_path.read_bytes())
assert ground_reader['impactEvidenceSha256']==sha(impact_reader_path.read_bytes())
for f in ground_reader['files']:
    cached=Path('.cache/garen-q-cast-readers')/f['cacheName']
    if not cached.exists():
        import urllib.request
        cached.write_bytes(urllib.request.urlopen(f['url'],timeout=30).read())
    assert sha(cached.read_bytes())==f['sha256']
ground=[]
for key in ['Garen_Q_Jump','Garen_Q_Land']:
    definition=pin['resources'][key]['definition']
    assert (definition.get('flags',0xd4)&0x100)==0
    binding,=[v for v in assets['animationParticleEvents'].values() if v['mEffectKey']==key]
    assert binding.get('mStartFrame')==(9 if key=='Garen_Q_Land' else None)
    assert 'mBoneName' not in binding['mParticleEventDataPairList'][0]
    for index,e in enumerate(definition['complexEmitterDefinitionData']):
        if 'distortionDefinition' in e:continue
        shape=e.get('SpawnShape',{});primitive=e.get('primitive',{}).get('__type')
        assert e['isSingleParticle']==1 and primitive in [None,'VfxPrimitiveMesh','VfxPrimitiveArbitraryQuad']
        assert e.get('blendMode',0) in [1,2,4] and e.get('uvMode',0) in [0,2]
        assert set(e)<=set(['rate','particleLifetime','particleLinger','lifetime','isSingleParticle','emitterName',
            'birthVelocity','birthDrag','worldAcceleration','EmitterPosition','primitive','particleColorTexture','Color',
            'disableBackfaceCull','birthRotation0','birthScale0','scale0','texture','numFrames','startFrame','texDiv',
            'blendMode','pass','uvMode','birthUvScrollRate','birthUVOffset','SpawnShape','isDirectionOriented',
            'timeBeforeFirstEmission','meshRenderFlags','isUniformScale','isLocalOrientation','__type'])
        ground.append(dict(system=key,index=index,name=e['emitterName'],role='jump' if key=='Garen_Q_Jump' else 'landing',
            eventFrame=binding.get('mStartFrame'),eventBone=binding['mParticleEventDataPairList'][0].get('mBoneName'),
            killEvent=binding['mIsKillEvent'],loop=binding['mIsLoop'],
            kind='mesh' if primitive=='VfxPrimitiveMesh' else 'quad' if primitive else 'billboard',
            mesh=meshes[e['primitive']['mMesh']['mSimpleMeshName'].lower()] if primitive=='VfxPrimitiveMesh' else None,
            texture=textures[e['texture'].lower()],lookup=textures[e['particleColorTexture'].lower()] if e.get('particleColorTexture') else None,
            count=int(e['rate']['constantValue']),delay=e.get('timeBeforeFirstEmission',0),emitterLife=e['lifetime'],
            linger=e.get('particleLinger',0),life=birth(e['particleLifetime'],3),
            velocity=birth(e.get('birthVelocity',{}),[0,0,0]),drag=birth(e.get('birthDrag',{}),[0,0,0]),
            worldAcceleration=birth(e.get('worldAcceleration',{}),[0,0,0]),position=birth(e.get('EmitterPosition',{}),[0,0,0]),
            spawnOffset=birth(shape.get('emitOffset',{}),[0,0,0]),
            spawnAngles=[birth(v,0) for v in shape.get('emitRotationAngles',[])],spawnAxes=shape.get('emitRotationAxes',[]),
            size=birth(e.get('birthScale0',{}),defaults['birthScale']),rotation=birth(e.get('birthRotation0',{}),[0,0,0]),
            scale=curve(e.get('scale0',{}),[1,1,1]),color=curve(e.get('Color',{}),[1,1,1,1]),
            direction=bool(e.get('isDirectionOriented',False)),local=bool(e.get('isLocalOrientation',True)),
            uniform=bool(e.get('isUniformScale',False)),scroll=birth(e.get('birthUvScrollRate',{}),[0,0]),uvOffset=birth(e.get('birthUVOffset',{}),[0,0]),
            lookupTypes=[e.get('colorLookUpTypeX',1),e.get('colorLookUpTypeY',0)],lookupScales=e.get('colorLookUpScales',[1,1]),lookupOffsets=e.get('colorLookUpOffsets',[0,0]),
            atlas=dict(grid=e.get('texDiv',[1,1]),frames=e.get('numFrames',1),start=e.get('startFrame',0),random=bool(e.get('isRandomStartFrame',False))),
            blend=e.get('blendMode',0),renderOrder=e.get('pass',0),uvMode=e.get('uvMode',0),miscRenderFlags=e.get('miscRenderFlags',0),explicitFields=sorted(e)))
assert len(ground)==5
ground_path=Path('src/content/garen-q-ground-particles.json');write_changed(ground_path,ground)
e,=pin['resources']['Garen_Q_Silence']['definition']['complexEmitterDefinitionData']
assert set(e)==set(['rate','particleLifetime','isSingleParticle','emitterName','bindWeight','SpawnShape',
    'FlexShapeDefinition','particleColorTexture','blendMode','pass','meshRenderFlags','miscRenderFlags',
    'isUniformScale','isLocalOrientation','birthScale0','scale0','texture','texDiv','__type'])
assert e['isSingleParticle']==1 and e['rate']['constantValue']==1 and e['bindWeight']['constantValue']==1
assert e['blendMode']==1 and e['miscRenderFlags']==1 and e['isUniformScale']==1 and e['isLocalOrientation']==0
silence=dict(system='Garen_Q_Silence',index=0,name=e['emitterName'],mesh=None,
    texture=textures[e['texture'].lower()],lookup=textures[e['particleColorTexture'].lower()],
    count=1,life=e['particleLifetime']['constantValue'],emitterLife=None,
    offset=e['SpawnShape']['emitOffset'],flexShape=e['FlexShapeDefinition'],bindWeight=e['bindWeight']['constantValue'],
    size=e['birthScale0']['constantValue'],scale=curve(e['scale0'],[1,1,1]),color=defaults['color'],
    local=False,uniform=True,blend=e['blendMode'],renderOrder=e['pass'],miscRenderFlags=e['miscRenderFlags'],
    lookupTypes=defaults['lookupTypes'],lookupScales=defaults['lookupScales'],lookupOffsets=defaults['lookupOffsets'],
    atlas=dict(grid=e['texDiv'],frames=1,start=0,random=False),explicitFields=sorted(e))
silence_path=Path('src/content/garen-q-silence-particles.json');write_changed(silence_path,silence)
selected=[dict(system=system,index=0)]+[dict(system=p['system'],index=p['index']) for p in [*cast,*impact,*ground,silence]]
selected_keys={(p['system'],p['index']) for p in selected}
deferred=[]
for key,r in pin['resources'].items():
    for i,emitter in enumerate(r['definition'].get('complexEmitterDefinitionData',[])):
        if (key,i) in selected_keys:continue
        reason=('scene distortion' if 'distortionDefinition' in emitter else
            'dispatch unverified' if key=='Garen_Q_mis_axis_01' else
            'recipient size/atlas/stop integration' if key=='Garen_Q_Silence' else
            'appearance, attachment and dispatch integration pending')
        deferred.append(dict(system=key,index=i,reason=reason))
assert len(deferred)==9
from PIL import Image
samples=[]
for index,p in enumerate(cast):
    image=Image.open('public/'+p['texture']).convert('RGBA')
    # Pin an independent nontransparent texel; the GPU probes use exact texel centers.
    at=max(((x,y) for y in range(image.height) for x in range(image.width)),
        key=lambda xy:sum(image.getpixel(xy)))
    lookup=Image.open('public/'+p['lookup']).convert('RGBA') if p['lookup'] else None
    lookup_at=[lookup.width//2,lookup.height//2] if lookup else None
    samples.append(dict(profileIndex=index,sourceUv=[(at[0]+0.5)/image.width,(at[1]+0.5)/image.height],
        lookupUv=[(lookup_at[0]+0.5)/lookup.width,(lookup_at[1]+0.5)/lookup.height] if lookup else [0.5,0.5],
        tint=[0.6,0.8,0.4,0.7],sourceRgba=list(image.getpixel(at)),lookupRgba=list(lookup.getpixel(tuple(lookup_at))) if lookup else [255]*4))
    if p['uvMode']==2:
        assert p['kind']=='mesh'
        raw=min(((x,y) for y in range(image.height) for x in range(image.width)),key=lambda xy:abs(image.getpixel(xy)[3]-128))
        assert image.getpixel(raw)[3]==128 and image.getpixel(at)[3]!=128
        samples[-1].update(rawUv=[(raw[0]+0.5)/image.width,(raw[1]+0.5)/image.height],alphaRgba=list(image.getpixel(raw)))
impact_samples=[]
for index,p in enumerate(impact):
    image=Image.open('public/'+p['texture']).convert('RGBA')
    at=max(((x,y) for y in range(image.height) for x in range(image.width)),key=lambda xy:sum(image.getpixel(xy)))
    lookup=Image.open('public/'+p['lookup']).convert('RGBA') if p['lookup'] else None
    lookup_at=[lookup.width//2,lookup.height//2] if lookup else None
    impact_samples.append(dict(profileIndex=index,impact=True,sourceUv=[(at[0]+0.5)/image.width,(at[1]+0.5)/image.height],
        lookupUv=[(lookup_at[0]+0.5)/lookup.width,(lookup_at[1]+0.5)/lookup.height] if lookup else [0.5,0.5],
        tint=[0.6,0.8,0.4,0.7],sourceRgba=list(image.getpixel(at)),lookupRgba=list(lookup.getpixel(tuple(lookup_at))) if lookup else [255]*4))
# Conservative system-age wait plus capped total life, with first-update/interpolation margin.
ground_samples=[]
for index,p in enumerate(ground):
    image=Image.open('public/'+p['texture']).convert('RGBA')
    at=max(((x,y) for y in range(image.height) for x in range(image.width)),key=lambda xy:sum(image.getpixel(xy)))
    raw=min(((x,y) for y in range(image.height) for x in range(image.width)),key=lambda xy:abs(image.getpixel(xy)[3]-128)) if p['uvMode']==2 else at
    if p['uvMode']==2:assert image.getpixel(raw)[3]==128 and image.getpixel(raw)[3]!=image.getpixel(at)[3]
    ground_samples.append(dict(profileIndex=index,impact=False,ground=True,sourceUv=[(at[0]+0.5)/image.width,(at[1]+0.5)/image.height],
        rawUv=[(raw[0]+0.5)/image.width,(raw[1]+0.5)/image.height],lookupUv=[0.5,0.5],
        tint=[0.6,0.8,0.4,0.7],sourceRgba=list(image.getpixel(at)),alphaRgba=list(image.getpixel(raw)),lookupRgba=[255]*4))
image=Image.open('public/'+silence['texture']).convert('RGBA');lookup=Image.open('public/'+silence['lookup']).convert('RGBA')
at=max(((x,y) for y in range(image.height//2) for x in range(image.width//2)),key=lambda xy:sum(image.getpixel(xy)))
silence_samples=[dict(profileIndex=0,silence=True,ground=False,impact=False,
    sourceUv=[(at[0]+0.5)/image.width,(at[1]+0.5)/image.height],lookupUv=[0.5,0.5],tint=[0.6,0.8,0.4,0.7],
    sourceRgba=list(image.getpixel(at)),lookupRgba=list(lookup.getpixel((lookup.width//2,lookup.height//2))))]
def max_life(p):
    tables=p['life']['probabilities']
    factor=max(tables[0]['values'],default=tables[0]['single']) if tables else 1
    return p['life']['value'][0]*factor
cast_tail=max(max_life(p) if p['role']=='activation' else
    min((p['emitterLife'] if p['emitterLife'] is not None else math.inf)+10,max(p['emitterLinger'],0))+
    min(max_life(p),p['life']['value'][0]+10,max(p['linger'],0)) for p in cast)
cast_retention_ticks=math.ceil(cast_tail*60)+2
assert cast_retention_ticks==122
impact_retention_ticks=math.ceil(max(p['emitterLife']+max_life(p) for p in impact)*60)+2
assert impact_retention_ticks==75
ground_retention_ticks=math.ceil(max(p['delay']+max_life(p) for p in ground)*60)+2
assert ground_retention_ticks==99
write_changed(Path('docs/reference/garen-q-particle-profiles.json'),dict(
    sourcePinSha256=sha(pin_path.read_bytes()),decodedAssetsSha256=sha(asset_path.read_bytes()),
    defaultsEvidenceSha256=sha(default_path.read_bytes()),output=dict(path=str(output),sha256=sha(output.read_bytes())),
    castOutput=dict(path=str(cast_path),sha256=sha(cast_path.read_bytes())),readerEvidenceSha256=sha(reader_path.read_bytes()),
    impactOutput=dict(path=str(impact_path),sha256=sha(impact_path.read_bytes())),impactReaderEvidenceSha256=sha(impact_reader_path.read_bytes()),
    groundOutput=dict(path=str(ground_path),sha256=sha(ground_path.read_bytes())),groundReaderEvidenceSha256=sha(ground_reader_path.read_bytes()),
    silenceOutput=dict(path=str(silence_path),sha256=sha(silence_path.read_bytes())),silenceFlexApplied=False,
    implemented=selected,deferred=deferred,emptySystems=['Garen_Q_Buf'],castRetentionBoundTicks=cast_retention_ticks,gpuSamples=samples,
    impactGpuSamples=impact_samples,
    impactRetentionBoundTicks=impact_retention_ticks,
    groundRetentionBoundTicks=ground_retention_ticks,
    groundGpuSamples=ground_samples,
    silenceGpuSamples=silence_samples,
    status='Twenty-two Q emitters locally reconstructed. Silence uses an explicit health-bar anchor; Flex bound-size offset, native dispatch/attachment/rendering parity remain unverified.'))
print('Exported twenty-two Q emitters; nine emitter records and native silence Flex sizing remain deferred.')
