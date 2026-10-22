"""Export legacy DDS pixels and all eight source Gromp death-pop profiles."""
import hashlib
import json
import math
from pathlib import Path
from PIL import Image, __version__ as pillow_version
from legacy_particle_fields import vec, curve, probability

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


record = 'data/particles/sru_gromp_death_pop.troybin'
data = pin['records'][record]['decoded']['values']
mesh = json.loads(Path('public/assets/models/gromp-death-paper01.json').read_text())
assert mesh['source'] in pin['extraction']['files']
assert sha(Path('public' + mesh['output']['path']).read_bytes()) == mesh['output']['sha256']
profiles = []
for name in ['flash', 'lightring', 'flashfrog', 'chunks', 'shadow', 'pop', 'skinshards', 'popshards']:
    e = data[name]
    assert e['p-type'] in range(4) and e['single-particle'] == 1 and e['e-rate'] >= 1
    if 'p-mesh' in e:
        assert e['p-mesh'].lower() == mesh['source']['path']
    texture_field = 'p-meshtex' if e['p-type'] == 3 else 'p-texture'
    profiles.append(dict(name=name, sourceRecord=record, sourceSection=name,
        sourceIndex=next(i for i in range(8) if data['System'][f'GroupPart{i + 1}'] == name),
        kind=['billboard', 'quad', 'ray', 'mesh'][e['p-type']], count=math.trunc(e['e-rate']),
        mesh=mesh['output']['path'].removeprefix('/') if 'p-mesh' in e else None,
        texture=texture(e[texture_field]), lookup=texture(e['p-rgba']) if 'p-rgba' in e else None,
        life=e['p-life'], size=vec(e['p-scale'], 3),
        offset=e.get('p-offset', [0, 0, 0]), postOffset=e.get('p-postoffset', [0, 0, 0]),
        rotation=([e['p-quadrot'], 0, 0] if isinstance(e['p-quadrot'], (float, int)) else e['p-quadrot']) if 'p-quadrot' in e else [0, 0, 0],
        color=e.get('p-xrgba', [1, 1, 1, 1]), colorCurve=curve(e, 'p-xrgba', 4),
        scaleCurve=curve(e, 'p-xscale', 3), uniform=bool(e.get('uniformscale', 0)),
        velocity=e.get('p-vel', [0, 0, 0]), acceleration=e.get('p-worldaccel', [0, 0, 0]),
        drag=vec(e.get('p-drag', 0), 3), uvOffset=e.get('e-uvoffset', [0, 0]),
        scroll=e.get('p-uvscroll-rgb', [0, 0]),
        rotationRate=e.get('p-xquadrot', [0, 0, 0]),
        rotationCurve=curve(e, 'p-xquadrot', 3) if e.get('p-xquadrot-on', 0) else [],
        probabilities=dict(life=probability(e, 'p-life'),
            **{key: [probability(e, field, axis) for axis in axes]
               for key, field, axes in [('size', 'p-scale', 'XYZ'), ('offset', 'p-offset', 'XYZ'),
                   ('rotation', 'p-quadrot', 'XYZ'), ('velocity', 'p-vel', 'XYZ'),
                   ('uvOffset', 'e-uvoffset', 'XY')]}),
        shape=[dict(axis=e[f'e-rotation{i}-axis'], value=e[f'e-rotation{i}'],
                    probability=probability(e, f'e-rotation{i}'))
               for i in range(1, 4) if f'e-rotation{i}-axis' in e],
        atlas=dict(grid=e.get('p-texdiv', [1, 1]), frames=e.get('p-numframes', 1),
                   start=e.get('p-startframe', 0), random=bool(e.get('p-randomstartframe', 0)),
                   fps=e.get('p-frameRate', 0)),
        local=bool(e.get('e-local-orient', 1)), particleLocal=bool(e.get('p-local-orient', 0)),
        alphaRef=e.get('e-alpharef', 0),
        blend=e['rendermode'], priority=e.get('pass', 0),
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
    status='All eight death-pop emitters. Fixed-update dispatch/motion/rotation, indexed correlated RNG, scalar XP lifetime alias, source extent/frames/defaults and native composition remain local reconstruction policies. Spores, projectile/impact, audio and miniature dispatch remain unfinished.')
Path('src/content/gromp-death.json').write_text(json.dumps(result, indent=2) + '\n')
max_life = max(p['life'] * max(p['probabilities']['life']['values'] or [1]) for p in profiles)
retention = math.ceil(max_life * 60) + 2  # first birth plus interpolation margin
Path('src/content/gromp-death-timing.ts').write_text(
    '// Generated by tools/assets/export-gromp-death.py. Source lifetime plus first-birth/interpolation margin.\n'
    f'export const GROMP_DEATH_PARTICLE_RETENTION_TICKS = {retention};\n')
assets = dict(sourcePinSha256=result['sourcePinSha256'],
    decoder=dict(library='Pillow', version=pillow_version, operation='DDS to RGBA8 to lossless PNG'),
    outputs=outputs,
    meshes=[mesh], meshesDeferred=[])
Path('docs/reference/gromp-effect-assets.json').write_text(json.dumps(assets, indent=2) + '\n')
print(json.dumps(dict(textures=len(outputs), profiles=len(profiles),
    lookups=[dict(path=o['path'], width=o['width'], height=o['height'], extrema=o['extrema'])
             for o in outputs if 'color-hold' in o['path']])))
