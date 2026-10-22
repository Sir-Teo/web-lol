"""Freeze camp anchors, neutral character objects and recommendation metadata.

Read the original 16.18 Map11 BINs, not the availability of a public JSON mirror.
After the first extraction, the pin supplies all labels and requires exact equality.
This is source preparation; object presence does not establish live camp spawning.
"""
import io
import json
from pathlib import Path

from cdtb import binfile
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive, sha

PIN = Path('docs/reference/jungle-map-source.json')
ROOT = Path('.cache/jungle-sources')
MAP = 'data/maps/shipping/map11/map11.bin'
MATERIALS = 'data/maps/mapgeometry/map11/base_srx.materials.bin'
MODE = 'Maps/Shipping/Map11/Modes/CLASSIC'
old = json.loads(PIN.read_text()) if PIN.exists() else None
# The container's structural field is outside the selected child records.
fields, types, names = {binfile.compute_binhash('items'): 'items'}, {}, {binfile.compute_binhash(MODE): MODE}


def collect(value, resolve_names=True):
    if isinstance(value, dict):
        for key, child in value.items():
            if not key.startswith('{'):
                fields[binfile.compute_binhash(key)] = key
            if key == '__type' and not child.startswith('{'):
                types[binfile.compute_binhash(child)] = child
            collect(child, resolve_names)
    elif isinstance(value, list):
        for child in value:
            collect(child, resolve_names)
    elif resolve_names and isinstance(value, str) and value.isascii() and not value.startswith('{'):
        names[binfile.compute_binhash(value)] = value


def collect_names(value):
    if isinstance(value, dict):
        for child in value.values():
            collect_names(child)
    elif isinstance(value, list):
        for child in value:
            collect_names(child)
    elif isinstance(value, str) and value.isascii() and not value.startswith('{'):
        names[binfile.compute_binhash(value)] = value


if old:
    label_evidence = old['labelEvidence']
    collect(old['records'], resolve_names=False)
    # Reuse the original naming evidence. A newly read literal such as ElderDragon
    # must not silently relabel a previously unresolved entity-name hash.
    for seed in label_evidence['seeds']:
        raw = Path(seed['path']).read_bytes()
        assert sha(raw) == seed['sha256'], f'Jungle naming seed changed: {seed["path"]}'
        collect_names(json.loads(raw))
else:
    dictionaries, seeds = [], []
    for label, table in [('binfields', fields), ('bintypes', types)]:
        path = Path(f'.cache/garen-particle-bins/hashes.{label}.txt')
        raw = path.read_bytes()
        for line in raw.decode().splitlines():
            hashed, name = line.split(' ', 1)
            assert binfile.compute_binhash(name) == int(hashed, 16)
            table[int(hashed, 16)] = name
        dictionaries.append(dict(path=str(path), sha256=sha(raw),
            url=f'https://raw.communitydragon.org/data/hashes/lol/{path.name}'))
    for name in ['assist-window', 'rift-layout-source', 'minion-xp-sharing', 'champion-kill-xp']:
        path = Path(f'docs/reference/{name}.json')
        raw = path.read_bytes()
        collect(json.loads(raw))
        seeds.append(dict(path=str(path), sha256=sha(raw)))
    label_evidence = dict(dictionaries=dictionaries, seeds=seeds,
        status='FNV-verified labels and existing pins identify fields; they do not prove runtime semantics.')
for table, mapping in [(binfile.hashfile_binfields, fields), (binfile.hashfile_bintypes, types),
                       (binfile.hashfile_binentries, names), (binfile.hashfile_binhashes, names),
                       (binfile.hashfile_binpaths, {})]:
    table.hashes = mapping

paths = json.loads(Path('docs/reference/map-wad-paths.json').read_text())
for path in [MAP, MATERIALS]:
    paths[f'{xxh64_intdigest(path):016x}'] = path
archive = RiotArchive(paths, old['extraction'] if old else None)
archive.extract([MAP, MATERIALS], ROOT, flat=True)
parsed = {}
for path in [MAP, MATERIALS]:
    raw = (ROOT / f'{xxh64_intdigest(path):016x}.bin').read_bytes()
    parsed[path] = json.loads(json.dumps(binfile.BinFile(io.BytesIO(raw)).to_serializable()))
# Independently retained by the terrain pipeline; never substitute a different map.
material_pin = json.loads(Path('docs/reference/map-extraction.json').read_text())
expected = next(v for v in material_pin['files'] if v['path'] == MATERIALS)
assert sha((ROOT / f'{xxh64_intdigest(MATERIALS):016x}.bin').read_bytes()) == expected['sha256']

definition, material = parsed[MAP], parsed[MATERIALS]
mode = definition[MODE]
location_key = mode['JungleRecommendationMapInformation']
route_key = mode['DefaultJunglePathRecommendation']
identifiers = {k: v for k, v in definition.items()
               if isinstance(v, dict) and v.get('__type') == 'NeutralCampIdentifier'}
camps, characters = [], []
for container, value in material.items():
    if not isinstance(value, dict):
        continue
    for key, item in value.get('items', {}).items():
        if not isinstance(item, dict):
            continue
        record = dict(container=container, key=key, record=item)
        if 'NeutralCamp' in item:
            assert item['NeutralCamp']['CampIdentifier'] in identifiers
            camps.append(record)
        if item.get('Team', {}).get('Team') == 300 and 'Character' in item:
            characters.append(record)
assert len(camps) == 18 and len(characters) == 53 and len(identifiers) == 20
assert len({v['record']['NeutralCamp']['CampIdentifier'] for v in camps}) == 18
records = dict(modeKey=MODE, mode=mode, locationKey=location_key,
    locations=definition[location_key], routeKey=route_key, routes=definition[route_key],
    identifiers=identifiers, campEntities=camps, neutralCharacterEntities=characters)
result = dict(extraction=archive.provenance(), labelEvidence=label_evidence, records=records,
    status='Source anchors, objects and recommendation metadata only. Spawn roster, activation, timing, scaling and leash/reset behavior require separate evidence.')
if old:
    assert result == old, 'Pinned jungle source records or provenance changed'
else:
    PIN.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(dict(campAnchors=len(camps), neutralCharacterObjects=len(characters),
    identifiers=len(identifiers), sourceFiles=len(archive.outputs), repeatMatches=old == result)))
