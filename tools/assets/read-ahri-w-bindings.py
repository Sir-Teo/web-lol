"""Join retained native W spell effect fields to complete base-skin resources."""
import argparse
import hashlib
import json
from pathlib import Path
from ahri_w_particles import load, checked, require, strings

PINS = {
    'docs/reference/ahri/character.json': 'aa7ec5f710aa818c2ecc98a516bb1542bb52261c7ce89649ef0b2b8e8cc5ec5e',
    'docs/reference/ahri/names.json': '770a7e5b7bdaf1d1de42b7d33a09912a8e56a3244bb0ab2b5d00d94e8b0013a2',
    'docs/reference/ahri/character.bin': '121997c9c4ef2ff0f671b659d64d2e22cb71208216ddcc3c4f552a17f196d2cb',
    'docs/reference/ahri-model.json': '74d0b55f5aad08646fbd24f660ed533bc8fd5798e8a60dc0983d97960b47a377',
    'docs/reference/ahri/w-particles.json': 'c1226324a728137c05062dafc7d4a102a0799a371d233d58e3f81558c26dbb47',
}
TARGET = Path('docs/reference/ahri/w-particle-bindings.json')
PREFIX = 'Characters/Ahri/Spells/AhriWAbility'

def sha(raw): return hashlib.sha256(raw).hexdigest()

def read():
    inputs = {name: checked(name, digest) for name, digest in PINS.items()}
    particles, model = load()
    character = json.loads(inputs['docs/reference/ahri/character.json'])
    require(character['sha256'] == PINS['docs/reference/ahri/names.json'],
            'Character named-record source binding differs')
    native = next(r for r in character['extraction']['files'] if r['path'] == 'data/characters/ahri/ahri.bin')
    require(native['sha256'] == PINS['docs/reference/ahri/character.bin'] and
            native['bytes'] == len(inputs['docs/reference/ahri/character.bin']),
            'Character native extraction binding differs')
    records = character['records']
    selected = {key: value for key, value in records.items() if key == PREFIX or key.startswith(PREFIX+'/')}
    require(set(selected) == {PREFIX, *[PREFIX+'/'+name for name in
            ['AhriW', 'AhriWMissile', 'AhriWDamageMissile', 'AhriWSpeedBuff']]},
            'Native W record closure differs')
    ability = selected[PREFIX]
    require(ability['mRootSpell'] == PREFIX+'/AhriW' and ability['mChildSpells'] ==
            [PREFIX+'/AhriW', PREFIX+'/AhriWDamageMissile', PREFIX+'/AhriWMissile'],
            'Native W ability/child closure differs')
    resources = model['skin']['data']['Characters/Ahri/Skins/Skin0/Resources']['resourceMap']
    bindings, paths = [], set()
    expected = [
        ('AhriWMissile', 'mMissileEffectKey', 'Ahri_W_mis', 8),
        ('AhriWDamageMissile', 'mMissileEffectKey', 'Ahri_W_mis_02', 9),
        ('AhriWDamageMissile', 'mHitEffectKey', 'Ahri_W_tar', 6),
    ]
    for name, field, key, count in expected:
        path = PREFIX+'/'+name
        declaration = selected[path]
        spell = declaration['mSpell']
        resource = particles['resources'][key]
        require(declaration['objectPath'] == path and declaration['mScriptName'] == name and
                spell[field] == key, 'Native W spell/effect alias differs')
        require(resource['record'] == resources[key] and
                len(resource['definition']['complexEmitterDefinitionData']) == count,
                'Unjoined W resource/emitter closure')
        paths.update(s.lower() for s in strings(resource['definition']) if s.lower().endswith(('.tex','.scb')))
        bindings.append(dict(spellPath=path, scriptName=name, field=field, resourceKey=key,
            resourceRecord=resource['record'], emitterCount=count,
            nativeParticleBin=dict(path=resource['sourceBin'], sha256=resource['nativeSha256'])))
    orbit = selected[PREFIX+'/AhriWMissile']['mSpell']['mMissileSpec']
    damage = selected[PREFIX+'/AhriWDamageMissile']['mSpell']['mMissileSpec']
    require(orbit['movementComponent']['__type'] == 'CircleMovement' and
            orbit['movementComponent']['mStartBoneName'] == 'chest' and
            orbit['visibilityComponent'] == {'mTargetControlsVisibility': True, '__type': 'Defaultvisibility'},
            'Native W orbit movement/visibility differs')
    require([b['__type'] for b in orbit['behaviors']] == ['CastOnHit','DestroyOnMovementComplete'],
            'Native W orbit behaviors differ')
    movement = damage['movementComponent']
    require('visibilityComponent' not in damage and movement['__type'] == 'ParametricMovement' and
            movement['mStartBoneName'] == 'spine' and
            movement['ParametricMovementType']['__type'] == 'ParametricMovementType_AngleFromTarget',
            'Native W damage movement/visibility differs')
    entries = movement['MovementEntries']
    require(len(entries) == 5 and 'value' not in entries[0] and
            [e['value'] for e in entries[1:]] == [90.0,-90.0,180.0,-180.0] and
            all(e['MovementSpec']['__type'] == 'FixedSpeedSplineMovement' and
                e['MovementSpec']['mStartBoneName'] == 'spine' and
                e['MovementSpec']['mSpeed'] == 1400.0 for e in entries),
            'Native W spline entry closure differs')
    require([b['__type'] for b in damage['behaviors']] == ['CastOnMovementComplete','DestroyOnMovementComplete'],
            'Native W damage behaviors differ')
    hit = selected[PREFIX+'/AhriWDamageMissile']['mSpell']
    require(hit['bHaveHitBone'] is True and hit['mHitBoneName'] == 'C_BUFFBONE_GLB_CHEST_LOC',
            'Native W explicit hit-bone declaration differs')
    clips = model['animations']['data']['Characters/Ahri/Animations/Skin0']['mClipDataMap']
    events = []
    for clip_name, clip in clips.items():
        for event_key, event in clip.get('mEventDataMap', {}).items():
            if event.get('__type') == 'ParticleEventData' and event.get('mEffectKey','').startswith('Ahri_W'):
                events.append(dict(clipName=clip_name,eventKey=event_key,declaration=event))
    require(events == [], 'Native W animation event closure differs')
    native_assets = {r['path']:r for r in particles['extraction']['files']}
    require(len(paths) == 31 and sum(p.endswith('.tex') for p in paths) == 30 and
            sum(p.endswith('.scb') for p in paths) == 1, 'W bound dependency closure differs')
    joined = {r['resourceKey'] for r in bindings}
    unjoined = sorted(set(particles['resources'])-joined)
    require(unjoined == ['Ahri_W_cas','Ahri_W_weap_cas'], 'W unjoined resource set differs')
    return dict(format=1,producerSha256=sha(Path(__file__).read_bytes()),
        sourceHelperSha256=sha(Path(__file__).with_name('ahri_w_particles.py').read_bytes()),
        inputs=[dict(path=name,bytes=len(inputs[name]),sha256=digest) for name,digest in PINS.items()],
        abilityPath=PREFIX,abilityDeclaration=ability,spellDeclarations=selected,
        bindings=bindings,animationParticleEvents=events,unjoinedResourceKeys=unjoined,
        dependencies=[native_assets[path] for path in sorted(paths)],
        summary=dict(nativeSpellBindings=3,joinedSystems=3,authoredEmitters=23,textures=30,meshes=1,
                     splineEntries=5,animationParticleEvents=0,unjoinedSystems=2),
        limits=[
            'Three explicit native spell effect fields join orbit, damage-missile and hit systems. Native script bodies and callback chronology are not supplied.',
            'The retained animation table has no W particle event. Cast and empty weapon resources remain unjoined; no producer or fallback is invented.',
            'All five selected native ability/spell/buff records remain verbatim, including every movement entry, damage, targeting, buff and client field.',
            'The first spline entry omits its value. Orbit declares target-controlled visibility; damage omits visibilityComponent. Missing fields receive no defaults.',
            'Native movement, start bones, hit-bone and visibility declarations do not establish renderer transforms, fog policy, particle stopping or native pixels.',
            'This reading generates no gameplay rules or runtime dispatch.'])
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    parser.add_argument('--output',type=Path,default=TARGET)
    args=parser.parse_args()
    record=read();raw=(json.dumps(record,indent=2,allow_nan=False)+'\n').encode();path=args.output
    require(not any(p.is_symlink() for p in [path,*path.parents]),'Binding output cannot contain symlinks')
    require(not path.exists() or path.read_bytes()==raw,'Conflicting W binding output')
    require(not args.check or path.exists(),'Missing W binding output')
    if not args.check and not path.exists():
        path.parent.mkdir(parents=True,exist_ok=True)
        with path.open('xb') as stream:stream.write(raw)
    print(json.dumps(dict(result='passed',bytes=len(raw),sha256=sha(raw),**record['summary'])))
if __name__=='__main__':main()
