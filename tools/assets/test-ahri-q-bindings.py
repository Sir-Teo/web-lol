"""Cache-free source/transport binding guards; no native decoder or private cache required."""
import json
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile

root=Path.cwd();producer=root/'tools/assets/read-ahri-q-bindings.py';module=runpy.run_path(str(producer));flags=['-O'] if sys.flags.optimize else []
require=module['require']
with tempfile.TemporaryDirectory(prefix='ahri-q-bindings-') as tmp:
    base=Path(tmp)
    for name in module['PINS']:
        path=base/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes((root/name).read_bytes())
    require(not (base/'.cache').exists() and not (base/'.tools').exists(),'Private fixture directories present')
    output=base/'reading.json'
    def run(check=False):
        return subprocess.run([sys.executable,*flags,str(producer),'--output',str(output),*(['--check'] if check else [])],cwd=base,capture_output=True)
    require(run(True).returncode != 0 and not output.exists(),'Missing output accepted or created')
    require(run().returncode == 0 and run(True).returncode == 0,'Fresh source binding export/check failed')
    original=output.read_bytes();require(original == (root/'docs/reference/ahri/q-particle-bindings.json').read_bytes(),'Cache-free binding output differs')
    record=json.loads(original);require(record['summary']['unmatchedRetainedSelectors']==['{62579b4c}'],'Unmatched selector was hidden')
    require(record['animationEvents'][0]['declaration'].get('mStartFrame')==5.0,'Explicit cast frame missing')
    output.write_bytes(b'changed');require(run().returncode!=0 and output.read_bytes()==b'changed','Changed output overwritten')
    output.unlink();output.symlink_to(root/'docs/reference/ahri/q-particle-bindings.json');require(run().returncode!=0,'Leaf symlink accepted');output.unlink()
    redirect=base/'redirect';redirect.symlink_to(base/'docs/reference/ahri',target_is_directory=True);saved=output;output=redirect/'reading.json';require(run().returncode!=0 and not output.exists(),'Parent symlink accepted');output=saved
    pin=base/'docs/reference/ahri/q-particles.json';raw=pin.read_bytes();pin.write_bytes(raw+b' ');require(run().returncode!=0 and not output.exists(),'Changed particle pin accepted');pin.write_bytes(raw)
    (base/'public/assets/models/ahri-base.glb').unlink();require(run().returncode!=0 and not output.exists(),'Missing transport accepted')
print(json.dumps(dict(result='passed',optimized=bool(sys.flags.optimize),rejectionProbes=6,privateCaches=False,privateTools=False,repositoryAssetsChanged=False)))
