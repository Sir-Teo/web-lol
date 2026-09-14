"""Pin Garen character/spell records from the frozen Riot archive."""
import io,json,subprocess
from pathlib import Path
from cdtb import binfile
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive,sha
path=Path('docs/reference/garen-character.json')
pin=json.loads(path.read_text()) if path.exists() else None
url='https://raw.communitydragon.org/16.18/game/data/characters/garen/garen.bin.json'
if pin: records=pin['records']
else:
    raw=subprocess.check_output(['curl','-fLsS','--max-time','60',url])
    records=json.loads(raw)
source='data/characters/garen/garen.bin'
paths=[source,'data/final/champions/garen.wad.subchunktoc']
archive=RiotArchive({f'{xxh64_intdigest(p):016x}':p for p in paths},pin['extraction'] if pin else None,archive_name='DATA/FINAL/Champions/Garen.wad.client')
output=Path('.cache/garen-character-source')
archive.extract([source],output)
fields, types, values, entries, asset_paths = {}, {}, {}, {}, {}
def collect(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if not key.startswith('{'):
                fields[binfile.compute_binhash(key)] = key
                values[binfile.compute_binhash(key)] = key
            if key == '__type' and not child.startswith('{'):
                types[binfile.compute_binhash(child)] = child
            collect(child)
    elif isinstance(value, list):
        for child in value: collect(child)
    elif isinstance(value, str) and value.isascii() and not value.startswith('{'):
        values[binfile.compute_binhash(value)] = value
        # Shader and ClientStates links are BIN entry references too. Only an
        # exact hash match resolves them; their spelling does not alter bytes.
        entries[binfile.compute_binhash(value)] = value
        asset_paths[xxh64_intdigest(value.lower())] = value

collect(records)
for key in records: entries[binfile.compute_binhash(key)]=key
binfile.hashfile_binfields.hashes=fields
binfile.hashfile_bintypes.hashes=types
binfile.hashfile_binhashes.hashes=values
binfile.hashfile_binentries.hashes=entries
binfile.hashfile_binpaths.hashes=asset_paths
decoded=binfile.BinFile(io.BytesIO((output/source).read_bytes())).to_serializable()
(output/'decoded.json').write_text(json.dumps(decoded,indent=2))
def align_names(actual, expected):
    # Named strings elsewhere in the dictionary can resolve a hash which the
    # naming export left unresolved at this path. Accept only exact FNV matches.
    if isinstance(actual,str) and isinstance(expected,str) and expected.startswith('{'):
        if expected == '{%08x}' % binfile.compute_binhash(actual): return expected
    if isinstance(actual,dict) and isinstance(expected,dict):
        return {k:align_names(v,expected.get(k)) for k,v in actual.items()}
    if isinstance(actual,list) and isinstance(expected,list) and len(actual)==len(expected):
        return [align_names(a,b) for a,b in zip(actual,expected)]
    return actual
assert align_names(json.loads(json.dumps(decoded)),records)==records,'Garen character definitions differ'
if not pin: path.write_text(json.dumps(dict(url=url,sha256=sha(raw),records=records,extraction=archive.provenance()),indent=2)+'\n')
print('Verified complete Garen character and spell records against frozen archive.')
