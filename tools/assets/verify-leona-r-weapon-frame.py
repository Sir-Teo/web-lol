#!/usr/bin/env python3
"""Verify frozen R weapon-frame evidence offline. Both invocation modes are read-only.

Use the existing .tools/cdtb-venv/bin/python runtime. No network, target, analyzer,
compiler, native shader, browser or application execution is performed.
"""
from pathlib import Path
import argparse
import hashlib
import io
import json
import struct
import sys

R = Path(__file__).resolve().parents[2]
C = R / '.cache/leona-r-weapon-frame-reading-v1-20261024'

def require(ok, message):
    if not ok:
        raise ValueError(message)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def pin(path):
    data = path.read_bytes()
    return dict(path=str(path.relative_to(R)), bytes=len(data), sha256=sha(data))

def checked(row):
    data = (R / row['path']).read_bytes()
    require(len(data) == row['bytes'] and sha(data) == row['sha256'], 'Pinned input differs: ' + row['path'])
    return data

args = argparse.ArgumentParser(description=__doc__)
args.add_argument('--check', action='store_true', help='Explicit offline verification; normal invocation also verifies without writes.')
args.add_argument('--pin', type=Path, default=R / 'docs/reference/leona-r-weapon-frame.json', help='Alternative pin for controlled negative validation.')
options = args.parse_args()
reference = json.loads(options.pin.read_text())
for dependency in reference['dependencies']:
    checked(dependency)
sys.path.insert(0, str(R / '.tools/cdtb'))
from cdtb import binfile
from cdtb.wad import Wad
from cdtb.patcher import PatcherManifest
from cdtb.tools import zstd_decompress
from xxhash import xxh64_intdigest

naming = [R / 'docs/reference/leona-model.json', R / 'docs/reference/leona-r-particles.json', R / '.cache/leona-character-research-20261023/character-pin.json', R / '.cache/leona-model-research-20261023/archive-reverified/animations-decoded.json']
fields = {}
types = {}
values = {}
entries = {}
paths = {}

def collect(x):
    if isinstance(x, dict):
        for k, v in x.items():
            if k != '__type' and (not k.startswith('{')):
                fields[binfile.compute_binhash(k)] = k
            if k == '__type' and isinstance(v, str) and (not v.startswith('{')):
                types[binfile.compute_binhash(v)] = v
            collect(v)
    elif isinstance(x, list):
        for v in x:
            collect(v)
    elif isinstance(x, str) and x.isascii() and (not x.startswith('{')):
        values[binfile.compute_binhash(x)] = x
        entries[binfile.compute_binhash(x)] = x
for p in naming:
    collect(json.loads(p.read_text()))
for a, b in [('hashfile_binfields', fields), ('hashfile_bintypes', types), ('hashfile_binhashes', values), ('hashfile_binentries', entries), ('hashfile_binpaths', paths)]:
    getattr(binfile, a).hashes = b
inventory = reference['binInventory']
terms = ['Leona_R_buf', 'Characters/Leona/Skins/Skin0/Particles/Leona_Base_R_buf', 'BUFFBONE_GLB_WEAPON_1']
rows = []
decoded = {}

def walk(x, path):
    if isinstance(x, dict):
        for k, v in x.items():
            if any((t.lower() in k.lower() for t in terms)):
                yield dict(location=path + '/' + k, match='dictionary key', value=k)
            yield from walk(v, path + '/' + k)
    elif isinstance(x, list):
        for i, v in enumerate(x):
            yield from walk(v, path + '/' + str(i))
    elif isinstance(x, str) and any((t.lower() in x.lower() for t in terms)):
        yield dict(location=path, match='string or named hash value', value=x)
for h, ps in inventory.items():
    p = R / ps[0]
    b = p.read_bytes()
    require(sha(b) == h, 'Source reading invariant failed: sha(b) == h')
    obj = json.loads(json.dumps(binfile.BinFile(io.BytesIO(b)).to_serializable()))
    decoded[str(p.relative_to(R))] = obj
    raw = []
    for t in terms:
        for kind, needle, hay in [('ascii-insensitive', t.lower().encode(), b.lower()), ('littleEndianFNV32', struct.pack('<I', binfile.compute_binhash(t)), b)]:
            offsets = []
            start = 0
            while True:
                i = hay.find(needle, start)
                if i < 0:
                    break
                offsets.append(i)
                start = i + 1
            if offsets:
                raw.append(dict(term=t, kind=kind, offsets=offsets))
    rows.append(dict(input=pin(p), sameByteCopies=ps, rawMatches=raw, structuralMatches=list(walk(obj, '')), entryCount=len(obj) - 1, linked=obj.get('__linked', [])))
character = decoded['.cache/leona-canonical-source-reverify-v1-20261023/data/characters/leona/leona.bin']
rspell = character['Characters/Leona/Spells/LeonaSolarFlareAbility/LeonaSolarFlare']
animations = decoded['.cache/leona-model-research-20261023/archive-reverified/data/characters/leona/animations/skin0.bin']
clips = []

def find(x, path):
    if isinstance(x, dict):
        for k, v in x.items():
            if k == 'Spell4':
                clips.append(dict(location=path + '/' + k, definition=v))
            find(v, path + '/' + k)
    elif isinstance(x, list):
        for i, v in enumerate(x):
            find(v, path + '/' + str(i))
find(animations, '')
require(len(clips) == 1 and 'mEventDataMap' not in clips[0]['definition'], "Source reading invariant failed: len(clips) == 1 and 'mEventDataMap' not in clips[0]['definition']")
source = json.loads((R / 'docs/reference/leona-r-particles.json').read_text())['resources']['Leona_R_buf']
quads = [dict(sourceIndex=i, definition=source['definition']['complexEmitterDefinitionData'][i]) for i in [1, 2]]
for q in quads:
    e = q['definition']
    require(e['primitive']['__type'] == 'VfxPrimitiveArbitraryQuad' and e['EmitterPosition']['constantValue'] == [0.0, -90.0, 0.0], "Source reading invariant failed: e['primitive']['__type'] == 'VfxPrimitiveArbitraryQuad' and e['EmitterPosition']['constantValue'] == [0.0, -90.0, 0.0]")
links = rows[0]['linked']
coverage = []
for link in links:
    h = f'{xxh64_intdigest(link.lower()):016x}'
    matches = [r['input'] for r in rows if any((Path(p).stem == h or p.lower().endswith(link.lower()) for p in r['sameByteCopies']))]
    require(matches, 'Source reading invariant failed: matches')
    coverage.append(dict(virtualPath=link, wadPathHash=h, matchedInput=matches[0]))

require(len(rows) == 17 and len(coverage) == 16, 'Bounded coverage count differs')
actual = dict(linkedCoverage=coverage, binReading=rows,
    spell=dict(record='Characters/Leona/Spells/LeonaSolarFlareAbility/LeonaSolarFlare', mScriptName=rspell.get('mScriptName'), fields=sorted(rspell), spawnReferences=list(walk(rspell,''))),
    spell4=clips[0], quads=quads)
require(actual == reference['sourceReading'], 'Reconstructed source reading differs')
# The path dictionary is an independent naming aid. Match exact hashes against
# the retained WAD directory; do not treat dictionary membership as availability.
wad = reference['wad']
paths = {}
for line in (R / wad['dictionary']['path']).read_text().splitlines():
    key, _, path = line.partition(' ')
    if path.startswith('data/characters/leona/') and path.endswith(('.bin', '.lua', '.luabin', '.luabin64')):
        paths[int(key, 16)] = path
header_path = R / wad['header']['path']
header = header_path.read_bytes()
require(header[:4] == b'RW\x03\x04', 'Unexpected WAD version')
require(len(header) == 272 + 32 * struct.unpack_from('<I', header, 268)[0], 'WAD directory extent differs')
w = Wad(str(header_path), hashes=paths)
present = [dict(path=e.path, pathHash=f'{e.path_hash:016x}', offset=e.offset, compressedBytes=e.compressed_size, bytes=e.size, type=e.type) for e in w.files if e.path]
all_hashes = {e.path_hash for e in w.files}
absent = [dict(path=path, pathHash=f'{key:016x}') for key,path in paths.items() if key not in all_hashes]
require(present == wad['present'] and absent == wad['absent'] and len(paths) == wad['dictionaryPaths'], 'Exact-path WAD inventory differs')
require(len(present) == 118 and len(absent) == 100 and all(row['path'].endswith('.bin') for row in present), 'Known script availability boundary differs')
# Reconstruct only the WAD header from already cached, SHA-pinned RMAN chunks.
# This path has no downloader or fallback. A missing chunk is a hard failure.
archive = 'DATA/FINAL/Champions/Leona.wad.client'
f = PatcherManifest(str(R / wad['manifest']['path'])).files[archive]
position = 0
rebuilt = bytearray()
observed_chunks = {}
for chunk in f.chunks:
    if position >= len(header):
        break
    key = f'{chunk.chunk_id:016X}'
    expected = wad['officialHeaderReverification']['chunks'][key]
    prior = json.loads((R / '.cache/leona-character-research-20261023/character-pin.json').read_text())['extraction']['chunks'][key]
    require(expected == prior, 'Prior frozen character chunk provenance differs: ' + key)
    compressed = (R / '.cache/riot-reference' / (key + '.chunk')).read_bytes()
    require(len(compressed) == chunk.size == expected['bytes'] and sha(compressed) == expected['sha256'], 'WAD chunk bytes differ: ' + key)
    url = f'https://lol.dyn.riotcdn.net/channels/public/bundles/{chunk.bundle.bundle_id:016X}.bundle'
    require(url == expected['url'] and chunk.offset == expected['offset'], 'Official RMAN bundle mapping differs: ' + key)
    decompressed = zstd_decompress(compressed)
    require(len(decompressed) == chunk.target_size, 'WAD chunk decompressed size differs')
    rebuilt.extend(decompressed[:len(header) - position])
    observed_chunks[key] = expected
    position += chunk.target_size
require(bytes(rebuilt) == header and observed_chunks == wad['officialHeaderReverification']['chunks'], 'WAD header/chunk coverage differs')
print('PASS R weapon frame: 17 BIN identities, all 16 skin0 links, source quads, Spell4 and exact alias references; frozen WAD header/chunks and 118 present / 100 absent known paths. Attachment frame remains unresolved. Offline/read-only.')
