"""Pin placed epic-objective client records without selecting gameplay rules."""
import argparse
import io
import json
from pathlib import Path

from cdtb import binfile
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive, sha

ROOT = Path(__file__).resolve().parents[2]
SEEDS = ['docs/reference/jungle-character-source.json',
         'docs/reference/garen-character.json', 'src/content/jungle-map-inspection.json']
CHARACTERS = ['SRU_Baron', 'SRU_RiftHerald', 'SRU_Dragon', 'SRU_Dragon_Fire',
              'SRU_Dragon_Earth', 'SRU_Dragon_Water', 'SRU_Dragon_Air',
              'SRU_Dragon_Hextech', 'SRU_Dragon_Chemtech', 'SRU_Dragon_Elder', 'SRU_Horde']
STATUS = ('Original client CharacterRecord variants and embedded spell records for the eleven '
          'placed epic-objective character identities. Root values do not establish active mode, '
          'server scaling, spawn calendars, rewards, buffs, combat behavior or native appearance.')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def run(args):
    pin_path, output = Path(args.pin), Path(args.output_dir)
    old = json.loads(pin_path.read_text()) if pin_path.exists() else None
    require(not args.discover or old is None, 'Discovery cannot overwrite an existing pin')
    require(old is not None or args.discover, 'First extraction requires --discover')
    labels = [dict(path=p, sha256=sha(Path(p).read_bytes())) for p in SEEDS]
    if old:
        require(old['labelSeeds'] == labels, 'Frozen label source differs')
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
        for path in [f'Characters/{character}/CharacterRecords/Root', f'Characters/{character}/Skins/Skin0']:
            names[binfile.compute_binhash(path)] = path
    for table, values in [(binfile.hashfile_binfields, fields), (binfile.hashfile_bintypes, types),
                          (binfile.hashfile_binentries, names), (binfile.hashfile_binhashes, names),
                          (binfile.hashfile_binpaths, assets)]:
        table.hashes = values
    definitions = [f'data/characters/{c.lower()}/{c.lower()}.bin' for c in CHARACTERS]
    paths = json.loads(Path('docs/reference/map-wad-paths.json').read_text())
    paths.update({f'{xxh64_intdigest(p):016x}': p for p in definitions})
    if old:
        for row in old['extraction']['files']:
            cached = output / row['path']
            if cached.exists():
                raw = cached.read_bytes()
                require(len(raw) == row['bytes'] and sha(raw) == row['sha256'],
                        'Existing cache differs; preserve before recovery: ' + str(cached))
    archive = RiotArchive(paths, old['extraction'] if old else None)
    archive.extract(definitions, output)
    records = {p: json.loads(json.dumps(binfile.BinFile(
                   io.BytesIO((output / p).read_bytes())).to_serializable()))
               for p in definitions}
    placed = json.loads(Path(SEEDS[2]).read_text())['neutralObjects']
    roots = {f'characters/{c.lower()}/characterrecords/root' for c in CHARACTERS}
    placements = [row for row in placed if row.get('character', '').lower() in roots]
    result = dict(extraction=archive.provenance(), labelSeeds=labels, characters=CHARACTERS,
                  records=records, placements=placements, status=STATUS)
    if old:
        require(result == old, 'Frozen epic-objective records or provenance differ')
    else:
        pin_path.parent.mkdir(parents=True, exist_ok=True)
        with pin_path.open('x') as stream:
            stream.write(json.dumps(result, indent=2) + '\n')
    variants = sum(isinstance(row, dict) and row.get('__type') == 'CharacterRecord'
                   for rows in records.values() for row in rows.values())
    return dict(status='passed', mode='discover' if old is None else 'reproduce',
                pin=dict(path=str(pin_path), sha256=sha(pin_path.read_bytes())),
                characters=len(CHARACTERS), characterVariants=variants,
                files=len(archive.outputs), bytes=sum(row['bytes'] for row in archive.outputs),
                placements=len(placements), exactPinnedReproduction=old == result)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pin', default='docs/reference/epic-character-source.json')
    parser.add_argument('--output-dir', default='.cache/epic-characters')
    parser.add_argument('--report', required=True)
    parser.add_argument('--discover', action='store_true')
    args = parser.parse_args()
    require(Path.cwd() == ROOT, 'Run from repository root')
    report = Path(args.report)
    require(not report.exists(), 'Report already exists; choose a fresh path')
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
