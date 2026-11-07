"""Portable Spirit Rush producer, native omission and output-preflight guards."""
import hashlib
import json
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
root=Path.cwd()
producer=root/'tools/assets/read-ahri-r-bindings.py'
module=runpy.run_path(str(producer))
flags=['-O'] if sys.flags.optimize else []
def require(ok,message):
    if not ok:raise ValueError(message)
with tempfile.TemporaryDirectory(prefix='ahri-r-bindings-') as tmp:
    base=Path(tmp)
    for name in module['PINS']:
        target=base/name;target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes((root/name).read_bytes())
    target=base/module['TARGET'];expected=(root/module['TARGET']).read_bytes()
    def run(*args):
        return subprocess.run([sys.executable,*flags,str(producer),*args],cwd=base,capture_output=True)
    require(run('--check').returncode!=0 and not target.exists(),'Missing output accepted or written during check')
    require(run().returncode==0 and target.read_bytes()==expected and run('--check').returncode==0,
            'Fresh portable reading differs')
    record=json.loads(expected);prefix=record['abilityPath']
    missile=record['spellDeclarations'][prefix+'/AhriRMissile']['mSpell']
    movement=missile['mMissileSpec']['movementComponent']
    require('mTracksTarget' not in movement and 'visibilityComponent' not in missile['mMissileSpec'],
            'Omitted missile tracking/visibility normalized')
    require(movement['mStartBoneName']=='chest' and missile['mHitBoneName']=='C_BUFFBONE_GLB_CHEST_LOC',
            'Distinct source/contact bones normalized')
    conditions=record['spellDeclarations'][prefix+'/AhriR']['mBuff']['PersistentEffectConditions']
    require([c['OwnerCondition']['mValueB']['mValue'] for c in conditions]==[1,2,3] and
            all(set(c['OwnerCondition'])=={'mValueA','mValueB','__type'} for c in conditions),
            'Native counter operands or omitted operators differ')
    skin=record['skinPersistentCondition']
    require(skin['OwnerCondition']=={'Spell':prefix+'/AhriR','__type':'HasBuffDynamicMaterialBoolDriver'} and
            [e['boneName'] for e in skin['PersistentVfxs'][:2]]==['L_Eye','R_Eye'],
            'Skin-buff condition or eye instances differ')
    require(record['nullResources']=={'Ahri_R_Transform_Out':'{00000000}'} and
            record['unjoinedResourceKeys']==['Ahri_R_Ready_Aura','Ahri_R_cas','Ahri_R_mis'] and
            record['animationParticleEvents']==[], 'Unjoined/null/animation omissions differ')
    require(len(record['bindings'])==9 and
            next(b for b in record['bindings'] if b['resourceKey']=='Ahri_R_TextureSwaps')['emitterCount']==0,
            'Empty native texture-swap record invented emitters')
    require(record['summary']==dict(nativeSpellBindings=2,persistentCounterBindings=3,persistentSkinBindings=4,
            animationParticleEvents=0,joinedSystems=8,joinedEmitters=39,textures=38,meshes=2,unjoinedSystems=3),
            'Explicit bound dependency closure differs')
    require(record['producerSha256']==hashlib.sha256(producer.read_bytes()).hexdigest(),'Producer identity differs')
    for name in module['PINS']:
        path=base/name;raw=path.read_bytes();path.write_bytes(b'changed')
        require(run().returncode!=0 and target.read_bytes()==expected,'Changed source accepted or output repaired: '+name)
        path.write_bytes(raw)
    target.write_bytes(b'conflict')
    require(run().returncode!=0 and target.read_bytes()==b'conflict','Conflicting output repaired')
    target.unlink();target.symlink_to(root/module['TARGET'])
    require(run('--check').returncode!=0,'Symlink leaf accepted')
    target.unlink();target.write_bytes(expected)
    outside=base/'untouched';outside.mkdir();link=base/'redirect';link.symlink_to(outside,target_is_directory=True)
    require(run('--output',str(link/'new.json')).returncode!=0 and list(outside.iterdir())==[],
            'Symlink parent accepted or wrote outside target')
print(json.dumps(dict(result='passed',optimized=bool(sys.flags.optimize),rejectionProbes=9,
    sourcePinMutations=5,privateInputsRequired=False,nativeParserRequired=False,
    bindings=9,emitters=39,unjoinedSystems=3)))
