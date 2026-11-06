"""Reject dropped projectile fields and partial publication without private asset inputs."""
import copy
import hashlib
import json
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile

root=Path.cwd()
producer=root/'tools/assets/prepare-ahri-w-profiles.py'
m=runpy.run_path(str(producer))
flags=['-O']if sys.flags.optimize else[]
inputs=[*m['PINS'],'docs/reference/ahri-model.json','docs/reference/ahri/w-particles.json']
def require(ok,message):
    if not ok: raise ValueError(message)
with tempfile.TemporaryDirectory(prefix='ahri-w-profiles-')as tmp:
    base=Path(tmp)
    for name in inputs:
        target=base/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((root/name).read_bytes())
    profile=base/m['OUTPUT'];reading=base/m['READING'];expected=(root/m['READING']).read_bytes()
    def run(*args):return subprocess.run([sys.executable,*flags,str(producer),*args],cwd=base,capture_output=True)
    require(run('--check').returncode!=0 and not profile.exists(),'Missing profile accepted or created by check')
    reading.write_bytes(b'conflict')
    require(run().returncode!=0 and not(base/'.cache').exists()and reading.read_bytes()==b'conflict','Final conflict allowed partial private profile writes')
    reading.unlink()
    require(run().returncode==0 and reading.read_bytes()==expected and run('--check').returncode==0 and run('--verify-reading').returncode==0,'Fresh profile preparation differs')
    compiled=json.loads(profile.read_bytes())['profiles']
    require(len(compiled)==30 and json.loads(expected)['counts']==dict(billboard=18,mesh=3,quad=5,ray=1,skin=1,trail=2),'Emitter/primitive closure differs')
    require(sum(p['emitterLife'] is None for p in compiled)==8,'Missing emitter lifetimes were filled')
    require(sum(p['palette'] is not None and p['palette']['texture'] is None for p in compiled)==2,'Missing palette texture was invented')
    signed=[p for p in compiled if p['uv']['sourceDivisions']==[1,-1]]
    require(len(signed)==1 and signed[0]['uv']['divisions']==[1,1] and 'signed-uv-divisions' in signed[0]['bindingRequirements'],'Signed native UV book was lost')
    shared=[p['sharedRandomValue'] for p in compiled if p['sharedRandomValue'] is not None]
    require(shared==[1] and type(shared[0]) is int,'Shared random integer coerced to bool')
    skin=next(p for p in compiled if p['kind']=='skin')
    require(skin['attached']['mSubmeshesToDraw']==['{07c39130}','{8c0f48e3}'],'Attached mesh selectors changed')
    saved=profile.read_bytes()
    for name in inputs:
        path=base/name;raw=path.read_bytes();path.write_bytes(b'changed')
        require(run().returncode!=0 and profile.read_bytes()==saved and reading.read_bytes()==expected,'Changed source accepted or repaired outputs: '+name)
        path.write_bytes(raw)
    profile.write_bytes(saved[:-1]);require(run().returncode!=0 and profile.read_bytes()==saved[:-1],'Corrupt profile silently repaired');profile.write_bytes(saved)
    reading.write_bytes(expected[:-1]);require(run('--verify-reading').returncode!=0,'Corrupt reading accepted');reading.write_bytes(expected)
    profile.unlink();profile.symlink_to(root/m['OUTPUT']);require(run('--check').returncode!=0,'Profile leaf symlink accepted');profile.unlink();profile.write_bytes(saved)
    folder=profile.parent;held=base/'held';folder.rename(held);folder.symlink_to(root/m['OUTPUT'].parent,target_is_directory=True)
    require(run().returncode!=0,'Profile parent symlink accepted');folder.unlink();held.rename(folder)
    reading.unlink();reading.symlink_to(root/m['READING']);require(run('--verify-reading').returncode!=0,'Reading symlink accepted')
# Structural mutations exercise the compiler independently of the frozen input hash.
pin,_=m['load']()
textures=json.loads((root/'docs/reference/ahri/w-texture-transports.json').read_bytes())
meshes=json.loads((root/'docs/reference/ahri/w-mesh-transports.json').read_bytes())
t={r['source']['path']:r['path']for r in textures['textures']}
g={r['source']['path']:r['glb']['path']for r in meshes['meshes']}
for change in [lambda p:p['resources']['Ahri_W_mis']['definition']['complexEmitterDefinitionData'].pop(),lambda p:p['resources']['Ahri_W_mis']['definition']['complexEmitterDefinitionData'][0].update(unhandledField=1)]:
    changed=copy.deepcopy(pin);change(changed)
    try:m['profiles'](changed,t,g)
    except(ValueError,KeyError):pass
    else:raise ValueError('Unhandled emitter removal/field/trail mode accepted')
print(json.dumps(dict(result='passed',optimized=bool(sys.flags.optimize),sourcePinMutations=5,structuralMutationCases=2,privateInputsRequired=False,nativeParserRequired=False,profiles=30,authoredFields=66)))
