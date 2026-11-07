"""Retain explicit Charm spell, persistent-buff and animation effect joins."""
import argparse
import hashlib
import json
from pathlib import Path
from ahri_e_particles import load, checked, require, strings
from ahri_e_additional_particles import load as load_additional

PINS = {
    'docs/reference/ahri/character.json': 'aa7ec5f710aa818c2ecc98a516bb1542bb52261c7ce89649ef0b2b8e8cc5ec5e',
    'docs/reference/ahri/names.json': '770a7e5b7bdaf1d1de42b7d33a09912a8e56a3244bb0ab2b5d00d94e8b0013a2',
    'docs/reference/ahri/character.bin': '121997c9c4ef2ff0f671b659d64d2e22cb71208216ddcc3c4f552a17f196d2cb',
    'docs/reference/ahri-model.json': '74d0b55f5aad08646fbd24f660ed533bc8fd5798e8a60dc0983d97960b47a377',
    'docs/reference/ahri/e-particles.json': 'cdf8ed963d051e9517443949c5a4b30b924d5c7ba9fed36aecccf6bdb5a1a756',
    'docs/reference/ahri/e-additional-particles.json': 'd16b06cc12bfd2016dc07f048d1b031ff6da346f3dbb2ab7dfdb7aa407086c90',
}
TARGET = Path('docs/reference/ahri/e-particle-bindings.json')
PREFIX = 'Characters/Ahri/Spells/AhriEAbility'
def sha(raw): return hashlib.sha256(raw).hexdigest()

def read():
    inputs = {name: checked(name, digest) for name, digest in PINS.items()}
    particles, model = load()
    additional, _ = load_additional()
    resources = {**particles['resources'], **additional['resources']}
    character = json.loads(inputs['docs/reference/ahri/character.json'])
    require(character['sha256'] == PINS['docs/reference/ahri/names.json'], 'Character named-record binding differs')
    native = next(r for r in character['extraction']['files'] if r['path'] == 'data/characters/ahri/ahri.bin')
    require(native['sha256'] == PINS['docs/reference/ahri/character.bin'] and
            native['bytes'] == len(inputs['docs/reference/ahri/character.bin']), 'Character native extraction differs')
    selected = {k:v for k,v in character['records'].items() if k == PREFIX or k.startswith(PREFIX+'/')}
    require(set(selected) == {PREFIX, PREFIX+'/AhriE', PREFIX+'/AhriEMissile'}, 'Native E record closure differs')
    ability = selected[PREFIX]
    require(ability['mRootSpell'] == PREFIX+'/AhriE' and ability['mChildSpells'] ==
            [PREFIX+'/AhriE', PREFIX+'/AhriEMissile'], 'Native E ability/child closure differs')
    bindings = []
    def bind(path, field, key, kind, declaration):
        resource = resources[key]
        bindings.append(dict(kind=kind,producerPath=path,field=field,resourceKey=key,
            resourceRecord=resource['record'],emitterCount=len(resource['definition']['complexEmitterDefinitionData']),
            nativeParticleBin=dict(path=resource['sourceBin'],sha256=resource['nativeSha256']),declaration=declaration))
    missile_path = PREFIX+'/AhriEMissile'
    spell = selected[missile_path]['mSpell']
    for field,key in [('mMissileEffectKey','Ahri_E_mis'),('mHitEffectKey','Ahri_E_tar')]:
        require(spell[field] == key, 'Native E spell/effect alias differs')
        bind(missile_path,field,key,'spell',spell[field])
    for name in ['AhriE','AhriEMissile']:
        row = selected[PREFIX+'/'+name]
        require(row['objectPath'] == PREFIX+'/'+name and row['mScriptName'] == name, 'Native E spell identity differs')
    persistent = selected[PREFIX+'/AhriE']['mBuff']['PersistentEffectConditions']
    require(len(persistent) == 1 and persistent[0]['__type'] == 'PersistentEffectConditionData', 'Persistent condition closure differs')
    effects = persistent[0]['PersistentVfxs']
    require([(r['effectKey'],r['boneName']) for r in effects] == [
        ('Ahri_E_buf','C_BUFFBONE_GLB_HEAD_LOC'),('{44fc6ec4}','C_BUFFBONE_GLB_LAYOUT_LOC')],
        'Persistent native effect/bone closure differs')
    for index,event in enumerate(effects):
        bind(PREFIX+'/AhriE',f'mBuff.PersistentEffectConditions[0].PersistentVfxs[{index}]',
             event['effectKey'],'persistent-buff',event)
    spec = spell['mMissileSpec']
    require('visibilityComponent' not in spec and spec['movementComponent'] == {
        'mUseHeightOffsetAtEnd':True,'mTracksTarget':False,'mOffsetInitialTargetHeight':100.0,
        'mStartBoneName':'BUFFBONE_CSTM_WEAPON_1','mProjectTargetToCastRange':True,
        'mSpeed':1550.0,'__type':'FixedSpeedMovement'}, 'Native E movement/visibility differs')
    require([b['__type'] for b in spec['behaviors']] ==
        ['CastOnHit','DestroyOnMovementComplete','DestroyOnHit'], 'Native E behavior order differs')
    require(spell['bHaveHitBone'] is True and spell['mHitBoneName'] == 'spine' and
        selected[PREFIX+'/AhriE']['mSpell']['mHitBoneName'] == 'head', 'Distinct E hit-bone declarations differ')
    events = []
    clips = model['animations']['data']['Characters/Ahri/Animations/Skin0']['mClipDataMap']
    for clip_name,clip in clips.items():
        for event_key,event in clip.get('mEventDataMap',{}).items():
            if event.get('__type') != 'ParticleEventData' or not event.get('mEffectKey','').startswith('Ahri_E_'): continue
            require(event['mEffectKey'] == 'Ahri_E_cas' and event['mStartFrame'] == 1.0 and
                'mEndFrame' not in event and event['mIsKillEvent'] is False and
                event['mParticleEventDataPairList'] == [{'mBoneName':'C_Buffbone_Glb_Center_Loc',
                    '__type':'ParticleEventDataPair'}], 'Native E animation event differs')
            row = dict(clipName=clip_name,eventKey=event_key,
                animationPath=clip['mAnimationResourceData']['mAnimationFilePath'],declaration=event)
            events.append(row)
            bind('Characters/Ahri/Animations/Skin0/'+clip_name,event_key,'Ahri_E_cas','animation',row)
    require(len(events) == 4 and {e['clipName'] for e in events} ==
        {'Spell3_East','Spell3_North','Spell3_South','Spell3_West'}, 'Directional E animation closure differs')
    joined = {b['resourceKey'] for b in bindings}
    require(joined == set(resources), 'Unjoined E resource')
    paths = {s.lower() for resource in resources.values() for s in strings(resource['definition'])
             if s.lower().endswith(('.tex','.scb'))}
    native_assets = {}
    for row in particles['extraction']['files']+additional['extraction']['files']:
        require(row['path'] not in native_assets or row == native_assets[row['path']], 'Conflicting shared native dependency')
        native_assets[row['path']] = row
    require(len(paths) == 24 and sum(p.endswith('.tex') for p in paths) == 22 and
        sum(p.endswith('.scb') for p in paths) == 2, 'E bound dependency closure differs')
    return dict(format=1,producerSha256=sha(Path(__file__).read_bytes()),
        sourceHelpers=[dict(path='tools/assets/'+name,sha256=sha(Path(__file__).with_name(name).read_bytes()))
            for name in ['ahri_e_particles.py','ahri_e_additional_particles.py']],
        inputs=[dict(path=name,bytes=len(inputs[name]),sha256=digest) for name,digest in PINS.items()],
        abilityPath=PREFIX,abilityDeclaration=ability,spellDeclarations=selected,bindings=bindings,
        animationParticleEvents=events,unjoinedResourceKeys=[],dependencies=[native_assets[p] for p in sorted(paths)],
        summary=dict(nativeSpellBindings=2,persistentBuffBindings=2,animationParticleEvents=4,
            joinedSystems=5,authoredEmitters=29,textures=22,meshes=2,unjoinedSystems=0),
        limits=['Explicit native fields join missile, hit and both persistent-buff effects; four directional animation events join cast.',
            'The hashed buff alias remains raw and resolves through the native base-skin resource map; no name is invented.',
            'Animation start frame 1 remains a source frame; end frames and missile visibility components remain omitted.',
            'Root spell head and missile spine hit-bone declarations remain distinct. No native attachment sampling or transforms are certified.',
            'Native scripts, event/buff chronology, direction selection, frame conversion, local stopping and GPU pixels remain separate work.',
            'No gameplay rules, saved histories, public assets or runtime dispatch change.'])

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true');parser.add_argument('--output',type=Path,default=TARGET)
    args=parser.parse_args();record=read();raw=(json.dumps(record,indent=2,allow_nan=False)+'\n').encode();path=args.output
    require(not any(p.is_symlink() for p in [path,*path.parents]),'Binding output cannot contain symlinks')
    require(not path.exists() or path.read_bytes()==raw,'Conflicting E binding output')
    require(not args.check or path.exists(),'Missing E binding output')
    if not args.check and not path.exists():
        path.parent.mkdir(parents=True,exist_ok=True)
        with path.open('xb') as stream:stream.write(raw)
    print(json.dumps(dict(result='passed',bytes=len(raw),sha256=sha(raw),**record['summary'])))
if __name__=='__main__':main()
