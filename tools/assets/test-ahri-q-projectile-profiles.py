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
producer=root/'tools/assets/prepare-ahri-q-projectile-profiles.py'
m=runpy.run_path(str(producer))
flags=['-O']if sys.flags.optimize else[]
inputs=[*m['PINS'],'docs/reference/ahri-model.json','docs/reference/ahri/q-particles.json']
def require(ok,message):
    if not ok: raise ValueError(message)
with tempfile.TemporaryDirectory(prefix='ahri-q-profiles-')as tmp:
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
    require(len(compiled)==36 and json.loads(expected)['counts']==dict(billboard=16,mesh=6,quad=2,ray=2,trail=10),'Emitter/primitive closure differs')
    trails=[p for p in compiled if p['kind']=='trail']
    require(sum(p['trail']['cameraFacing']for p in trails)==6 and sum(p['trail']['smoothing']is None for p in trails)==3 and all(p['trail']['cutoff']is None for p in trails),'Trail mode or omitted smoothing/cutoff normalized')
    indicator=next(p for p in compiled if p['system']=='Ahri_Q_mis_02'and p['name']=='Indicator')
    require(indicator['uv']['scroll']['sourceType']=='IntegratedValueVector2'and indicator['uv']['scroll']['authoredKeyCount']==2 and indicator['uv']['scroll']['constant']==[-4.5,0.0]and indicator['uv']['scroll']['values']==[[-0.9000000357627869,0.0],[-4.5,0.0]],'Integrated UV source type/base/curve flattened')
    trail=next(p for p in compiled if p['system']=='Ahri_Q_mis'and p['name']=='Trail3')
    require(trail['uv']['emitterScroll']==[.5,0] and trail['uv']['scroll']['authoredKeyCount']==0,'Emitter and particle UV clocks merged')
    require(next(p for p in compiled if p['name']=='sparkles_burst')['rate']['values']==[[75.0]] and next(p for p in compiled if p['name']=='sparkles_burst')['single'],'Single-particle burst rate dropped')
    require(sum(p['shape']['kind']=='cylinder'for p in compiled)==2,'Cylinder source lost')
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
textures=json.loads((root/'docs/reference/ahri/q-projectile-texture-transport.json').read_bytes())
meshes=json.loads((root/'docs/reference/ahri/q-projectile-mesh-transports.json').read_bytes())
t={r['source']['path']:r['path']for r in textures['textures']}
g={r['source']['path']:r['glb']['path']for r in meshes['meshes']}
for change in [lambda p:p['resources']['Ahri_Q_mis']['definition']['complexEmitterDefinitionData'].pop(),lambda p:p['resources']['Ahri_Q_mis']['definition']['complexEmitterDefinitionData'][0].update(unhandledField=1),lambda p:p['resources']['Ahri_Q_mis']['definition']['complexEmitterDefinitionData'][4]['primitive']['mTrail'].update(mMode=3)]:
    changed=copy.deepcopy(pin);change(changed)
    try:m['profiles'](changed,t,g)
    except(ValueError,KeyError):pass
    else:raise ValueError('Unhandled emitter removal/field/trail mode accepted')
print(json.dumps(dict(result='passed',optimized=bool(sys.flags.optimize),sourcePinMutations=5,structuralMutationCases=3,privateInputsRequired=False,nativeParserRequired=False,profiles=36,authoredFields=45)))
