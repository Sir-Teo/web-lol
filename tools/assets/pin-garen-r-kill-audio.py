"""Verify the R kill-particle sound link against the already pinned frozen BIN."""
from pathlib import Path
import hashlib
import io
import json
from cdtb import binfile
from xxhash import xxh64_intdigest

sha = lambda b: hashlib.sha256(b).hexdigest()
path = Path('docs/reference/garen-r-kill-audio-link.json')
pin = json.loads(path.read_text()) if path.exists() else None
model_path = Path('docs/reference/garen-model.json')
model = json.loads(model_path.read_text())
skin = model['skin']['data']
key = 'Garen_R_Champ_Kill'
record = skin['Characters/Garen/Skins/Skin0/Resources']['resourceMap'][key]
seed = pin or json.loads(Path('.cache/garen-particle-bins/discovered.json').read_text())['resources'][key]
assert seed['record'] == record
source_path = Path('docs/reference/garen-r-particles.json')
source = json.loads(source_path.read_text())
entry = next(f for f in source['extraction']['files'] if f['path'] == seed['sourceBin'])
raw = (Path('.cache/garen-r-particle-sources') / (entry['wadPathHash']+'.bin')).read_bytes()
assert len(raw) == entry['bytes'] and sha(raw) == entry['sha256']
fields, types, names, assets = {}, {}, {}, {}
def collect(value):
    if isinstance(value, dict):
        for k,v in value.items():
            if not k.startswith('{'): fields[binfile.compute_binhash(k)] = k
            if k == '__type' and not v.startswith('{'): types[binfile.compute_binhash(v)] = v
            collect(v)
    elif isinstance(value, list):
        for v in value: collect(v)
    elif isinstance(value, str) and value.isascii() and not value.startswith('{'):
        names[binfile.compute_binhash(value)] = value
        assets[xxh64_intdigest(value.lower())] = value
collect(seed)
for table,mapping in [(binfile.hashfile_binfields,fields),(binfile.hashfile_bintypes,types),(binfile.hashfile_binhashes,names),(binfile.hashfile_binentries,names),(binfile.hashfile_binpaths,assets)]: table.hashes = mapping
parsed = json.loads(json.dumps(binfile.BinFile(io.BytesIO(raw)).to_serializable()))
assert parsed[record] == seed['definition']
assert parsed[record]['soundOnCreateDefault'] == 'Play_sfx_Garen_GarenR_buffactivate'
result = dict(record=record,sourceBin=seed['sourceBin'],definition=parsed[record],sourceFile=entry,
    modelPinSha256=sha(model_path.read_bytes()),particlePinSha256=sha(source_path.read_bytes()),
    status='Source soundOnCreateDefault for the Champ_Kill particle. Modern spell-script dispatch and attachment remain unverified.')
if pin: assert result == pin
else: path.write_text(json.dumps(result,indent=2)+'\n')
print('Verified Champ_Kill soundOnCreateDefault resolves to the R buffactivate event.')
