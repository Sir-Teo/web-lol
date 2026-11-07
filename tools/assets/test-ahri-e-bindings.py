"""Portable E alias/omission/output guards without native tools or private caches."""
import hashlib
import json
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
root=Path.cwd()
producer=root/'tools/assets/read-ahri-e-bindings.py'
module=runpy.run_path(str(producer))
flags=['-O'] if sys.flags.optimize else []
def require(ok,message):
    if not ok:raise ValueError(message)
with tempfile.TemporaryDirectory(prefix='ahri-e-bindings-') as tmp:
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
    declarations=record['spellDeclarations']
    missile=declarations[prefix+'/AhriEMissile']['mSpell']
    require('visibilityComponent' not in missile['mMissileSpec'],'Omitted visibility normalized')
    require(missile['mHitBoneName']=='spine' and declarations[prefix+'/AhriE']['mSpell']['mHitBoneName']=='head',
            'Distinct hit bones normalized')
    effects=declarations[prefix+'/AhriE']['mBuff']['PersistentEffectConditions'][0]['PersistentVfxs']
    require([e['effectKey'] for e in effects]==['Ahri_E_buf','{44fc6ec4}'],'Hashed buff dependency omitted')
    events=record['animationParticleEvents']
    require(len(events)==4 and {e['clipName'] for e in events}==
            {'Spell3_East','Spell3_North','Spell3_South','Spell3_West'} and
            all(e['declaration']['mStartFrame']==1 and 'mEndFrame' not in e['declaration'] for e in events),
            'Directional animation closure or omissions differ')
    require(record['unjoinedResourceKeys']==[] and len(record['bindings'])==8,'Explicit producer closure differs')
    require(record['summary']==dict(nativeSpellBindings=2,persistentBuffBindings=2,animationParticleEvents=4,
            joinedSystems=5,authoredEmitters=29,textures=22,meshes=2,unjoinedSystems=0),
            'Bound recursive closure differs')
    require(record['producerSha256']==hashlib.sha256(producer.read_bytes()).hexdigest(),'Producer identity differs')
    for name in module['PINS']:
        path=base/name;raw=path.read_bytes();path.write_bytes(b'changed')
        require(run().returncode!=0 and target.read_bytes()==expected,
                'Changed source accepted or output repaired: '+name)
        path.write_bytes(raw)
    target.write_bytes(b'conflict')
    require(run().returncode!=0 and target.read_bytes()==b'conflict','Conflicting output repaired')
    target.unlink();target.symlink_to(root/module['TARGET'])
    require(run('--check').returncode!=0,'Symlink leaf accepted')
    target.unlink();target.write_bytes(expected)
    outside=base/'untouched';outside.mkdir()
    link=base/'redirect';link.symlink_to(outside,target_is_directory=True)
    require(run('--output',str(link/'new.json')).returncode!=0 and list(outside.iterdir())==[],
            'Symlink parent accepted or wrote outside target')
print(json.dumps(dict(result='passed',optimized=bool(sys.flags.optimize),rejectionProbes=10,
    sourcePinMutations=6,privateInputsRequired=False,nativeParserRequired=False,
    bindings=8,emitters=29,unjoinedSystems=0)))
