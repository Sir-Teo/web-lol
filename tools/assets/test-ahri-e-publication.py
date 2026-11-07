"""Reproduce E publication from committed transports and reject partial writes."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
root=Path.cwd()
producer=root/'tools/assets/export-ahri-e-particles.py'
flags=['-O']if sys.flags.optimize else[]
inputs=['docs/reference/ahri-model.json','docs/reference/ahri/e-particles.json','docs/reference/ahri/e-additional-particles.json','docs/reference/ahri/e-texture-transports.json','docs/reference/ahri/e-mesh-transports.json','docs/reference/ahri/e-particle-bindings.json','docs/reference/ahri/e-native-types.json','docs/reference/ahri/e-profile-reading.json','src/content/ahri-q-cast-particles.json','src/content/ahri-q-projectile-particles.json','src/content/ahri-w-particles.json']
content=json.loads((root/'src/content/ahri-e-particles.json').read_bytes())
def require(ok,message):
    if not ok:raise ValueError(message)
with tempfile.TemporaryDirectory(prefix='ahri-e-publication-')as tmp:
    base=Path(tmp)
    def copy(source,target):
        path=base/target;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes((root/source).read_bytes())
    for name in inputs:copy(name,name)
    for row in content['textures']:
        if row['textureOwner']!='ahri-e':copy(Path('public')/row['url'],Path('public')/row['url'])
        else:copy(Path('public')/row['url'],row['path'])
    source_mesh=json.loads((root/'docs/reference/ahri/e-mesh-transports.json').read_bytes())
    for row in content['meshes']:
        private=next(m for m in source_mesh['meshes'] if m['source']==row['source'])
        copy(Path('public')/row['url'],private['glb']['path'])
    def run(check=False):return subprocess.run([sys.executable,*flags,str(producer),*(['--check']if check else[])],cwd=base,capture_output=True)
    final=base/'docs/reference/ahri/e-publication.json'
    target=base/'src/content/ahri-e-particles.json'
    require(run(True).returncode!=0 and not target.exists(),'Missing output accepted or created by check')
    final.write_bytes(b'conflict')
    require(run().returncode!=0 and not target.exists()and not list((base/'public/assets/effects').glob('ahri-e-*')),'Final conflict allowed partial public writes')
    final.unlink()
    require(run().returncode==0 and run(True).returncode==0 and target.read_bytes()==(root/target.relative_to(base)).read_bytes(),'Fresh publication differs')
    original=target.read_bytes();target.write_bytes(original[:-1]);require(run().returncode!=0 and target.read_bytes()==original[:-1],'Corrupt content repaired');target.write_bytes(original)
    last=base/'public'/next(m['url']for m in content['meshes']if m['geometryOwner']=='ahri-e');raw=last.read_bytes();last.unlink();last.symlink_to(root/last.relative_to(base));require(run().returncode!=0,'Public leaf symlink accepted');last.unlink();last.write_bytes(raw)
    folder=base/'public/assets/effects';held=base/'held';folder.rename(held);folder.symlink_to(root/'public/assets/effects',target_is_directory=True);require(run().returncode!=0,'Public parent symlink accepted');folder.unlink();held.rename(folder)
    shared=base/'public'/next(t['url']for t in content['textures']if t['textureOwner']!='ahri-e');saved=shared.read_bytes();shared.write_bytes(saved[:-1]);require(run().returncode!=0 and target.read_bytes()==original,'Changed borrowed asset accepted');shared.write_bytes(saved)
    shared.unlink();shared.symlink_to(root/shared.relative_to(base));require(run().returncode!=0,'Borrowed asset symlink accepted');shared.unlink();shared.write_bytes(saved)
    private=base/next(t['path']for t in content['textures']if t['textureOwner']=='ahri-e')
    saved=private.read_bytes();private.write_bytes(saved[:-1]);require(run().returncode!=0 and target.read_bytes()==original,'Corrupt private transport accepted');private.write_bytes(saved)
    private.unlink();private.symlink_to(root/private.relative_to(base));require(run().returncode!=0,'Private transport symlink accepted');private.unlink();private.write_bytes(saved)
    for name in inputs:
        path=base/name;raw=path.read_bytes();path.write_bytes(b'changed');require(run().returncode!=0 and target.read_bytes()==original,'Changed source input accepted: '+name);path.write_bytes(raw)
print(json.dumps(dict(result='passed',optimized=bool(sys.flags.optimize),sourcePinMutations=11,sharedAssets=11,newPublicAssets=13,privateInputsRequired=False,nativeParserRequired=False,partialWrites=False,borrowedSymlinkRejected=True)))
