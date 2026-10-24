"""Pin unmodified source mask pixels at shared normalized UVs for GPU checks."""
from pathlib import Path
from PIL import Image
import hashlib,json,sys
paths=['public/assets/effects/leona_base_w_avatarmask.png','public/assets/effects/leona_base_w_avatarmask_erosion.png']
source,erosion=[Image.open(p).convert('RGBA') for p in paths]
bucket=lambda a:0 if a==0 else 2 if a==255 else 1
found={}
for y in range(erosion.height):
    for x in range(erosion.width):
        uv=[(x+0.5)/erosion.width,(y+0.5)/erosion.height]
        a=list(source.getpixel((int(uv[0]*source.width),int(uv[1]*source.height))))
        b=list(erosion.getpixel((x,y)))
        key=(bucket(a[3]),bucket(b[3]))
        if key not in found:found[key]=dict(uv=uv,source=a,erosion=b)
assert len(found)>=5
result=dict(files=[dict(path=p,sha256=hashlib.sha256(Path(p).read_bytes()).hexdigest()) for p in paths],
    samples=[found[k] for k in sorted(found)],sampling='Nearest-filtered diagnostic texels, flipY=false. Native filtering remains unverified.')
raw=(json.dumps(result,indent=2)+'\n').encode();out=Path('docs/reference/leona-w-skin-samples.json')
if '--check' in sys.argv:assert out.read_bytes()==raw
else:out.write_bytes(raw)
print(json.dumps(dict(result='passed',samples=len(found))))
