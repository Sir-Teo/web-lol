"""Read-only offline source BIN and TEX-to-PNG verification, not native rendering."""
from pathlib import Path
from io import BytesIO
import hashlib
import json
from PIL import Image
from cdtb import binfile
from cdtb.export import TexConverter
from xxhash import xxh64_intdigest

sha = lambda b: hashlib.sha256(b).hexdigest()
pin_path = Path('docs/reference/leona-sunlight-particles.json')
pin = json.loads(pin_path.read_text())
decoded = json.loads(Path('docs/reference/leona-sunlight-particles-decoded.json').read_text())
model = json.loads(Path('docs/reference/leona-model.json').read_text())
assert pin['extraction']['manifest'] == model['extraction']['manifest']
assert pin['extraction']['archive'] == 'DATA/FINAL/Champions/Leona.wad.client'
assert decoded['sourcePinSha256'] == sha(pin_path.read_bytes())
fields, types, names, assets = {}, {}, {}, {}
def collect(v):
    if isinstance(v,dict):
        for k,c in v.items():
            if not k.startswith('{'): fields[binfile.compute_binhash(k)] = k
            if k == '__type' and not c.startswith('{'): types[binfile.compute_binhash(c)] = c
            collect(c)
    elif isinstance(v,list):
        for c in v: collect(c)
    elif isinstance(v,str) and v.isascii() and not v.startswith('{'):
        names[binfile.compute_binhash(v)] = v
        assets[xxh64_intdigest(v.lower())] = v
collect(pin['resources'])
for table, mapping in [(binfile.hashfile_binfields,fields),(binfile.hashfile_bintypes,types),
                       (binfile.hashfile_binhashes,names),(binfile.hashfile_binentries,names),
                       (binfile.hashfile_binpaths,assets)]:
    table.hashes = mapping
root = Path('.cache/leona-sunlight-particle-sources')
bins, images = {}, {}
for p in pin['extraction']['files']:
    raw = (root / (p['wadPathHash']+Path(p['path']).suffix)).read_bytes()
    assert len(raw) == p['bytes'] and sha(raw) == p['sha256']
    if p['path'].endswith('.bin'):
        bins[p['path']] = json.loads(json.dumps(binfile.BinFile(BytesIO(raw)).to_serializable()))
    else:
        assert p['path'].endswith('.tex')
        images[p['path']] = Image.open(BytesIO(TexConverter.tex_to_dds(raw))).convert('RGBA')
for key,r in pin['resources'].items():
    assert r['definition'] == bins[r['sourceBin']][r['record']], key
for t in decoded['textures']:
    raw = Path(t['path']).read_bytes()
    assert len(raw) == t['bytes'] and sha(raw) == t['sha256']
    image = Image.open(BytesIO(raw)).convert('RGBA')
    assert image.size == (t['width'],t['height']) == images[t['source']['path']].size
    assert image.tobytes() == images[t['source']['path']].tobytes()
    assert sha(image.tobytes()) == t['rgbaSha256']
assert len(bins) == 1 and len(images) == 12
print(json.dumps(dict(result='passed',systems=len(pin['resources']),emitters=sum(len(r['definition']['complexEmitterDefinitionData']) for r in pin['resources'].values()),textures=len(images),sourceBytes=sum(p['bytes'] for p in pin['extraction']['files']),nativeRenderingVerified=False)))
