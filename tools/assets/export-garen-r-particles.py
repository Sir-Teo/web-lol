"""Derive R playback profiles from the verified source records and decoded assets.

Defaults match the pinned reader used by the existing particle adapters. Runtime
cadence, motion and attachment policies remain separately documented.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image

sha = lambda b: hashlib.sha256(b).hexdigest()
pin_path = Path('docs/reference/garen-r-particles.json')
pin = json.loads(pin_path.read_text())
assets = json.loads(Path('docs/reference/garen-r-particles-decoded.json').read_text())
assert assets['sourcePinSha256'] == sha(pin_path.read_bytes())
defaults = json.loads(Path('docs/reference/garen-spin-defaults.json').read_text())
textures = {t['source']['path']: t['path'].removeprefix('public/') for t in assets['textures']}
meshes = {m['source']['path']: m['output']['path'].removeprefix('/') for m in assets['meshes']}
for t in assets['textures']: assert sha(Path(t['path']).read_bytes()) == t['sha256']
for m in assets['meshes']: assert sha(Path('public'+m['output']['path']).read_bytes()) == m['output']['sha256']
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
profiles = []
for key, role in [('Garen_R_Cas','cast'),('Garen_R_Sword_Tar','sword'),('Garen_R_Tar_Impact','impact')]:
    for index, e in enumerate(pin['resources'][key]['definition']['complexEmitterDefinitionData']):
        shape = e.get('SpawnShape', {})
        primitive = e.get('primitive', {}).get('__type')
        mult = e.get('textureMult')
        assert e.get('frameRate', 0) == 0
        assert e.get('blendMode', 0) in [0, 1, 4]
        assert primitive in [None, 'VfxPrimitiveMesh', 'VfxPrimitiveArbitraryQuad']
        profiles.append(dict(role=role, index=index, name=e['emitterName'],
            deferred='scene distortion requires a separate verified render pass' if 'distortionDefinition' in e else None,
            kind='mesh' if primitive=='VfxPrimitiveMesh' else 'quad' if primitive else 'billboard',
            mesh=meshes[e['primitive']['mMesh']['mSimpleMeshName'].lower()] if primitive=='VfxPrimitiveMesh' else None,
            texture=textures[e['texture'].lower()], lookup=textures[e['particleColorTexture'].lower()] if 'particleColorTexture' in e else None,
            multiplier=textures[mult['textureMult'].lower()] if mult else None,
            rate=e['rate']['constantValue'], single=bool(e.get('isSingleParticle',False)),
            delay=e.get('timeBeforeFirstEmission',0), emitterLife=e['lifetime'],
            linger=e.get('particleLinger',0), life=birth(e['particleLifetime'],3),
            size=birth(e.get('birthScale0',{}),defaults['defaults']['birthScale']),
            rotation=birth(e.get('birthRotation0',{}),[0,0,0]),
            angularVelocity=birth(e.get('birthRotationalVelocity0',{}),[0,0,0]),
            velocity=birth(e.get('birthVelocity',{}),[0,0,0]),
            acceleration=birth(e.get('worldAcceleration',{}),[0,0,0]),
            drag=birth(e.get('birthDrag',{}),[0,0,0]),
            position=birth(e.get('EmitterPosition',{}),[0,0,0]),
            spawnOffset=birth(shape.get('emitOffset',{}),[0,0,0]),
            spawnAngles=[birth(v,0) for v in shape.get('emitRotationAngles',[])], spawnAxes=shape.get('emitRotationAxes',[]),
            scale=curve(e.get('scale0',{}),[1,1,1]), color=curve(e.get('Color',{}),[1,1,1,1]),
            uniform=bool(e.get('isUniformScale',False)), direction=bool(e.get('isDirectionOriented',False)),
            local=bool(e.get('isLocalOrientation',True)),
            scroll=birth(e.get('birthUvScrollRate',{}),[0,0]), uvOffset=birth(e.get('birthUVOffset',{}),[0,0]),
            multScroll=birth(mult.get('birthUvScrollRateMult',{}) if mult else {},[0,0]),
            lookupTypes=[e.get('colorLookUpTypeX',1),e.get('colorLookUpTypeY',0)],
            lookupScales=e.get('colorLookUpScales',[1,1]), lookupOffsets=e.get('colorLookUpOffsets',[0,0]),
            atlas=dict(grid=e.get('texDiv',[1,1]),frames=e.get('numFrames',1),start=e.get('startFrame',0),random=bool(e.get('isRandomStartFrame',False))),
            blend=e.get('blendMode',0), alphaRef=e.get('alphaRef',0), renderOrder=e.get('pass',0), uvMode=e.get('uvMode',0)))
assert len(profiles)==17 and sum(p['deferred'] is None for p in profiles)==16
path=Path('src/content/garen-r-particles.json');path.write_text(json.dumps(profiles,indent=2)+'\n')
audit=dict(sourcePinSha256=assets['sourcePinSha256'], defaultsEvidenceSha256=sha(Path('docs/reference/garen-spin-defaults.json').read_bytes()),
    output=dict(path=str(path),sha256=sha(path.read_bytes())), implemented=[dict(role=p['role'], index=p['index']) for p in profiles if p['deferred'] is None],
    deferred=[dict(role=p['role'], index=p['index'],reason=p['deferred']) for p in profiles if p['deferred']])
# Independent PNG texels for GPU verification of the new UV paths.
def pixel(path, at): return list(Image.open('public/'+path).convert('RGBA').getpixel(tuple(at)))
gpu_samples=[]
for age, source_at, mult_at, tint in [
    (0.3125,[128,320],[128,192],[0.4,0.7,0.3,0.5]),
    (0.625,[128,400],[128,144],[0.8,0.3,0.5,0.7]),
]:
    p=profiles[4]
    gpu_samples.append(dict(profileIndex=4, rawUv=[128.5/256,240.5/512], scale=[1,1],
        sourceOffset=[v*age for v in p['scroll']['value']], multiplierOffset=[v*age for v in p['multScroll']['value']],
        tint=tint, sourcePixel=source_at, multiplierPixel=mult_at,
        sourceRgba=pixel(p['texture'],source_at), lookupRgba=[255]*4, multiplierRgba=pixel(p['multiplier'],mult_at)))
p=profiles[10]
gpu_samples.append(dict(profileIndex=10,rawUv=[(180.5/256-0.5)*2,(203.5/256-0.5)*2],scale=[0.5,0.5],
    sourceOffset=[0.5,0.5],multiplierOffset=[0,0],tint=[0.5,0.6,0.7,0.8],sourcePixel=[180,203],
    sourceRgba=pixel(p['texture'],[180,203]),lookupRgba=pixel(p['lookup'],[4,4]),multiplierRgba=[255]*4))
audit['gpuSamples']=gpu_samples
Path('docs/reference/garen-r-particle-profiles.json').write_text(json.dumps(audit,indent=2)+'\n')
print('Exported 17 R playback profiles; 16 visual layers selected, distortion separately deferred.')
