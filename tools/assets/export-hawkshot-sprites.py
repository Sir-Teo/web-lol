"""Losslessly decode the pinned Dust/Smoke_Trail atlases and smoke erosion map."""
from pathlib import Path
from io import BytesIO
import hashlib
import json
from PIL import Image
from cdtb.export import TexConverter

hash_bytes = lambda data: hashlib.sha256(data).hexdigest()
pin_path = Path('docs/reference/hawkshot-effects.json')
pin = json.loads(pin_path.read_text())
record = 'Characters/Ashe/Skins/Skin0/Particles/Ashe_Base_E_mis'
emitters = pin['records'][record]['data']['complexEmitterDefinitionData']
layers = [next(e for e in emitters if e['emitterName'] == name) for name in ['Dust','Smoke_Trail']]
out = Path('public/assets/effects')
out.mkdir(parents=True, exist_ok=True)
textures = []
for name, source, atlas in [('hawkshot-dust', layers[0]['texture'], True),
                             ('hawkshot-smoke', layers[1]['texture'], True),
                             ('hawkshot-smoke-erosion', layers[1]['alphaErosionDefinition']['erosionMapName'], False)]:
    source = source.lower()
    entry = next(f for f in pin['extraction']['files'] if f['path'] == source)
    raw = (Path('.cache/hawkshot-sources') / source).read_bytes()
    assert len(raw) == entry['bytes'] and hash_bytes(raw) == entry['sha256'], source
    im = Image.open(BytesIO(TexConverter.tex_to_dds(raw))).convert('RGBA')
    path = out / f'{name}.png'
    im.save(path)
    assert Image.open(path).convert('RGBA').tobytes() == im.tobytes()
    item = dict(path=str(path), source=entry, dimensions=list(im.size),
                bytes=path.stat().st_size, sha256=hash_bytes(path.read_bytes()),
                rgbaSha256=hash_bytes(im.tobytes()), colorSpace='sRGB' if atlas else 'linear')
    if atlas:
        assert im.width % 2 == im.height % 2 == 0
        item['frames'] = []
        # Top-left row-major cells. Each rectangle is half-open in decoded pixel coordinates.
        for y in range(2):
            for x in range(2):
                box = [x*im.width//2,y*im.height//2,(x+1)*im.width//2,(y+1)*im.height//2]
                frame = im.crop(box)
                item['frames'].append(dict(rect=box,rgbaSha256=hash_bytes(frame.tobytes())))
    textures.append(item)
for e in layers:
    assert e['numFrames'] == 4 and e['texDiv'] == [2,2]
    assert e['isRandomStartFrame'] == 1 and 'frameRate' not in e
    assert e['blendMode'] == 4
    assert e['particleLifetime']['dynamics']['probabilityTables'][0]['keyValues'] == [0.5,1]
assert layers[1]['alphaErosionDefinition']['erosionMapChannelMixer']['constantValue'] == [1,0,0,0]
profiles = []
for e in layers:
    profiles.append(dict(name=e['emitterName'], rate=e['rate']['constantValue'],
        lifetime=e['particleLifetime']['constantValue'], lifetimeRange=[0.5,1],
        linger=e['particleLinger'], color=e['Color'], birthScale=e['birthScale0'],
        scale=e['scale0'], rotation=e['birthRotation0'], shape=e['SpawnShape'],
        velocity=e.get('birthVelocity'), orbitalVelocity=e.get('birthOrbitalVelocity'),
        drag=e['birthDrag'], bindWeight=e.get('bindWeight'), primitive=e.get('primitive'),
        blendMode=e['blendMode'], uniformScale=e.get('isUniformScale'), passIndex=e.get('pass'),
        atlasDivision=e['texDiv'], frames=e['numFrames'], randomStart=e['isRandomStartFrame'],
        frameRate=e.get('frameRate'), softParticle=e.get('softParticleParams'),
        erosion=e.get('alphaErosionDefinition')))
result = dict(definitionsSha256=hash_bytes(pin_path.read_bytes()), record=record,
    emitters=layers, profiles=profiles, textures=textures,
    scope='Verified source assets and authored parameters. Missing fields remain null; native defaults and playback are not inferred.')
Path('docs/reference/hawkshot-sprites.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps([dict(path=t['path'],dimensions=t['dimensions'],bytes=t['bytes']) for t in textures]))
