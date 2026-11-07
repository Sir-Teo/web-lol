"""Retain explicit Spirit Rush spell, counter-driver and skin-buff joins."""
import argparse
import hashlib
import json
from pathlib import Path
from ahri_r_particles import load, checked, require, strings

PINS = {
    'docs/reference/ahri/character.json': 'aa7ec5f710aa818c2ecc98a516bb1542bb52261c7ce89649ef0b2b8e8cc5ec5e',
    'docs/reference/ahri/names.json': '770a7e5b7bdaf1d1de42b7d33a09912a8e56a3244bb0ab2b5d00d94e8b0013a2',
    'docs/reference/ahri/character.bin': '121997c9c4ef2ff0f671b659d64d2e22cb71208216ddcc3c4f552a17f196d2cb',
    'docs/reference/ahri-model.json': '74d0b55f5aad08646fbd24f660ed533bc8fd5798e8a60dc0983d97960b47a377',
    'docs/reference/ahri/r-particles.json': '3f283be14704aa77c680d2c11eb67441d8376586835e43283ae7be440c956991',
}
TARGET = Path('docs/reference/ahri/r-particle-bindings.json')
PREFIX = 'Characters/Ahri/Spells/AhriRAbility'
SKIN = 'Characters/Ahri/Skins/Skin0'
def sha(raw): return hashlib.sha256(raw).hexdigest()


def read():
    inputs = {name: checked(name, digest) for name, digest in PINS.items()}
    particles, model = load()
    character = json.loads(inputs['docs/reference/ahri/character.json'])
    require(character['sha256'] == PINS['docs/reference/ahri/names.json'], 'Character named-record binding differs')
    native = next(r for r in character['extraction']['files'] if r['path'] == 'data/characters/ahri/ahri.bin')
    require(native['sha256'] == PINS['docs/reference/ahri/character.bin'] and
            native['bytes'] == len(inputs['docs/reference/ahri/character.bin']), 'Character native extraction differs')
    selected = {k:v for k,v in character['records'].items() if k == PREFIX or k.startswith(PREFIX+'/')}
    require(set(selected) == {PREFIX, PREFIX+'/AhriR', PREFIX+'/AhriRMissile'}, 'Native R record closure differs')
    ability = selected[PREFIX]
    require(ability['mRootSpell'] == PREFIX+'/AhriR' and ability['mChildSpells'] ==
            [PREFIX+'/AhriR', PREFIX+'/AhriRMissile'], 'Native R ability/child closure differs')
    bindings = []
    def bind(path, field, key, kind, declaration):
        row = particles['resources'][key]
        bindings.append(dict(kind=kind,producerPath=path,field=field,resourceKey=key,
            resourceRecord=row['record'],emitterCount=len(row['definition'].get('complexEmitterDefinitionData', [])),
            nativeParticleBin=dict(path=row['sourceBin'],sha256=row['nativeSha256']),declaration=declaration))
    missile_path = PREFIX+'/AhriRMissile'
    spell = selected[missile_path]['mSpell']
    for field,key in [('mMissileEffectKey','Ahri_R_mis_02'),('mHitEffectKey','Ahri_R_Tar')]:
        require(spell[field] == key, 'Native R spell/effect alias differs')
        bind(missile_path,field,key,'spell',spell[field])
    require(spell['mMissileSpec'] == {
        'movementComponent': {'mTargetHeightAugment':100.0,'mOffsetInitialTargetHeight':100.0,
            'mStartBoneName':'chest','mSpeed':1400.0,'__type':'FixedSpeedMovement'},
        'verticalFacing':{'__type':'VeritcalFacingMatchVelocity'},
        'behaviors':[{'__type':'CastOnMovementComplete'},{'__type':'DestroyOnMovementComplete'}],
        '__type':'MissileSpecification'}, 'Native R missile declaration differs')
    require(spell['bHaveHitBone'] is True and spell['mHitBoneName'] == 'C_BUFFBONE_GLB_CHEST_LOC',
            'Native R contact bone differs')
    conditions = selected[PREFIX+'/AhriR']['mBuff']['PersistentEffectConditions']
    require(len(conditions) == 3, 'Native R counter condition closure differs')
    for i,condition in enumerate(conditions):
        key = f'Ahri_R_Indicator_{i+1}'
        require(condition == {
            'OwnerCondition':{'mValueA':{'Spell':PREFIX+'/AhriR','__type':'BuffCounterDynamicMaterialFloatDriver'},
                'mValueB':{'mValue':float(i+1),'__type':'FloatLiteralMaterialDriver'},
                '__type':'FloatComparisonMaterialDriver'},
            'PersistentVfxs':[{'boneName':'C_Buffbone_Glb_Layout_Loc','effectKey':key,'__type':'PersistentVfxData'}],
            '__type':'PersistentEffectConditionData'}, 'Native R counter driver differs')
        bind(PREFIX+'/AhriR',f'mBuff.PersistentEffectConditions[{i}].PersistentVfxs[0]',key,
             'persistent-counter-driver',condition)
    skin_conditions = model['skin']['data'][SKIN]['PersistentEffectConditions']
    skin = skin_conditions[1]
    require(skin == {'OwnerCondition':{'Spell':PREFIX+'/AhriR','__type':'HasBuffDynamicMaterialBoolDriver'},
        'PersistentVfxs':[{'boneName':bone,'effectKey':key,'__type':'PersistentVfxData'} for bone,key in
            [('L_Eye','Ahri_R_Eyes'),('R_Eye','Ahri_R_Eyes'),
             ('C_Buffbone_Glb_Layout_Loc','Ahri_R_TextureSwaps'),('C_Buffbone_Glb_Layout_Loc','Ahri_R_Ready_tar')]],
        '__type':'PersistentEffectConditionData'}, 'Native R skin-buff declaration differs')
    for i,event in enumerate(skin['PersistentVfxs']):
        bind(SKIN,f'PersistentEffectConditions[1].PersistentVfxs[{i}]',event['effectKey'],'persistent-skin-buff',event)
    events=[]
    for clip_name,clip in model['animations']['data']['Characters/Ahri/Animations/Skin0']['mClipDataMap'].items():
        for event_key,event in clip.get('mEventDataMap',{}).items():
            if event.get('__type') == 'ParticleEventData' and event.get('mEffectKey','').startswith('Ahri_R_'):
                events.append(dict(clipName=clip_name,eventKey=event_key,declaration=event))
    require(not events, 'Unexpected native R animation particle event')
    joined = {b['resourceKey'] for b in bindings}
    unjoined = sorted(set(particles['resources'])-joined)
    require(unjoined == ['Ahri_R_Ready_Aura','Ahri_R_cas','Ahri_R_mis'], 'Native R unjoined resource closure differs')
    paths={s.lower() for key in joined for s in strings(particles['resources'][key]['definition'])
           if s.lower().endswith(('.tex','.scb'))}
    native_assets={row['path']:row for row in particles['extraction']['files']}
    return dict(format=1,producerSha256=sha(Path(__file__).read_bytes()),
        sourceHelpers=[dict(path='tools/assets/ahri_r_particles.py',sha256=sha(Path(__file__).with_name('ahri_r_particles.py').read_bytes()))],
        inputs=[dict(path=name,bytes=len(inputs[name]),sha256=digest) for name,digest in PINS.items()],
        abilityPath=PREFIX,abilityDeclaration=ability,spellDeclarations=selected,skinPersistentCondition=skin,
        bindings=bindings,animationParticleEvents=events,unjoinedResourceKeys=unjoined,
        nullResources=particles['nullResources'],dependencies=[native_assets[p] for p in sorted(paths)],
        summary=dict(nativeSpellBindings=2,persistentCounterBindings=3,persistentSkinBindings=4,
            animationParticleEvents=0,joinedSystems=len(joined),joinedEmitters=sum(len(particles['resources'][k]['definition'].get('complexEmitterDefinitionData',[])) for k in joined),
            textures=sum(p.endswith('.tex') for p in paths),meshes=sum(p.endswith('.scb') for p in paths),unjoinedSystems=len(unjoined)),
        limits=['Explicit fields join the second missile variant, contact, three counter-driver indicators and four skin-buff instances.',
            'Counter comparison operators are omitted; operands and driver types remain raw without invented equality/default policy.',
            'Eyes have two explicit bones. TextureSwaps remains an identity-only record with no invented emitter or material swap.',
            'No R-prefixed animation particle event exists in the pinned clip map. Cast, first missile and ready aura remain unjoined.',
            'Native scripts, callback chronology, attachment transforms, frame conversion and GPU pixels remain unverified.',
            'No gameplay rules, saved histories, public assets or runtime dispatch change.'])


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true');parser.add_argument('--output',type=Path,default=TARGET)
    args=parser.parse_args();record=read();raw=(json.dumps(record,indent=2,allow_nan=False)+'\n').encode();path=args.output
    require(not any(p.is_symlink() for p in [path,*path.parents]),'Binding output cannot contain symlinks')
    require(not path.exists() or path.read_bytes()==raw,'Conflicting R binding output')
    require(not args.check or path.exists(),'Missing R binding output')
    if not args.check and not path.exists():
        path.parent.mkdir(parents=True,exist_ok=True)
        with path.open('xb') as stream:stream.write(raw)
    print(json.dumps(dict(result='passed',bytes=len(raw),sha256=sha(raw),**record['summary'])))
if __name__=='__main__':main()
