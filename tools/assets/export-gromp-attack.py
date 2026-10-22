"""Derive all four legacy Gromp missile emitter profiles from pinned source."""
import hashlib
import json
from pathlib import Path
from legacy_particle_fields import vec, curve, probability

sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
source_path = 'docs/reference/gromp-effects.json'
source = json.loads(Path(source_path).read_text())
assets = json.loads(Path('docs/reference/gromp-effect-assets.json').read_text())
assert assets['sourcePinSha256'] == sha(source_path)
def texture(path):
    output = next(o for o in assets['outputs'] if o['source']['path'] == path.lower())
    assert sha('public/' + output['path']) == output['sha256']
    return output['path']

record = 'data/particles/sru_gromp_ba1_mis.troybin'
fields = source['records'][record]['decoded']['values']
profiles = []
for index in range(4):
    name = fields['System'][f'GroupPart{index + 1}']
    e = fields[name]
    assert e['p-type'] in [0, 1] and e['rendermode'] in [0, 2, 4]
    profiles.append(dict(name=name, sourceRecord=record, sourceIndex=index,
        texture=texture(e['p-texture']), life=e['p-life'], rate=e['e-rate'],
        emitterLife=e['e-life'] if e['e-life'] >= 0 else None,
        single=bool(e.get('single-particle', 0)), linger=e['p-linger'], bind=e['p-bindtoemitter'],
        kind='billboard' if e['p-type'] == 0 else 'quad',
        size=vec(e['p-scale'], 3), offset=e.get('p-offset', [0, 0, 0]),
        velocity=e.get('p-vel', [0, 0, 0]), drag=vec(e.get('p-drag', 0), 3),
        rotation=vec(e.get('p-quadrot', 0), 3),
        color=e.get('p-xrgba', [1, 1, 1, 1]), colorCurve=curve(e, 'p-xrgba', 4),
        scaleCurve=curve(e, 'p-xscale', 3), uniform=bool(e.get('uniformscale', 0)),
        probabilities=dict(life=probability(e, 'p-life'),
            **{key: [probability(e, field, axis) for axis in 'XYZ']
               for key, field in [('size', 'p-scale'), ('offset', 'p-offset'),
                   ('velocity', 'p-vel'), ('rotation', 'p-quadrot')]}),
        shape=[dict(axis=e[f'e-rotation{i}-axis'], value=e[f'e-rotation{i}'],
                    probability=probability(e, f'e-rotation{i}'))
               for i in range(1, 4) if f'e-rotation{i}-axis' in e],
        local=bool(e.get('e-local-orient', 1)), particleLocal=bool(e.get('p-local-orient', 0)),
        blend=e['rendermode'], priority=e['pass'], depthTest=not bool(e.get('flag-disable-z', 0))))
characters = json.loads(Path('docs/reference/jungle-character-source.json').read_text())
spell = characters['records']['data/characters/sru_gromp/sru_gromp.bin']['{e545321f}']
assert spell['mSpell']['mMissileEffectName'].lower() == 'data/particles/sru_gromp_ba1_mis.troy'
output = dict(sourcePinSha256=sha(source_path), characterPinSha256=sha('docs/reference/jungle-character-source.json'),
    spell=spell, profiles=profiles, status='Four source missile emitters. Fixed-grid births, indexed correlated RNG, type-0 stop caps, birth-frame orientation and constant translation binding are local reconstructions. Root/gravity/vertical-facing source fields are preserved but not implemented; current terrain-relative height remains 0.9 world units. Hit effect/audio and native parity remain unfinished.')
Path('src/content/gromp-attack.json').write_text(json.dumps(output, indent=2) + '\n')
print(json.dumps(dict(profiles=len(profiles), textures=len(set(p['texture'] for p in profiles)))))
