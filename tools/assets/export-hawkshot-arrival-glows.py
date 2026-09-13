"""Preserve the two endpoint glow emitters and exact decoded RGB color-ramp samples."""
from pathlib import Path
from io import BytesIO
import hashlib,json
from PIL import Image
from cdtb.export import TexConverter
hash_bytes=lambda b:hashlib.sha256(b).hexdigest()
pin_path=Path('docs/reference/hawkshot-effects.json');pin=json.loads(pin_path.read_text())
record='Characters/Ashe/Skins/Skin0/Particles/Ashe_Base_E_tar_explode'
emitters=pin['records'][record]['data']['complexEmitterDefinitionData']
layers=[next(e for e in emitters if e['emitterName']==name) for name in ['flat_top','flat_top1']]
for e in layers:
    assert e['particleColorTexture']==layers[0]['particleColorTexture']
    assert e['isUniformScale']==1 and e['blendMode']==4
    assert e['Color']['dynamics']['times']==[0,1]
source=next(f for f in pin['extraction']['files'] if f['path']==layers[0]['particleColorTexture'].lower())
raw=(Path('.cache/hawkshot-sources')/source['path']).read_bytes()
assert len(raw)==source['bytes'] and hash_bytes(raw)==source['sha256']
im=Image.open(BytesIO(TexConverter.tex_to_dds(raw))).convert('RGBA')
assert len({im.crop((0,y,im.width,y+1)).tobytes() for y in range(im.height)})==1
samples=[list(im.getpixel((x,0))) for x in range(im.width)]
assert all(rgba[3]==255 for rgba in samples)
assert samples[0]==samples[-1]==[0,0,0,255]
output=Path('public/assets/effects/hawkshot-arrival-ramp.png');im.save(output)
assert Image.open(output).convert('RGBA').tobytes()==im.tobytes()
# Confirm both glows can reuse the already shipped source glow texture.
glow=json.loads(Path('docs/reference/hawkshot-glow.json').read_text())
assert all(e['texture'].lower()==glow['source']['path'] for e in layers)
assert hash_bytes(Path(glow['texture']['path']).read_bytes())==glow['texture']['sha256']
result=dict(definitionsSha256=hash_bytes(pin_path.read_bytes()),record=record,emitters=layers,
    sharedGlowTexture=glow['texture'],ramp=dict(source=source,path=str(output),dimensions=list(im.size),
    bytes=output.stat().st_size,sha256=hash_bytes(output.read_bytes()),rgbaSha256=hash_bytes(im.tobytes()),
    identicalRows=True,rgba8Samples=samples),
    unresolved=['Emission phase for rate-based short-lived emitters','Default quad orientation when primitive is absent','Native ramp sampling/color-space rules'])
Path('docs/reference/hawkshot-arrival-glows.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(dict(dimensions=list(im.size),bytes=output.stat().st_size,samples=len(samples),alphaValues=sorted({v[3] for v in samples}))))
