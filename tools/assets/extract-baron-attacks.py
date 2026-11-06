"""Freeze the default Baron's declared missile/hit systems and original dependencies."""
import argparse
import io
import json
import re
import subprocess
from pathlib import Path

from cdtb import binfile
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive, sha

CDTB_REVISION = 'ba981db2a2c814a0d78e55f6483e0636b527850f'
SEEDS = [
    'docs/reference/epic-character-source.json',
    'docs/reference/epic-models-source.json',
    'docs/reference/garen-q-particles.json',
    'docs/reference/oracle-lens-source.json',
    'docs/reference/masteryi/w-particles.json',
]
CHARACTER_BIN = 'data/characters/sru_baron/sru_baron.bin'
SKIN_BIN = 'data/characters/sru_baron/skins/skin0.bin'


def require(ok, message):
    if not ok:
        raise ValueError(message)


def source_path(value):
    path = Path(value)
    require(not path.is_absolute() and '..' not in path.parts and
            value.startswith(('data/', 'assets/')), 'Invalid source cache path')
    return path


def label_tables(seeds):
    fields, types, names, assets = {}, {}, {}, {}

    def collect(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if not key.startswith('{'):
                    fields[binfile.compute_binhash(key)] = key
                if key == '__type' and isinstance(child, str) and not child.startswith('{'):
                    types[binfile.compute_binhash(child)] = child
                collect(child)
        elif isinstance(value, list):
            for child in value:
                collect(child)
        elif isinstance(value, str) and value.isascii() and not value.startswith('{'):
            names[binfile.compute_binhash(value)] = value
            assets[xxh64_intdigest(value.lower())] = value.lower()

    for seed in seeds:
        collect(seed)
    for table, values in [(binfile.hashfile_binfields, fields),
                          (binfile.hashfile_bintypes, types),
                          (binfile.hashfile_binentries, names),
                          (binfile.hashfile_binhashes, names),
                          (binfile.hashfile_binpaths, assets)]:
        table.hashes = values


def strings(value):
    if isinstance(value, dict):
        for child in value.values():
            yield from strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from strings(child)
    elif isinstance(value, str):
        yield value


def lookup(records, reference):
    target = int(reference[1:-1], 16) if reference.startswith('{') else binfile.compute_binhash(reference)
    matches = [(key, value) for key, value in records.items() if key != '__linked' and
               (int(key[1:-1], 16) if re.fullmatch(r'\{[0-9a-f]{8}\}', key)
                else binfile.compute_binhash(key)) == target]
    require(len(matches) == 1, 'Missing or ambiguous BIN reference: ' + reference)
    return matches[0]


def run(args):
    pin_path, output, report_path = Path(args.pin), Path(args.output_dir), Path(args.report)
    require(not report_path.exists(), 'Report already exists; use a fresh path')
    old = json.loads(pin_path.read_text()) if pin_path.exists() else None
    require(not args.discover or old is None, 'Discovery cannot overwrite an existing pin')
    require(old is not None or args.discover, 'First extraction requires --discover')
    require(old is not None or not output.exists(), 'Discovery requires a fresh cache directory')
    require(Path(binfile.__file__).resolve() == Path('.tools/cdtb/cdtb/binfile.py').resolve(),
            'Unexpected BIN reader path')
    require(subprocess.check_output(['git', '-C', '.tools/cdtb', 'rev-parse', 'HEAD'], text=True).strip()
            == CDTB_REVISION, 'Wrong CDTB checkout')
    subprocess.check_call(['git', '-C', '.tools/cdtb', 'diff', '--quiet'])
    subprocess.check_call(['git', '-C', '.tools/cdtb', 'diff', '--cached', '--quiet'])
    seeds = [json.loads(Path(path).read_text()) for path in SEEDS]
    seed_pins = [dict(path=path, sha256=sha(Path(path).read_bytes())) for path in SEEDS]
    path_table = 'docs/reference/map-wad-paths.json'
    provenance = dict(seeds=seed_pins, pathTable=dict(path=path_table, sha256=sha(Path(path_table).read_bytes())),
                      cdtbRevision=CDTB_REVISION,
                      readerSha256=sha(Path('tools/assets/riot_archive.py').read_bytes()),
                      requirementsSha256=sha(Path('tools/assets/requirements.txt').read_bytes()))
    if old:
        require(old['inputs'] == provenance, 'Frozen source/reader inputs differ')
        for row in old['extraction']['files']:
            cached = output / source_path(row['path'])
            require(not cached.is_symlink(), 'Source cache cannot redirect through a symlink')
            if cached.exists():
                raw = cached.read_bytes()
                require(len(raw) == row['bytes'] and sha(raw) == row['sha256'],
                        'Existing source cache differs; preserve before recovery: ' + row['path'])
    label_tables(seeds)
    characters = seeds[0]['records'][CHARACTER_BIN]
    root = characters['Characters/SRU_Baron/CharacterRecords/Root']
    require(root['basicAttack']['mAttackProbability'] == 0 and len(root['extraAttacks']) == 1 and
            root['extraAttacks'][0]['mAttackProbability'] == 1, 'Default attack selection changed')
    attack_name = root['extraAttacks'][0]['mAttackName']
    attacks = [(key, value) for key, value in characters.items() if isinstance(value, dict) and
               value.get('ObjectName') == attack_name]
    require(len(attacks) == 1 and attack_name == 'BaronBasicAttack', 'Default attack binding differs')
    attack_key, attack = attacks[0]
    skin = seeds[1]['records'][SKIN_BIN]
    _, resolver = lookup(skin, skin['Characters/SRU_Baron/Skins/Skin0']['mResourceResolver'])
    resource_map = resolver.get('resourceMap', resolver.get('{d2f58721}'))
    require(isinstance(resource_map, dict), 'Missing skin resource map')
    bins = sorted(path.lower() for path in skin['__linked'] if '_multi_' in path.lower())
    require(len(bins) == 2, 'Linked default skin BIN set changed')
    paths = json.loads(Path(path_table).read_text())
    if old:
        paths.update({row['wadPathHash']: row['path'] for row in old['extraction']['files']})
    paths.update({f'{xxh64_intdigest(path):016x}': path for path in bins})
    archive = RiotArchive(paths, old['extraction'] if old else None)
    archive.extract(bins, output)
    # CDTB vectors can be tuples. Normalize JSON containers before comparing
    # to the frozen JSON pin; exact encoded bytes must still match below.
    parsed = {path: json.loads(json.dumps(binfile.BinFile(
        io.BytesIO((output / source_path(path)).read_bytes())).to_serializable()))
              for path in bins}
    systems = {}
    for role, field in [('missile', 'mMissileEffectKey'), ('hit', 'mHitEffectKey')]:
        effect_key = attack['mSpell'][field]
        _, record_reference = lookup(resource_map, effect_key)
        matches = []
        for path, records in parsed.items():
            try:
                key, definition = lookup(records, record_reference)
            except ValueError:
                continue
            matches.append((path, key, definition))
        require(len(matches) == 1, 'Missing or ambiguous particle system binding')
        path, key, definition = matches[0]
        require(definition['__type'] == 'VfxSystemDefinitionData', 'Wrong bound resource type')
        require(binfile.compute_binhash(definition['particlePath']) == int(record_reference[1:-1], 16),
                'Authored particle path does not match its resource reference')
        require(not any(re.fullmatch(r'\{[0-9a-f]{16}\}', s) for s in strings(definition)),
                'Unresolved asset path hash remains in the selected system')
        systems[role] = dict(effectField=field, effectKey=effect_key, recordReference=record_reference,
                             sourceBin=path, record=key, definition=definition)
    dependencies = sorted({value.lower() for system in systems.values()
                           for value in strings(system['definition']) if value.lower().startswith('assets/')})
    require(all(path.endswith(('.tex', '.scb')) for path in dependencies), 'Unsupported dependency type')
    archive.wad.resolve_paths({xxh64_intdigest(path): path for path in dependencies})
    archive.entries.update({entry.path: entry for entry in archive.wad.files if entry.path})
    require(all(path in archive.entries for path in dependencies), 'Source dependency is absent from Map11')
    archive.extract(dependencies, output)
    result = dict(format=1, inputs=provenance,
                  binding=dict(character=CHARACTER_BIN, defaultAttackRecord=attack_key,
                               defaultAttackName=attack_name, skin=SKIN_BIN,
                               resolver=skin['Characters/SRU_Baron/Skins/Skin0']['mResourceResolver']),
                  systems=systems, dependencies=dependencies, extraction=archive.provenance(),
                  scope='Original default-attack missile/hit declarations and direct texture/mesh closure. Unknown field/type hashes, authored ordering and omissions remain intact. No decoding, runtime rendering or native dispatch certification.')
    encoded = json.dumps(result, indent=2, sort_keys=True) + '\n'
    if old:
        require(result == old and encoded.encode() == pin_path.read_bytes(), 'Frozen Baron attack pin differs')
    else:
        pin_path.parent.mkdir(parents=True, exist_ok=True)
        with pin_path.open('x') as stream:
            stream.write(encoded)
    report = dict(status='passed', pin=str(pin_path), pinSha256=sha(encoded.encode()),
                  files=len(result['extraction']['files']), bytes=sum(row['bytes'] for row in result['extraction']['files']),
                  emitters={role: len(system['definition']['complexEmitterDefinitionData']) for role, system in systems.items()})
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with report_path.open('x') as stream:
        stream.write(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pin', default='docs/reference/baron-attack-source.json')
    parser.add_argument('--output-dir', default='.cache/baron-attack-sources')
    parser.add_argument('--report', required=True)
    parser.add_argument('--discover', action='store_true')
    run(parser.parse_args())


if __name__ == '__main__':
    main()
