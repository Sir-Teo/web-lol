"""Reproduce cast publication from committed identical transports; reject partial writes."""
import json,subprocess,sys,tempfile
from pathlib import Path
root=Path.cwd();producer=root/'tools/assets/export-ahri-q-cast-particles.py';flags=['-O']if sys.flags.optimize else[]
def require(ok,message):
 if not ok:raise ValueError(message)
with tempfile.TemporaryDirectory(prefix='ahri-cast-publish-')as tmp:
 base=Path(tmp)
 for name in ['docs/reference/ahri-model.json','docs/reference/ahri/q-particles.json','docs/reference/ahri/q-cast-texture-transport.json','docs/reference/ahri/q-cast-mesh-transport.json','src/content/leona-w-skin-fresnel.json']:
  p=base/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((root/name).read_bytes())
 texture=json.loads((root/'docs/reference/ahri/q-cast-texture-transport.json').read_text())
 for t in texture['textures']:
  target=base/t['path'];target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((root/f"public/assets/effects/ahri-q-cast-{t['source']['wadPathHash']}.png").read_bytes())
 mesh=json.loads((root/'docs/reference/ahri/q-cast-mesh-transport.json').read_text());target=base/mesh['glb']['path'];target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((root/'public/assets/effects/ahri-q-cast-swirls.glb').read_bytes())
 def run(check=False):return subprocess.run([sys.executable,*flags,str(producer),*(['--check']if check else[])],cwd=base,capture_output=True)
 require(run(True).returncode!=0,'Missing publication accepted')
 final=base/'docs/reference/ahri/q-cast-particle-reading.json';final.write_bytes(b'conflict');require(run().returncode!=0 and not(base/'public').exists(),'Final conflict allowed partial asset writes');final.unlink()
 require(run().returncode==0 and run(True).returncode==0,'Fresh publication/check failed')
 output=base/'public/assets/effects/ahri-q-cast-swirls.glb';raw=output.read_bytes();output.write_bytes(raw[:-1]);require(run().returncode!=0 and output.read_bytes()==raw[:-1],'Corrupt output repaired');output.unlink();output.symlink_to(root/'public/assets/effects/ahri-q-cast-swirls.glb');require(run().returncode!=0,'Leaf symlink accepted');output.unlink();output.write_bytes(raw)
 folder=base/'public/assets/effects';saved=base/'saved';folder.rename(saved);folder.symlink_to(root/'public/assets/effects',target_is_directory=True);require(run().returncode!=0,'Parent symlink accepted');folder.unlink();saved.rename(folder)
 input=base/texture['textures'][0]['path'];input.write_bytes(b'changed');require(run().returncode!=0 and output.read_bytes()==raw,'Changed source accepted')
print(json.dumps(dict(result='passed',optimized=bool(sys.flags.optimize),rejectionProbes=6,privateInputsRequired=False,partialWrites=False)))
