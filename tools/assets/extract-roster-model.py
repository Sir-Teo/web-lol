"""Pin and verify base Garen/Ahri source models before runtime integration.

CommunityDragon supplies names; the frozen Riot archive supplies verified bytes.
Subsequent runs use the committed pin and reject changed definitions or assets.
"""
import argparse
import io
import json
import subprocess
from pathlib import Path
from cdtb import binfile
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive, sha

parser = argparse.ArgumentParser()
parser.add_argument('champion', choices=['Garen', 'Ahri'])
name = parser.parse_args().champion
slug = name.lower()
pin_path = Path(f'docs/reference/{slug}-model.json')
existing = json.loads(pin_path.read_text()) if pin_path.exists() else None
pin = existing or {}
for section, folder in [('skin', 'skins'), ('animations', 'animations')]:
    if existing: continue
    url = f'https://raw.communitydragon.org/16.18/game/data/characters/{slug}/{folder}/skin0.bin.json'
    data = subprocess.check_output(['curl', '-fLsS', '--max-time', '60', url])
    pin[section] = dict(url=url, sha256=sha(data), data=json.loads(data))
skin = pin['skin']['data'][f'Characters/{name}/Skins/Skin0']
graph = pin['animations']['data'][skin['skinAnimationProperties']['animationGraphData']]
clips = {key: value['mAnimationResourceData']['mAnimationFilePath'].lower()
         for key, value in graph['mClipDataMap'].items() if value['__type'] == 'AtomicClipData'}
if existing: assert clips == pin['atomicClips']
pin['atomicClips'] = clips
paths = {f'data/characters/{slug}/{folder}/skin0.bin' for folder in ['skins', 'animations']}
paths.update(clips.values())
# Preserve base material resources as well as the main diffuse texture. Ahri's
# tails and Garen's reflection/gloss data must not be silently discarded.
def assets(value):
    if isinstance(value, dict):
        for child in value.values(): assets(child)
    elif isinstance(value, list):
        for child in value: assets(child)
    elif isinstance(value, str) and value.lower().startswith('assets/') and value.lower().endswith(('.skn', '.skl', '.tex', '.dds')):
        paths.add(value.lower())
assets(skin['skinMeshProperties'])
for value in pin['skin']['data'].values():
    if isinstance(value, dict) and 'material' in value.get('__type', '').lower(): assets(value)
paths = sorted(paths)
archive = RiotArchive(
    {f'{xxh64_intdigest(p):016x}': p for p in paths + [f'data/final/champions/{slug}.wad.subchunktoc']},
    existing['extraction'] if existing else None,
    archive_name=f'DATA/FINAL/Champions/{name}.wad.client',
)
output = Path(f'.cache/{slug}-current-sources')
archive.extract(paths, output)
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
for section in ['skin', 'animations']:
    collect(pin[section]['data'])
    for key in pin[section]['data']: entries[binfile.compute_binhash(key)] = key
binfile.hashfile_binfields.hashes = fields
binfile.hashfile_bintypes.hashes = types
binfile.hashfile_binhashes.hashes = values
binfile.hashfile_binentries.hashes = entries
binfile.hashfile_binpaths.hashes = asset_paths
for section, folder in [('skin', 'skins'), ('animations', 'animations')]:
    decoded = binfile.BinFile(io.BytesIO((output / f'data/characters/{slug}/{folder}/skin0.bin').read_bytes())).to_serializable()
    (output / f'{section}-decoded.json').write_text(json.dumps(decoded, indent=2) + '\n')
    assert json.loads(json.dumps(decoded)) == pin[section]['data'], f'{name} {section} definitions differ'
pin['extraction'] = archive.provenance()
if not existing:
    pin_path.write_text(json.dumps(pin, indent=2) + '\n')
print(f'{name}: verified {len(paths)} files and {len(clips)} atomic clips; source only, not a playable champion.')
