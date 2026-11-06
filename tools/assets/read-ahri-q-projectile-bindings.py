"""Join native Q missile/return spell declarations to checked base-skin resources."""
import argparse
import hashlib
import json
from pathlib import Path
from ahri_q_particles import load, checked, require, strings

PINS = {
    'docs/reference/ahri/character.json': 'aa7ec5f710aa818c2ecc98a516bb1542bb52261c7ce89649ef0b2b8e8cc5ec5e',
    'docs/reference/ahri/names.json': '770a7e5b7bdaf1d1de42b7d33a09912a8e56a3244bb0ab2b5d00d94e8b0013a2',
    'docs/reference/ahri/character.bin': '121997c9c4ef2ff0f671b659d64d2e22cb71208216ddcc3c4f552a17f196d2cb',
    'docs/reference/ahri-model.json': '74d0b55f5aad08646fbd24f660ed533bc8fd5798e8a60dc0983d97960b47a377',
    'docs/reference/ahri/q-particles.json': '613f21651105761810963a32275a52b073189ccdea7286af78980d558b3db2c3',
}
TARGET = Path('docs/reference/ahri/q-projectile-bindings.json')

def sha(raw): return hashlib.sha256(raw).hexdigest()

def read():
    inputs={name:checked(name,digest) for name,digest in PINS.items()}
    particles,model=load()
    character=json.loads(inputs['docs/reference/ahri/character.json'])
    require(character['sha256']==PINS['docs/reference/ahri/names.json'], 'Character named-record source binding differs')
    native_character=next(r for r in character['extraction']['files'] if r['path']=='data/characters/ahri/ahri.bin')
    require(native_character['sha256']==PINS['docs/reference/ahri/character.bin'] and native_character['bytes']==len(inputs['docs/reference/ahri/character.bin']), 'Character native extraction binding differs')
    records=character['records'];prefix='Characters/Ahri/Spells/AhriQAbility';ability=records[prefix]
    require(ability['mRootSpell']==prefix+'/AhriQ' and ability['mChildSpells']==[prefix+'/AhriQ',prefix+'/AhriQMissile',prefix+'/AhriQReturnMissile'], 'Q native ability/child closure differs')
    resources=model['skin']['data']['Characters/Ahri/Skins/Skin0/Resources']['resourceMap']
    rows=[];paths=set()
    for name,key,count in [('AhriQMissile','Ahri_Q_mis',16),('AhriQReturnMissile','Ahri_Q_mis_02',20)]:
        path=prefix+'/'+name;declaration=records[path];spell=declaration['mSpell'];resource=particles['resources'][key]
        require(declaration['objectPath']==path and declaration['mScriptName']==name and spell['mMissileEffectKey']==key, 'Native Q spell/effect alias differs')
        require(resource['record']==resources[key] and len(resource['definition']['complexEmitterDefinitionData'])==count, 'Unjoined Q resource/emitter closure')
        spec=spell['mMissileSpec'];require(spec['__type']=='MissileSpecification' and spec['movementComponent']['__type']=='AcceleratingMovement', 'Q missile movement declaration differs')
        require([b['__type']for b in spec['behaviors']]==['CastOnHit','DestroyOnMovementComplete'], 'Q missile behaviors differ')
        paths.update(v.lower() for v in strings(resource['definition']) if v.lower().endswith(('.tex','.scb')))
        rows.append(dict(spellPath=path,scriptName=name,declaration=declaration,resourceKey=key,resourceRecord=resource['record'],nativeParticleBin=dict(path=resource['sourceBin'],sha256=resource['nativeSha256']),emitterCount=count,explicitSpellFields=sorted(spell),explicitSpecificationFields=sorted(spec),explicitMovementFields=sorted(spec['movementComponent'])))
    outward=rows[0]['declaration']['mSpell']['mMissileSpec'];returning=rows[1]['declaration']['mSpell']['mMissileSpec']
    require('visibilityComponent' not in outward and returning['visibilityComponent']=={'__type':'EnterFOWVisibility'}, 'Q omitted/explicit visibility differs')
    require(outward['movementComponent']['mStartBoneName']=='' and returning['movementComponent']['mStartBoneName']=='root', 'Q declared start bones differ')
    native={r['path']:r for r in particles['extraction']['files']};require(len(paths)==20 and sum(p.endswith('.tex')for p in paths)==17 and sum(p.endswith('.scb')for p in paths)==3, 'Q projectile dependency closure differs')
    return dict(format=1,producerSha256=sha(Path(__file__).read_bytes()),sourceHelperSha256=sha(Path(__file__).with_name('ahri_q_particles.py').read_bytes()),inputs=[dict(path=name,bytes=len(inputs[name]),sha256=digest)for name,digest in PINS.items()],abilityPath=prefix,abilityDeclaration=ability,missiles=rows,dependencies=[native[p]for p in sorted(paths)],summary=dict(nativeSpellBindings=2,joinedSystems=2,authoredEmitters=36,textures=17,meshes=3),limits=['Exact native Missile/ReturnMissile effect aliases are joined to base-skin resource declarations. The native script body and callback chronology are not supplied by these records.','All selected spell fields remain verbatim, including movement, targeting, damage and client metadata. This reader generates no gameplay rules.','The ordinary missile omits visibilityComponent and has an empty start-bone string. The return declares EnterFOWVisibility and root. Missing and empty fields receive no invented defaults.','Native movement/visibility flags do not establish renderer fog policy, height transforms, trail frames, material arithmetic, particle stop dispatch or pixels.','Private transports and future local outgoing/return phase adapters keep separate verification scope.'])

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');parser.add_argument('--output',type=Path,default=TARGET);args=parser.parse_args()
    record=read();raw=(json.dumps(record,indent=2,allow_nan=False)+'\n').encode();path=args.output
    require(not any(p.is_symlink()for p in [path,*path.parents]), 'Binding output cannot contain symlinks')
    require(not path.exists()or path.read_bytes()==raw,'Conflicting Q projectile binding output');require(not args.check or path.exists(),'Missing Q projectile binding output')
    if not args.check and not path.exists():
        path.parent.mkdir(parents=True,exist_ok=True)
        with path.open('xb')as stream:stream.write(raw)
    print(json.dumps(dict(result='passed',bytes=len(raw),sha256=sha(raw),**record['summary'])))
if __name__=='__main__':main()
