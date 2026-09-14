"""Extract and verify Lux's pinned basic-attack particle definition and source assets."""
import hashlib, io, json
from pathlib import Path
from PIL import Image
from cdtb import binfile
from cdtb.export import TexConverter
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive

pin_path = Path('docs/reference/lux-basic-attack.json')
pin = json.loads(pin_path.read_text())
character = json.loads(Path('docs/reference/lux-character.json').read_text())
assert character['records']['Characters/Lux/Spells/LuxBasicAttack']['mSpell']['mMissileEffectKey'] == 'Lux_BA_mis'
paths = pin['paths']
archive = RiotArchive({f'{xxh64_intdigest(p):016x}':p for p in paths+['data/final/champions/lux.wad.subchunktoc']},
    pin.get('extraction'), archive_name='DATA/FINAL/Champions/Lux.wad.client')
root = Path('.cache/lux-basic-attack-sources')
archive.extract(paths, root)
fields, types, values, entries, assets = {}, {}, {}, {}, {}
def collect(v):
    if isinstance(v,dict):
        for k,c in v.items():
            if not k.startswith('{'): fields[binfile.compute_binhash(k)] = k
            if k == '__type' and not c.startswith('{'): types[binfile.compute_binhash(c)] = c
            collect(c)
    elif isinstance(v,list):
        for c in v: collect(c)
    elif isinstance(v,str) and v.isascii() and not v.startswith('{'):
        values[binfile.compute_binhash(v)] = v
        entries[binfile.compute_binhash(v)] = v
        assets[xxh64_intdigest(v.lower())] = v
collect(pin)
for obj,mapping in [(binfile.hashfile_binfields,fields),(binfile.hashfile_bintypes,types),(binfile.hashfile_binhashes,values),(binfile.hashfile_binentries,entries),(binfile.hashfile_binpaths,assets)]:
    obj.hashes = mapping
raw = (root/pin['sourceBin']).read_bytes()
assert hashlib.sha256(raw).hexdigest() == pin['sourceBinSha256']
record = json.loads(json.dumps(binfile.BinFile(io.BytesIO(raw)).to_serializable()))[pin['record']]
assert record == pin['data'], 'Particle definition differs from its pinned binary'
skin = json.loads(Path('docs/reference/lux-model.json').read_text())['skin']['data']
assert skin['Characters/Lux/Skins/Skin0/Resources']['resourceMap']['Lux_BA_mis'] == pin['record']
textures = []
for path in paths:
    if not path.endswith('.tex'): continue
    data = (root/path).read_bytes()
    image = Image.open(io.BytesIO(TexConverter.tex_to_dds(data))).convert('RGBA')
    output = Path('public/assets/effects') / ('lux-ba-' + Path(path).stem + '.png')
    image.save(output)
    assert Image.open(output).convert('RGBA').tobytes() == image.tobytes()
    textures.append({'path':path,'output':str(output),'width':image.width,'height':image.height,
        'rgbaSha256':hashlib.sha256(image.tobytes()).hexdigest(),'pngSha256':hashlib.sha256(output.read_bytes()).hexdigest(),'bytes':output.stat().st_size})
if 'textures' in pin: assert textures == pin['textures'], 'Texture conversion changed'
pin['textures'] = textures
pin['extraction'] = archive.provenance()
pin_path.write_text(json.dumps(pin,indent=2)+'\n')
print(json.dumps({'verifiedEmitters':len(record['complexEmitterDefinitionData']),'textures':textures}))
