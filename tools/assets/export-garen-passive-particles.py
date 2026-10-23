"""Losslessly decode pinned recovery textures and derive the healspark profile.

Boost trail dispatch and the sound-only resource are not inferred from names.
"""
from pathlib import Path
from io import BytesIO
import hashlib
import json
from PIL import Image
from cdtb.export import TexConverter

sha = lambda raw: hashlib.sha256(raw).hexdigest()
def write(path, value):
    raw = (json.dumps(value, indent=2) + '\n').encode()
    if not path.exists() or path.read_bytes() != raw: path.write_bytes(raw)
pin_path = Path('docs/reference/garen-passive-particles.json')
pin = json.loads(pin_path.read_text())
root = Path('.cache/garen-passive-particle-sources')
textures = []
for source in pin['extraction']['files']:
    raw = (root / (source['wadPathHash'] + Path(source['path']).suffix)).read_bytes()
    assert sha(raw) == source['sha256'] and len(raw) == source['bytes']
    if not source['path'].endswith('.tex'): continue
    image = Image.open(BytesIO(TexConverter.tex_to_dds(raw))).convert('RGBA')
    output = Path('public/assets/effects') / (Path(source['path']).stem + '.png')
    if output.exists():
        old = Image.open(output).convert('RGBA')
        assert old.size == image.size and old.tobytes() == image.tobytes()
    else: image.save(output)
    textures.append(dict(source=source, path=str(output), width=image.width, height=image.height,
        bytes=output.stat().st_size, sha256=sha(output.read_bytes()), rgbaSha256=sha(image.tobytes())))
paths = {t['source']['path']:t['path'].removeprefix('public/') for t in textures}
e = pin['resources']['Garen_P_Heal']['definition']['complexEmitterDefinitionData'][0]
assert e['primitive']['__type'] == 'VfxPrimitiveArbitraryQuad'
assert e['bindWeight']['constantValue'] == 1 and e['isLocalOrientation'] == 0
assert e['blendMode'] == 4 and e['rate']['constantValue'] == 6
assert len(pin['resources']['Garen_P_Boost']['definition']['complexEmitterDefinitionData']) == 2
assert not pin['resources']['Garen_Heal']['definition'].get('complexEmitterDefinitionData')
def birth(value):
    dynamics = value.get('dynamics')
    if dynamics: assert dynamics['times'] == [0] and len(dynamics['values']) == 1
    raw = dynamics['values'][0] if dynamics else value['constantValue']
    return dict(value=raw if isinstance(raw, list) else [raw], probabilities=[
        dict(times=t.get('keyTimes',[]),values=t.get('keyValues',[]),single=t.get('singleValue',1))
        for t in dynamics.get('probabilityTables',[])] if dynamics else None)
def curve(value):
    return dict(times=value['dynamics']['times'], values=value['dynamics']['values'])
profile = dict(system='Garen_P_Heal', index=0, name=e['emitterName'], rate=e['rate']['constantValue'],
    texture=paths[e['texture'].lower()], lookup=paths[e['particleColorTexture'].lower()],
    life=birth(e['particleLifetime']),velocity=birth(e['birthVelocity']),drag=e['birthDrag']['constantValue'],
    orbit=birth(e['birthOrbitalVelocity']),offset=birth(e['SpawnShape']['emitOffset']),
    position=e['EmitterPosition']['constantValue'],size=e['birthScale0']['constantValue'],
    scale=curve(e['scale0']),color=curve(e['Color']),lookupTypes=[e.get('colorLookUpTypeX',1),e['colorLookUpTypeY']],
    lookupScales=e.get('colorLookUpScales',[1,1]),lookupOffsets=e.get('colorLookUpOffsets',[0,0]),
    blend=e['blendMode'],bind=1,local=False,maxLife=3)
output = Path('src/content/garen-passive-particles.json');write(output, profile)
write(Path('docs/reference/garen-passive-particles-decoded.json'), dict(sourcePinSha256=sha(pin_path.read_bytes()),
    textures=textures, profile=dict(path=str(output),sha256=sha(output.read_bytes())),
    rendered=[dict(system='Garen_P_Heal',index=0)],
    deferred=[dict(system='Garen_P_Boost',index=0,reason='Arbitrary trail; boost dispatch and bound-size input unverified')],
    filtered=[dict(system='Garen_P_Boost',index=1,reason='Explicit disabled source emitter')],
    nonvisual=[dict(system='Garen_Heal',reason='Sound-only resource; activation graph implemented in Garen P audio, native dispatch unverified')]))
print(json.dumps(dict(textures=len(textures),pngBytes=sum(t['bytes'] for t in textures),rendered=1,deferred=1,disabled=1)))
