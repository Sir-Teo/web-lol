"""Portable native alias/source/output guards; no decoder, network or private cache."""
import hashlib
import json
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile

root=Path.cwd();producer=root/'tools/assets/read-ahri-q-projectile-bindings.py';module=runpy.run_path(str(producer));flags=['-O']if sys.flags.optimize else[]
def require(ok,message):
    if not ok: raise ValueError(message)
with tempfile.TemporaryDirectory(prefix='ahri-q-projectile-bindings-')as tmp:
    base=Path(tmp)
    for name in module['PINS']:
        target=base/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((root/name).read_bytes())
    target=base/module['TARGET'];expected=(root/module['TARGET']).read_bytes()
    def run(*args):return subprocess.run([sys.executable,*flags,str(producer),*args],cwd=base,capture_output=True)
    require(run('--check').returncode!=0 and not target.exists(),'Missing output accepted or created during check')
    require(run().returncode==0 and target.read_bytes()==expected and run('--check').returncode==0,'Fresh portable reading differs')
    record=json.loads(expected);ordinary,returning=[r['declaration']['mSpell']['mMissileSpec']for r in record['missiles']]
    require('visibilityComponent'not in ordinary and returning['visibilityComponent']=={'__type':'EnterFOWVisibility'},'Absent/explicit visibility normalized')
    require(ordinary['movementComponent']['mStartBoneName']=='' and returning['movementComponent']['mStartBoneName']=='root','Empty/authored bone normalized')
    require([r['resourceKey']for r in record['missiles']]==['Ahri_Q_mis','Ahri_Q_mis_02'] and record['summary']==dict(nativeSpellBindings=2,joinedSystems=2,authoredEmitters=36,textures=17,meshes=3),'Alias or recursive dependency closure differs')
    require(record['producerSha256']==hashlib.sha256(producer.read_bytes()).hexdigest(),'Producer identity differs')
    for name in module['PINS']:
        path=base/name;raw=path.read_bytes();path.write_bytes(b'changed');require(run().returncode!=0 and target.read_bytes()==expected,'Changed source accepted or output repaired: '+name);path.write_bytes(raw)
    target.write_bytes(b'conflict');require(run().returncode!=0 and target.read_bytes()==b'conflict','Conflicting output repaired');target.unlink()
    target.symlink_to(root/module['TARGET']);require(run('--check').returncode!=0,'Symlink leaf accepted');target.unlink();target.write_bytes(expected)
    outside=base/'untouched';outside.mkdir();link=base/'redirect';link.symlink_to(outside,target_is_directory=True)
    require(run('--output',str(link/'new.json')).returncode!=0 and list(outside.iterdir())==[],'Symlink parent accepted or wrote outside target')
print(json.dumps(dict(result='passed',optimized=bool(sys.flags.optimize),rejectionProbes=9,sourcePinMutations=5,privateInputsRequired=False,nativeParserRequired=False,bindings=2,emitters=36)))
