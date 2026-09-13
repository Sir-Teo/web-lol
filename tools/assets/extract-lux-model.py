"""Rebuild the pinned base Lux mesh, textures and complete atomic animation set."""
import io
import json
from pathlib import Path
from cdtb import binfile
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive

pin = json.loads(Path('docs/reference/lux-model.json').read_text())
paths = [item['path'] for item in pin['extraction']['files']]
archive = RiotArchive(
    {f'{xxh64_intdigest(p):016x}': p for p in paths + ['data/final/champions/lux.wad.subchunktoc']},
    pin['extraction'], archive_name='DATA/FINAL/Champions/Lux.wad.client',
)
output = Path('.cache/lux-current-sources')
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
        if value.startswith('Characters/'): entries[binfile.compute_binhash(value)] = value
        asset_paths[xxh64_intdigest(value.lower())] = value
for section in ['skin', 'animations']:
    collect(pin[section]['data'])
    for key in pin[section]['data']: entries[binfile.compute_binhash(key)] = key
binfile.hashfile_binfields.hashes = fields
binfile.hashfile_bintypes.hashes = types
binfile.hashfile_binhashes.hashes = values
binfile.hashfile_binentries.hashes = entries
binfile.hashfile_binpaths.hashes = asset_paths
for section, path in [('skin', 'data/characters/lux/skins/skin0.bin'), ('animations', 'data/characters/lux/animations/skin0.bin')]:
    decoded = binfile.BinFile(io.BytesIO((output / path).read_bytes())).to_serializable()
    assert json.loads(json.dumps(decoded)) == pin[section]['data'], f'{section} definitions differ'
skin = pin['skin']['data']['Characters/Lux/Skins/Skin0']
graph = pin['animations']['data'][skin['skinAnimationProperties']['animationGraphData']]
clips = {name: data['mAnimationResourceData']['mAnimationFilePath'].lower() for name, data in graph['mClipDataMap'].items() if data['__type'] == 'AtomicClipData'}
assert clips == pin['atomicClips']
mesh = skin['skinMeshProperties']
assert set([mesh['skeleton'].lower(), mesh['simpleSkin'].lower(), mesh['texture'].lower(), *clips.values()]) <= set(paths)
print(f'Verified {len(paths)} files, skin/animation definitions and {len(clips)} atomic clip mappings')
