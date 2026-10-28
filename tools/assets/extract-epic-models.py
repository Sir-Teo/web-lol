"""Freeze three epic-objective base skins, complete atomic graphs and dependencies."""
import argparse
import io
import json
from pathlib import Path

from cdtb import binfile
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive, sha

CHARACTERS = ['SRU_Baron', 'SRU_RiftHerald', 'SRU_Horde']
SEEDS = ['docs/reference/jungle-character-source.json', 'docs/reference/epic-character-source.json']


def require(ok, message):
    if not ok:
        raise ValueError(message)


def run(args):
    pin_path, output = Path(args.pin), Path(args.output_dir)
    old = json.loads(pin_path.read_text()) if pin_path.exists() else None
    require(not args.discover or old is None, 'Discovery cannot overwrite an existing pin')
    require(old is not None or args.discover, 'First extraction requires --discover')
    seeds = [dict(path=p, sha256=sha(Path(p).read_bytes())) for p in SEEDS]
    if old:
        require(old['labelEvidence']['seeds'] == seeds, 'Frozen label seed differs')
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

    for path in SEEDS:
        collect(json.loads(Path(path).read_text()))
    for character in CHARACTERS:
        for suffix in ['CharacterRecords/Root', 'Skins/Skin0', 'Animations/Skin0']:
            path = f'Characters/{character}/{suffix}'
            names[binfile.compute_binhash(path)] = path
    if old:
        for key, path in old['labelEvidence']['paths'].items():
            require(xxh64_intdigest(path) == int(key, 16), 'Invalid retained path label')
            assets[int(key, 16)] = path
    for table, values in [(binfile.hashfile_binfields, fields), (binfile.hashfile_bintypes, types),
                          (binfile.hashfile_binentries, names), (binfile.hashfile_binhashes, names),
                          (binfile.hashfile_binpaths, assets)]:
        table.hashes = values
    definitions = [f'data/characters/{c.lower()}/{folder}/skin0.bin'
                   for c in CHARACTERS for folder in ['skins', 'animations']]
    paths = json.loads(Path('docs/reference/map-wad-paths.json').read_text())
    paths.update({f'{xxh64_intdigest(p):016x}': p for p in definitions})
    if old:
        paths.update({row['wadPathHash']: row['path'] for row in old['extraction']['files']})
        for row in old['extraction']['files']:
            cached = output / row['path']
            if cached.exists():
                raw = cached.read_bytes()
                require(len(raw) == row['bytes'] and sha(raw) == row['sha256'],
                        'Existing cache differs; preserve before recovery: ' + str(cached))
    archive = RiotArchive(paths, old['extraction'] if old else None)
    archive.extract(definitions, output)

    def decode():
        return {p: json.loads(json.dumps(binfile.BinFile(
            io.BytesIO((output / p).read_bytes())).to_serializable())) for p in definitions}

    records = decode()
    if old:
        labels = old['labelEvidence']
    else:
        require(args.discovery_dictionary, 'Discovery requires --discovery-dictionary')
        needed = set()
        for character in CHARACTERS:
            skin = records[f'data/characters/{character.lower()}/skins/skin0.bin'][f'Characters/{character}/Skins/Skin0']
            texture = skin['skinMeshProperties']['texture']
            if texture.startswith('{'):
                needed.add(texture[1:-1])
            graph_key = skin['skinAnimationProperties']['animationGraphData']
            graph = records[f'data/characters/{character.lower()}/animations/skin0.bin'][graph_key]
            for row in graph['mClipDataMap'].values():
                if row['__type'] == 'AtomicClipData':
                    path = row['mAnimationResourceData']['mAnimationFilePath']
                    if path.startswith('{'):
                        needed.add(path[1:-1])
        dictionary = Path(args.discovery_dictionary)
        resolved = {}
        with dictionary.open() as stream:
            for line in stream:
                hashed, name = line.rstrip('\n').split(' ', 1)
                if hashed in needed:
                    require(xxh64_intdigest(name.lower()) == int(hashed, 16), 'Dictionary path hash differs')
                    require(hashed not in resolved or resolved[hashed] == name.lower(), 'Conflicting path labels')
                    resolved[hashed] = name.lower()
        require(set(resolved) == needed, 'Missing diffuse or atomic animation path label')
        assets.update({int(key, 16): path for key, path in resolved.items()})
        labels = dict(seeds=seeds, dictionary=dict(path=str(dictionary), sha256=sha(dictionary.read_bytes()),
                      url='https://raw.communitydragon.org/data/hashes/lol/hashes.game.txt'),
                      paths=resolved, status='Finite xxh64-verified labels; reproduction requires no mutable dictionary.')
        records = decode()
    dependencies, models = set(), {}

    def dependency(value):
        if isinstance(value, dict):
            for child in value.values():
                dependency(child)
        elif isinstance(value, list):
            for child in value:
                dependency(child)
        elif isinstance(value, str) and value.lower().startswith('assets/') and value.lower().endswith(('.skn', '.skl', '.tex', '.dds')):
            dependencies.add(value.lower())

    for character in CHARACTERS:
        slug, skin_key = character.lower(), f'Characters/{character}/Skins/Skin0'
        skin = records[f'data/characters/{slug}/skins/skin0.bin'][skin_key]
        require(not skin['skinMeshProperties']['texture'].startswith('{'), 'Unresolved diffuse')
        graph_key = skin['skinAnimationProperties']['animationGraphData']
        graph = records[f'data/characters/{slug}/animations/skin0.bin'][graph_key]
        clips = {key: row['mAnimationResourceData']['mAnimationFilePath'].lower()
                 for key, row in graph['mClipDataMap'].items() if row['__type'] == 'AtomicClipData'}
        require(bool(clips), 'No atomic graph entries')
        dependency(skin['skinMeshProperties'])
        dependencies.update(clips.values())
        models[character] = dict(skinKey=skin_key, graphKey=graph_key, atomicClips=clips)
    dependencies = sorted(dependencies)
    archive.wad.resolve_paths({xxh64_intdigest(p): p for p in dependencies})
    archive.entries.update({entry.path: entry for entry in archive.wad.files if entry.path})
    archive.extract(dependencies, output)
    result = dict(extraction=archive.provenance(), labelEvidence=labels, models=models, records=records,
                  status='Original base skin and all atomic graph entries. Native animation dispatch, materials, effects, audio and gameplay remain unverified.')
    if old:
        require(result == old, 'Frozen model source or provenance differs')
    else:
        pin_path.parent.mkdir(parents=True, exist_ok=True)
        with pin_path.open('x') as stream:
            stream.write(json.dumps(result, indent=2) + '\n')
    return dict(status='passed', exactPinnedReproduction=result == old,
                models={key: len(row['atomicClips']) for key, row in models.items()},
                sourceFiles=len(archive.outputs), sourceBytes=sum(row['bytes'] for row in archive.outputs),
                pin=dict(path=str(pin_path), sha256=sha(pin_path.read_bytes())))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pin', default='docs/reference/epic-models-source.json')
    parser.add_argument('--output-dir', default='.cache/epic-models')
    parser.add_argument('--report', required=True)
    parser.add_argument('--discover', action='store_true')
    parser.add_argument('--discovery-dictionary')
    args = parser.parse_args()
    require(Path.cwd() == Path(__file__).resolve().parents[2], 'Run from repository root')
    report = Path(args.report)
    require(not report.exists(), 'Report already exists')
    report.parent.mkdir(parents=True, exist_ok=True)
    try:
        result = run(args)
    except Exception as error:
        with report.open('x') as stream:
            stream.write(json.dumps(dict(status='failed', error=str(error)), indent=2) + '\n')
        raise
    with report.open('x') as stream:
        stream.write(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))


if __name__ == '__main__':
    main()
