"""Portable E selector joins reject changed pins and conflicting output."""
import json
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile

root=Path.cwd()
producer=root/'tools/assets/read-ahri-e-attached-bindings.py'
m=runpy.run_path(str(producer))
flags=['-O'] if sys.flags.optimize else []
def require(ok,message):
    if not ok: raise ValueError(message)
with tempfile.TemporaryDirectory(prefix='e-attached-') as tmp:
    base=Path(tmp)
    for name in m['PINS']:
        p=base/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((root/name).read_bytes())
    output=base/m['TARGET'];expected=(root/m['TARGET']).read_bytes()
    def run(*args): return subprocess.run([sys.executable,*flags,str(producer),*args],cwd=base,capture_output=True)
    require(run('--check').returncode!=0 and not output.exists(),'Missing attachment output accepted')
    require(run().returncode==0 and output.read_bytes()==expected,'Clean attachment reproduction differs')
    require(run('--check').returncode==0,'Clean attachment check differs')
    data=json.loads(expected)
    rows={r['resourceKey']:r for r in data['attachedMeshes']}
    require(not rows['Ahri_E_buf']['selectorsPresent'] and
            'mSubmeshesToDraw' not in rows['Ahri_E_buf']['primitive']['mMesh'], 'Omitted selectors invented')
    cast=rows['Ahri_E_cas']['candidates']
    require([c['selector'] for c in cast]==['{07c39130}','{62579b4c}'] and
            cast[0]['nativeDraws'][0]['name']=='Tails' and len(cast[0]['transportDraws'])==1 and
            cast[1]['nativeDraws']==[] and cast[1]['transportDraws']==[], 'Retained selector candidates differ')
    require(data['summary']==dict(attachedEmitters=2,selectorListsPresent=1,selectors=2,
            nativeMatches=1,transportMatches=1,unmatchedSelectors=1), 'Selector closure differs')
    for name in m['PINS']:
        p=base/name;raw=p.read_bytes();p.write_bytes(b'changed')
        require(run().returncode!=0 and output.read_bytes()==expected,'Changed pin accepted: '+name)
        p.write_bytes(raw)
    output.write_bytes(b'conflict')
    require(run().returncode!=0 and output.read_bytes()==b'conflict','Conflicting attachment output repaired')
    output.unlink();output.symlink_to(root/m['TARGET'])
    require(run('--check').returncode!=0,'Leaf symlink accepted')
    output.unlink();output.write_bytes(expected)
    parent=output.parent;held=base/'held';parent.rename(held);parent.symlink_to(root/m['TARGET'].parent,target_is_directory=True)
    require(run('--check').returncode!=0,'Parent symlink accepted')
print(json.dumps(dict(result='passed',optimized=bool(sys.flags.optimize),pinMutations=len(m['PINS']),
    selectors=2,privateInputsRequired=False,nativeParserRequired=False)))
