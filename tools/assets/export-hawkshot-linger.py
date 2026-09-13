"""Prepare every lingering Hawkshot emitter and verify its complete texture dependency set."""
from pathlib import Path
from io import BytesIO
import hashlib, json
from PIL import Image
from cdtb.export import TexConverter

hash_bytes = lambda b: hashlib.sha256(b).hexdigest()
path = Path('docs/reference/hawkshot-effects.json')
source = json.loads(path.read_text())
record = 'Characters/Ashe/Skins/Skin0/Particles/Ashe_Base_E_tar_linger'
emitters = source['records'][record]['data']['complexEmitterDefinitionData']
assert [e['emitterName'] for e in emitters] == ['Aurora', 'Snow01', 'Snow02', 'Sparkle']
assert all(e['blendMode'] == 4 for e in emitters)

textures = []
for name, source_name in [('hawkshot-linger-multiply', emitters[0]['textureMult']['textureMult']),
                           ('hawkshot-linger-sparkle', emitters[3]['texture'])]:
    entry = next(f for f in source['extraction']['files'] if f['path'] == source_name.lower())
    raw = (Path('.cache/hawkshot-sources') / entry['path']).read_bytes()
    assert len(raw) == entry['bytes'] and hash_bytes(raw) == entry['sha256']
    im = Image.open(BytesIO(TexConverter.tex_to_dds(raw))).convert('RGBA')
    out = Path('public/assets/effects') / (name + '.png')
    im.save(out)
    assert Image.open(out).convert('RGBA').tobytes() == im.tobytes()
    textures.append(dict(path=str(out), source=entry, dimensions=list(im.size), bytes=out.stat().st_size,
        sha256=hash_bytes(out.read_bytes()), rgbaSha256=hash_bytes(im.tobytes()),
        channelExtrema=[list(x) for x in im.getextrema()], playbackColorSpace=None))

sprites = json.loads(Path('docs/reference/hawkshot-sprites.json').read_text())
reused = [t for t in sprites['textures'] if t['path'].endswith(('hawkshot-smoke.png', 'hawkshot-dust.png'))]
for t in reused:
    assert hash_bytes(Path(t['path']).read_bytes()) == t['sha256']
wind = json.loads(Path('public/assets/models/hawkshot-wind.json').read_text())
erosion = next(t for t in wind['textures'] if t['name'] == 'erosion')
alias = next(f for f in source['extraction']['files'] if f['path'] == emitters[0]['alphaErosionDefinition']['erosionMapName'].lower())
base = next(f for f in wind['sources'] if f['path'] == erosion['source'])
assert alias['sha256'] == base['sha256'] and alias['bytes'] == base['bytes']
assert hash_bytes(Path('public'+erosion['output']).read_bytes()) == erosion['pngSha256']

profiles = []
for e in emitters:
    lifetime = e['particleLifetime']
    # Animated birth values take precedence; Aurora omits constantValue entirely.
    base_life = lifetime.get('dynamics', {}).get('values', [lifetime.get('constantValue')])[0]
    life_range = lifetime['dynamics']['probabilityTables'][0]['keyValues']
    duration = e['lifetime']
    single = bool(e.get('isSingleParticle', False))
    max_life = base_life * max(life_range)
    profiles.append(dict(name=e['emitterName'], rate=e['rate']['constantValue'], singleParticle=e.get('isSingleParticle'),
        emitterDuration=duration, particleLife=base_life, lifeRange=life_range,
        maximumActiveTailSeconds=max_life, uncappedEndUpperBoundSeconds=(0 if single else duration)+max_life,
        shape=e['SpawnShape'], velocity=e.get('birthVelocity'), orbitalVelocity=e.get('birthOrbitalVelocity'),
        acceleration=e.get('worldAcceleration'), drag=e.get('birthDrag'), rotation=e.get('birthRotation0'),
        rotationalVelocity=e.get('birthRotationalVelocity0'), scale=e['birthScale0'], scaleCurve=e.get('scale0'),
        uniformScale=e.get('isUniformScale'), directionOriented=e.get('isDirectionOriented'),
        color=e['Color'], texture=e['texture'], atlas=e.get('texDiv'), frames=e.get('numFrames'),
        textureMult=e.get('textureMult'), erosion=e.get('alphaErosionDefinition')))
result = dict(definitionsSha256=hash_bytes(path.read_bytes()), record=record, emitters=emitters, profiles=profiles,
    newTextures=textures, reusedTextures=reused,
    erosionAlias=dict(source=alias, identicalSource=base, path='public'+erosion['output'], sha256=erosion['pngSha256']),
    unresolved=['Effect start and stop lifecycle relative to vision expiry', 'Native particle shutdown versus authored active tail',
        'Texture-multiply UV domain, addressing, channels and color space', 'Cylinder flag 1 and spawn distribution',
        'Orbital integration and direction-oriented rotation interaction'])
Path('docs/reference/hawkshot-linger.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps([dict(path=t['path'], dimensions=t['dimensions'], bytes=t['bytes']) for t in textures]))
