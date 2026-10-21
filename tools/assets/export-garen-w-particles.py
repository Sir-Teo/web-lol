"""Derive Courage cast/ground playback from its complete verified source set.

Other systems retain explicit deferred reasons, not guessed primitive fallbacks.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image
sha=lambda b:hashlib.sha256(b).hexdigest()
pin_path=Path('docs/reference/garen-w-particles.json')
pin=json.loads(pin_path.read_text())
assets=json.loads(Path('docs/reference/garen-w-particles-decoded.json').read_text())
assert assets['sourcePinSha256']==sha(pin_path.read_bytes())
defaults_path=Path('docs/reference/garen-spin-defaults.json')
defaults=json.loads(defaults_path.read_text())['defaults']
textures={t['source']['path']:t['path'].removeprefix('public/') for t in assets['textures']}
meshes={s['path']:m['output']['path'].removeprefix('/') for m in assets['meshes'] for s in m['sourceAliases']}
for t in assets['textures']:assert sha(Path(t['path']).read_bytes())==t['sha256']
for m in assets['meshes']:assert sha(Path('public'+m['output']['path']).read_bytes())==m['output']['sha256']
def vector(v): return v if isinstance(v, list) else [v]
def birth(value, fallback):
    if isinstance(value, list): value = {'constantValue': value}
    dynamics = value.get('dynamics')
    if dynamics: assert dynamics['times'] == [0] and len(dynamics['values']) == 1
    return dict(value=vector(dynamics['values'][0] if dynamics else value.get('constantValue', fallback)),
        probabilities=[dict(times=t.get('keyTimes', []), values=t.get('keyValues', []), single=t.get('singleValue', 1))
            for t in dynamics.get('probabilityTables', [])] if dynamics else None)
def curve(value, fallback):
    dynamics = value.get('dynamics')
    if dynamics:
        for t in dynamics.get('probabilityTables', []):
            assert not t.get('keyTimes') and not t.get('keyValues') and t.get('singleValue', 1) == 1
        return dict(times=dynamics['times'], values=[vector(v) for v in dynamics['values']])
    return dict(times=[0], values=[vector(value.get('constantValue', fallback))])
profiles=[];deferred=[]
for key, resource in sorted(pin['resources'].items(), key=lambda item: ({'Garen_W_Cas':0,'Garen_W_Buff':1}.get(item[0],2),item[0])):
    for index,e in enumerate(resource['definition']['complexEmitterDefinitionData']):
        reason = ('character material/attached-skin rendering' if 'Avatar' in key else
                  'shoulder attachment and dispatch' if 'Shoulder' in key else
                  'deflection event history and dispatch' if key=='Garen_W_Deflect' else
                  'minimal declaration without rate, texture or particle lifetime' if 'texture' not in e else None)
        if reason:
            deferred.append(dict(system=key,index=index,reason=reason));continue
        assert key in ['Garen_W_Cas','Garen_W_Buff']
        shape=e.get('SpawnShape',{});primitive=e.get('primitive',{}).get('__type')
        assert primitive in [None,'VfxPrimitiveArbitraryQuad','VfxPrimitiveMesh']
        assert e.get('bindWeight',{}).get('constantValue')==1
        assert not any(k in e for k in ['worldAcceleration','birthDrag','textureMult'])
        assert e.get('frameRate',0)==0 and e.get('blendMode',0) in [0,1,4]
        profiles.append(dict(system=key,role='cast' if key=='Garen_W_Cas' else 'buff',index=index,name=e['emitterName'],
            kind='mesh' if primitive=='VfxPrimitiveMesh' else 'quad' if primitive else 'billboard',
            mesh=meshes[e['primitive']['mMesh']['mSimpleMeshName'].lower()] if primitive=='VfxPrimitiveMesh' else None,
            texture=textures[e['texture'].lower()],lookup=textures[e['particleColorTexture'].lower()] if 'particleColorTexture' in e else None,
            rate=e['rate']['constantValue'],single=bool(e.get('isSingleParticle',False)),
            delay=e.get('timeBeforeFirstEmission',0),emitterLife=e.get('lifetime'),
            linger=e.get('particleLinger',0),lingerType=e.get('particleLingerType',0),life=birth(e['particleLifetime'],3),
            size=birth(e.get('birthScale0',{}),defaults['birthScale']),rotation=birth(e.get('birthRotation0',{}),[0,0,0]),
            angularVelocity=birth(e.get('birthRotationalVelocity0',{}),[0,0,0]),velocity=birth(e.get('birthVelocity',{}),[0,0,0]),
            position=birth(e.get('EmitterPosition',{}),[0,0,0]),spawnOffset=birth(shape.get('emitOffset',{}),[0,0,0]),
            spawnAngles=[birth(v,0) for v in shape.get('emitRotationAngles',[])],spawnAxes=shape.get('emitRotationAxes',[]),
            scale=curve(e.get('scale0',{}),[1,1,1]),color=curve(e.get('Color',{}),[1,1,1,1]),
            uniform=bool(e.get('isUniformScale',False)),local=bool(e.get('isLocalOrientation',True)),
            scroll=birth(e.get('birthUvScrollRate',{}),[0,0]),uvOffset=birth(e.get('birthUVOffset',{}),[0,0]),
            lookupTypes=[e.get('colorLookUpTypeX',1),e.get('colorLookUpTypeY',0)],
            lookupScales=e.get('colorLookUpScales',[1,1]),lookupOffsets=e.get('colorLookUpOffsets',[0,0]),
            blend=e.get('blendMode',0),alphaRef=e.get('alphaRef',0),renderOrder=e.get('pass',0),uvMode=e.get('uvMode',0),
            miscRenderFlags=e.get('miscRenderFlags',0)))
assert len(profiles)==7 and len(deferred)==13
path=Path('src/content/garen-w-particles.json');path.write_text(json.dumps(profiles,indent=2)+'\n')
audit=dict(sourcePinSha256=sha(pin_path.read_bytes()),decodedAssetsSha256=sha(Path('docs/reference/garen-w-particles-decoded.json').read_bytes()),
    defaultsEvidenceSha256=sha(defaults_path.read_bytes()),output=dict(path=str(path),sha256=sha(path.read_bytes())),
    implemented=[dict(system=p['system'],index=p['index']) for p in profiles],deferred=deferred)
# Independently pinned PNG texels for the live RGBA material's GPU checks.
samples=[]
for index,at,lookup_at in [(0,[103,34],[40,64]),(2,[252,66],[75,64]),(5,[432,239],None),(6,[401,246],[32,32])]:
    p=profiles[index];image=Image.open('public/'+p['texture']).convert('RGBA')
    lookup=Image.open('public/'+p['lookup']).convert('RGBA') if p['lookup'] else None
    samples.append(dict(profileIndex=index,sourceUv=[(at[0]+0.5)/image.width,(at[1]+0.5)/image.height],
        lookupUv=[(lookup_at[0]+0.5)/lookup.width,(lookup_at[1]+0.5)/lookup.height] if lookup else [0.5,0.5],
        tint=[0.6,0.8,0.4,0.7],sourceRgba=list(image.getpixel(tuple(at))),lookupRgba=list(lookup.getpixel(tuple(lookup_at))) if lookup else [255]*4))
audit['gpuSamples']=samples
Path('docs/reference/garen-w-particle-profiles.json').write_text(json.dumps(audit,indent=2)+'\n')
print('Exported seven Courage cast/ground layers; thirteen other declarations remain explicitly deferred.')
