"""Extract and verify Lux's pinned normal and critical attack impact definitions and source assets."""
import hashlib, io, json
from pathlib import Path
from PIL import Image
from cdtb import binfile
from cdtb.export import TexConverter
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive

pin_path = Path('docs/reference/lux-attack-impact.json')
pin = json.loads(pin_path.read_text())
character = json.loads(Path('docs/reference/lux-character.json').read_text())
paths = pin['paths']
archive = RiotArchive({f'{xxh64_intdigest(p):016x}':p for p in paths+['data/final/champions/lux.wad.subchunktoc']},
    pin.get('extraction'), archive_name='DATA/FINAL/Champions/Lux.wad.client')
root = Path('.cache/lux-attack-impact-sources')
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
decoded = json.loads(json.dumps(binfile.BinFile(io.BytesIO(raw)).to_serializable()))
for key, record in pin['records'].items():
    assert decoded[key] == record, 'Impact definition differs from pinned binary'
skin = json.loads(Path('docs/reference/lux-model.json').read_text())['skin']['data']
resources = skin['Characters/Lux/Skins/Skin0/Resources']['resourceMap']
critical = json.loads(Path('docs/reference/critical-attacks.json').read_text())['luxCritSpell']['mSpell']
normal = character['records']['Characters/Lux/Spells/LuxBasicAttack']['mSpell']
for spell, suffix in [(normal, 'Lux_Base_BA_tar'), (critical, 'Lux_Base_BA_tar_crit')]:
    expected = 'Characters/Lux/Skins/Skin0/Particles/' + suffix
    assert resources[spell['mHitEffectKey']] == expected and expected in pin['records']
textures = []
for path in paths:
    if not path.endswith('.tex'): continue
    data = (root/path).read_bytes()
    image = Image.open(io.BytesIO(TexConverter.tex_to_dds(data))).convert('RGBA')
    output = Path('public/assets/effects') / ('lux-hit-' + Path(path).stem + '.png')
    image.save(output)
    assert Image.open(output).convert('RGBA').tobytes() == image.tobytes()
    textures.append({'path':path,'output':str(output),'width':image.width,'height':image.height,
        'rgbaSha256':hashlib.sha256(image.tobytes()).hexdigest(),'pngSha256':hashlib.sha256(output.read_bytes()).hexdigest(),'bytes':output.stat().st_size})
if 'textures' in pin: assert textures == pin['textures'], 'Texture conversion changed'
pin['textures'] = textures
pin['extraction'] = archive.provenance()
pin_path.write_text(json.dumps(pin,indent=2)+'\n')
print(json.dumps({'verifiedEmitters':sum(len(r['complexEmitterDefinitionData']) for r in pin['records'].values()),'textures':textures}))
