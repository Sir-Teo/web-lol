"""Cache-free whole-output and source rejection guards for the local event clock."""
import json,runpy,subprocess,sys,tempfile
from pathlib import Path
root=Path.cwd();producer=root/'tools/assets/export-ahri-q-cast-timing.py';module=runpy.run_path(str(producer));require=module['require'];flags=['-O']if sys.flags.optimize else[]
with tempfile.TemporaryDirectory(prefix='ahri-q-cast-clock-')as tmp:
 base=Path(tmp)
 for name in module['PINS']:
  path=base/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes((root/name).read_bytes())
 def run(check=False):return subprocess.run([sys.executable,*flags,str(producer),*(['--check']if check else[])],cwd=base,capture_output=True)
 require(run(True).returncode!=0,'Missing closure accepted')
 final=base/'docs/reference/ahri/q-cast-timing.json';final.write_bytes(b'conflict')
 require(run().returncode!=0 and not(base/'src').exists(),'Final conflict allowed a partial timing write');final.unlink()
 require(run().returncode==0 and run(True).returncode==0,'Fresh clock export/check failed')
 for name in ['src/content/ahri-q-cast-timing.ts','docs/reference/ahri/q-cast-timing.json']:require((base/name).read_bytes()==(root/name).read_bytes(),'Cache-free clock bytes differ')
 output=base/'src/content/ahri-q-cast-timing.ts';output.unlink();output.symlink_to(root/'src/content/ahri-q-cast-timing.ts');require(run().returncode!=0,'Leaf symlink accepted');output.unlink()
 folder=base/'src/content';folder.rmdir();folder.symlink_to(root/'src/content',target_is_directory=True);require(run().returncode!=0,'Parent symlink accepted');folder.unlink();folder.mkdir()
 header=base/'docs/reference/ahri/q-cast-animation-header.bin';header.write_bytes(header.read_bytes()+b' ');require(run().returncode!=0 and not output.exists(),'Changed native header accepted')
print(json.dumps(dict(result='passed',optimized=bool(sys.flags.optimize),rejectionProbes=5,privateCaches=False,privateTools=False,partialWrites=False)))
