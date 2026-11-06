"""Portable W selector joins reject changed pins and conflicting output."""
import json
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile

root=Path.cwd()
producer=root/'tools/assets/read-ahri-w-attached-bindings.py'
m=runpy.run_path(str(producer))
flags=['-O'] if sys.flags.optimize else []
def require(ok,message):
    if not ok: raise ValueError(message)
with tempfile.TemporaryDirectory(prefix='w-attached-') as tmp:
    base=Path(tmp)
    for name in m['PINS']:
        p=base/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((root/name).read_bytes())
    output=base/m['TARGET'];expected=(root/m['TARGET']).read_bytes()
    def run(*args): return subprocess.run([sys.executable,*flags,str(producer),*args],cwd=base,capture_output=True)
    require(run('--check').returncode!=0 and not output.exists(),'Missing attachment output accepted')
    require(run().returncode==0 and output.read_bytes()==expected,'Clean attachment reproduction differs')
    require(run('--check').returncode==0,'Clean attachment check differs')
    data=json.loads(expected)
    require([c['nativeDraw']['name'] for c in data['attachedMeshes'][0]['candidates']]==['Tails','Tail_Large'],
            'Source selector names differ')
    require(data['summary']['defaultHiddenMatches']==1,'Hidden source draw lost')
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
