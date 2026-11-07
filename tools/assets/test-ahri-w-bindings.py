"""Portable W alias/omission/output guards without native tools or private caches."""
import hashlib
import json
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
root=Path.cwd()
producer=root/'tools/assets/read-ahri-w-bindings.py'
module=runpy.run_path(str(producer))
flags=['-O'] if sys.flags.optimize else []
def require(ok,message):
    if not ok:raise ValueError(message)
with tempfile.TemporaryDirectory(prefix='ahri-w-bindings-') as tmp:
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
    orbit=declarations[prefix+'/AhriWMissile']['mSpell']['mMissileSpec']
    damage=declarations[prefix+'/AhriWDamageMissile']['mSpell']['mMissileSpec']
    entries=damage['movementComponent']['MovementEntries']
    require(orbit['visibilityComponent']=={'mTargetControlsVisibility':True,'__type':'Defaultvisibility'} and
            'visibilityComponent' not in damage,'Explicit/omitted visibility normalized')
    require(orbit['movementComponent']['mStartBoneName']=='chest' and
            damage['movementComponent']['mStartBoneName']=='spine','Declared start bones changed')
    require('value' not in entries[0] and [e['value'] for e in entries[1:]]==[90,-90,180,-180],
            'Omitted spline selector invented or ordered entries changed')
    require(record['unjoinedResourceKeys']==['Ahri_W_cas','Ahri_W_weap_cas'] and
            record['animationParticleEvents']==[],'Unbound producer invented')
    require([(r['field'],r['resourceKey']) for r in record['bindings']]==[
            ('mMissileEffectKey','Ahri_W_mis'),('mMissileEffectKey','Ahri_W_mis_02'),
            ('mHitEffectKey','Ahri_W_tar')],'Native alias joins changed')
    require(record['summary']==dict(nativeSpellBindings=3,joinedSystems=3,authoredEmitters=23,
            textures=30,meshes=1,splineEntries=5,animationParticleEvents=0,unjoinedSystems=2),
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
print(json.dumps(dict(result='passed',optimized=bool(sys.flags.optimize),rejectionProbes=9,
    sourcePinMutations=5,privateInputsRequired=False,nativeParserRequired=False,
    bindings=3,emitters=23,unjoinedSystems=2)))
