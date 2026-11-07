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
producer=root/'tools/assets/prepare-ahri-r-profiles.py'
m=runpy.run_path(str(producer))
flags=['-O']if sys.flags.optimize else[]
inputs=[*m['PINS'],'docs/reference/ahri-model.json','docs/reference/ahri/r-particles.json']
def require(ok,message):
    if not ok: raise ValueError(message)
with tempfile.TemporaryDirectory(prefix='ahri-r-profiles-')as tmp:
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
    require(len(compiled)==55 and json.loads(expected)['counts']==dict(billboard=23,mesh=6,quad=13,trail=13),'Emitter/primitive closure differs')
    require(sum(p['emitterLife'] is None for p in compiled)==14,'Missing emitter lifetimes were filled')
    require(sum(p['palette'] is not None and p['palette']['texture'] is None for p in compiled)==3,'Missing palette texture invented')
    source=json.loads((base/'docs/reference/ahri/r-particles.json').read_bytes())
    for p in compiled:
        native=source['resources'][p['system']]['definition']['complexEmitterDefinitionData'][p['index']]
        require(json.dumps(native)==json.dumps(p['sourceDeclaration']),'Raw source declaration or value types changed')
        require({f['name'] for f in p['nativeFields']}==set(native)-{'__type'},'Native field tags lost')
    require(sum(f['type']=='FLAG' for p in compiled for f in p['nativeFields'])==123,'Native FLAG tags lost')
    unresolved=next(p for p in compiled if p['palette'] and p['palette']['unresolvedFields'])
    require(set(unresolved['palette']['unresolvedFields'])=={'{143f06d1}'} and
            'native-palette-field' in unresolved['bindingRequirements'],'Unknown palette field lost or silently bound')
    require(sum('noise-field-arithmetic' in p['bindingRequirements'] for p in compiled)==2 and
            sum('box-shape-dimensions' in p['bindingRequirements'] for p in compiled)==1 and
            sum('native-producer-dispatch' in p['bindingRequirements'] for p in compiled)==16,
            'Native binding requirements lost')
    period=next(p for p in compiled if p['period'] is not None)
    require('{99c94704}' in period['sourceDeclaration'] and
            period['period']==period['sourceDeclaration']['{99c94704}'],'Named period alias changed raw source')
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
textures=json.loads((root/'docs/reference/ahri/r-texture-transports.json').read_bytes())
meshes=json.loads((root/'docs/reference/ahri/r-mesh-transports.json').read_bytes())
t={r['source']['path']:r['path']for r in textures['textures']}
g={r['source']['path']:r['glb']['path']for r in meshes['meshes']}
def first(pin,field):
    return next(e for r in pin['resources'].values() for e in r['definition'].get('complexEmitterDefinitionData',[]) if field in e)
mutations=[
    lambda p:p['resources']['Ahri_R_mis']['definition']['complexEmitterDefinitionData'].pop(),
    lambda p:p['resources']['Ahri_R_mis']['definition']['complexEmitterDefinitionData'][0].update(unhandledField=1),
    lambda p:first(p,'{f02bd44d}').update(colorLookUpScales=[1,1]),
    lambda p:first(p,'{f02bd44d}').update({'{f02bd44d}':[1]}),
    lambda p:first(p,'isSingleParticle').update(isSingleParticle=True),
    lambda p:first(p,'distortionDefinition')['distortionDefinition'].update(unhandledField=1),
    lambda p:first(p,'fieldCollectionDefinition')['fieldCollectionDefinition'].update(unhandledField=1),
    lambda p:first(p,'textureMult')['textureMult'].update(unhandledField=1),
    lambda p:first(p,'uvRotation').update(uvRotation={'constantValue':float('nan')}),
]
for change in mutations:
    changed=copy.deepcopy(pin);change(changed)
    try:m['profiles'](changed,t,g)
    except(ValueError,KeyError):pass
    else:raise ValueError('Unhandled source field, alias collision, flag coercion or invalid curve accepted')
compiled=m['profiles'](pin,t,g)
compiled[0]['sourceDeclaration']['emitterName']='changed owned output'
require(pin['resources'][compiled[0]['system']]['definition']['complexEmitterDefinitionData'][0]['emitterName']!='changed owned output','Projection aliases frozen input')
print(json.dumps(dict(result='passed',optimized=bool(sys.flags.optimize),sourcePinMutations=6,structuralMutationCases=len(mutations),privateInputsRequired=False,nativeParserRequired=False,profiles=55,authoredFields=68)))
