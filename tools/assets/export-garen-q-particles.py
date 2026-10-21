"""Derive the explicitly animation-bound Q weapon trail without inventing dispatch."""
from pathlib import Path
import hashlib
import json
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
deferred=[]
for key,r in pin['resources'].items():
    for i,emitter in enumerate(r['definition'].get('complexEmitterDefinitionData',[])):
        if key==system:continue
        reason=('scene distortion' if 'distortionDefinition' in emitter else
            'dispatch unverified' if key=='Garen_Q_mis_axis_01' else
            'recipient size/atlas/stop integration' if key=='Garen_Q_Silence' else
            'appearance, attachment and dispatch integration pending')
        deferred.append(dict(system=key,index=i,reason=reason))
assert len(deferred)==30
write_changed(Path('docs/reference/garen-q-particle-profiles.json'),dict(
    sourcePinSha256=sha(pin_path.read_bytes()),decodedAssetsSha256=sha(asset_path.read_bytes()),
    defaultsEvidenceSha256=sha(default_path.read_bytes()),output=dict(path=str(output),sha256=sha(output.read_bytes())),
    implemented=[dict(system=system,index=0)],deferred=deferred,
    emptySystems=['Garen_Q_Buf'],
    status='One animation-bound weapon mesh reconstructed. Local timing, heading and hard-stop policy; native parity unverified.'))
print('Exported Q weapon trail and explicit accounting for thirty deferred emitter records.')
