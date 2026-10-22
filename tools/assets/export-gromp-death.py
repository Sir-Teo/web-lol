"""Export legacy DDS pixels and the first source Gromp death-quad adapter."""
import hashlib
import json
from pathlib import Path
from PIL import Image, __version__ as pillow_version

sha = lambda data: hashlib.sha256(data).hexdigest()
source = Path('docs/reference/gromp-effects.json')
pin = json.loads(source.read_text())
root = Path('.cache/gromp-effects-sources')
outputs = []
for item in pin['extraction']['files']:
    raw = (root / item['path']).read_bytes()
    assert len(raw) == item['bytes'] and sha(raw) == item['sha256']
    if not item['path'].endswith('.dds'):
        continue
    image = Image.open(root / item['path']).convert('RGBA')
    path = Path('public/assets/effects/gromp-legacy') / (item['path'].removeprefix('data/').removesuffix('.dds') + '.png')
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        existing = Image.open(path).convert('RGBA')
        assert existing.size == image.size and existing.tobytes() == image.tobytes()
    else:
        image.save(path)
    outputs.append(dict(source=item, path=str(path).removeprefix('public/'),
        width=image.width, height=image.height, bytes=path.stat().st_size,
        sha256=sha(path.read_bytes()), rgbaSha256=sha(image.tobytes()), extrema=image.getextrema()))


def texture(path):
    return next(v['path'] for v in outputs if v['source']['path'] == path.lower())


def vec(value, size):
    return value if isinstance(value, list) else [value] * size


def curve(fields, prefix, size):
    entries = [value for key, value in fields.items()
               if key.startswith(prefix) and key[len(prefix):].isdigit()]
    entries.sort(key=lambda value: value[0])
    assert all(len(entry) in [2, size + 1] for entry in entries)
    return [dict(time=v[0], value=vec(v[1:] if len(v) > 2 else v[1], size)) for v in entries]


record = 'data/particles/sru_gromp_death_pop.troybin'
data = pin['records'][record]['decoded']['values']
profiles = []
for name in ['flash', 'lightring', 'flashfrog']:
    e = data[name]
    assert e['p-type'] == 0 and e['single-particle'] == 1 and e['e-rate'] == 1
    profiles.append(dict(name=name, sourceRecord=record, sourceSection=name,
        texture=texture(e['p-texture']), lookup=texture(e['p-rgba']) if 'p-rgba' in e else None,
        life=e['p-life'], size=vec(e['p-scale'], 3),
        offset=e.get('p-offset', [0, 0, 0]), postOffset=e.get('p-postoffset', [0, 0, 0]),
        rotation=([e['p-quadrot'], 0, 0] if isinstance(e['p-quadrot'], (float, int)) else e['p-quadrot']) if 'p-quadrot' in e else [0, 0, 0],
        color=e.get('p-xrgba', [1, 1, 1, 1]), colorCurve=curve(e, 'p-xrgba', 4),
        scaleCurve=curve(e, 'p-xscale', 3), uniform=bool(e.get('uniformscale', 0)),
        blend=e['rendermode'], priority=e['pass'],
        depthTest=e.get('flag-disable-z', 0) == 0))
character = Path('docs/reference/jungle-character-source.json')
characters = json.loads(character.read_text())
model = characters['models']['SRU_Gromp']
graph = characters['records']['data/characters/sru_gromp/animations/skin0.bin'][model['graphKey']]
event = graph['mClipDataMap']['{bd28bd4d}']['mEventDataMap']['{fd3600a1}']
assert event['mEffectName'].lower() == 'data/particles/sru_gromp_death_pop.troy'
assert event['mParticleEventDataPairList'][0]['mBoneName'] == '{7cd8dbdd}'
result = dict(sourcePinSha256=sha(source.read_bytes()), characterPinSha256=sha(character.read_bytes()),
    event=event, bone='Buffbone_Glb_Ground_Loc', profiles=profiles,
    status='Three camera quads from the eight-emitter death-pop source. Death dispatch on the first fixed update, default-white tint, uniform-X scale, camera Euler convention and lookup coordinates are local adapters; five pop emitters, spores, audio and native composition remain unfinished.')
Path('src/content/gromp-death.json').write_text(json.dumps(result, indent=2) + '\n')
assets = dict(sourcePinSha256=result['sourcePinSha256'],
    decoder=dict(library='Pillow', version=pillow_version, operation='DDS to RGBA8 to lossless PNG'),
    outputs=outputs,
    meshesDeferred=[f for f in pin['extraction']['files'] if f['path'].endswith('.scb')])
Path('docs/reference/gromp-effect-assets.json').write_text(json.dumps(assets, indent=2) + '\n')
print(json.dumps(dict(textures=len(outputs), profiles=len(profiles),
    lookups=[dict(path=o['path'], width=o['width'], height=o['height'], extrema=o['extrema'])
             for o in outputs if 'color-hold' in o['path']])))
