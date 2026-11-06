"""Freeze/check the two sound banks declared by the pinned Baron base skin."""
import argparse
import json
import subprocess
from pathlib import Path
from riot_archive import RiotArchive, sha

SOURCE = Path('docs/reference/epic-models-source.json')
SOURCE_SHA = '193ac8c3693acb846601bca8b623eb906f9587ed2fad0fe984e3fba7c86a4b2b'
ARCHIVE = 'DATA/FINAL/Maps/Shipping/Map11.wad.client'
TOC = 'data/final/maps/shipping/map11.wad.subchunktoc'


def require(ok, message):
    if not ok:
        raise ValueError(message)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--discover', action='store_true')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--record', type=Path, default=Path('docs/reference/baron-audio-source.json'))
    parser.add_argument('--output-dir', type=Path, default=Path('.cache/baron-audio-sources-v1'))
    args = parser.parse_args()
    require(not (args.discover and args.check), 'Discovery and check are exclusive')
    require(sha(SOURCE.read_bytes()) == SOURCE_SHA, 'Pinned Baron skin definitions differ')
    require(subprocess.check_output(['git', '-C', '.tools/cdtb', 'rev-parse', 'HEAD'], text=True).strip() ==
            'ba981db2a2c814a0d78e55f6483e0636b527850f', 'CDTB revision differs')
    skin = json.loads(SOURCE.read_bytes())['records']['data/characters/sru_baron/skins/skin0.bin']['Characters/SRU_Baron/Skins/Skin0']
    units = skin['skinAudioProperties']['bankUnits']
    require(len(units) == 1 and units[0]['name'] == 'NPC_Map11_Baron_SFX_audio', 'Unexpected Baron bank unit')
    paths = [p.lower() for p in units[0]['bankPath']]
    require(paths == ['assets/sounds/wwise2016/sfx/shared/npc_map11_baron_sfx_audio.bnk',
                      'assets/sounds/wwise2016/sfx/shared/npc_map11_baron_sfx_events.bnk'], 'Baron bank paths differ')
    old = json.loads(args.record.read_bytes()) if args.record.exists() else None
    require(old is not None or args.discover, 'Initial bank discovery requires --discover')
    require(not args.discover or (old is None and not args.output_dir.exists()), 'Discovery requires fresh paths')
    helper = dict(path='tools/assets/extract-baron-audio.py', sha256=sha(Path(__file__).read_bytes()))
    if old:
        require(old['sourcePinSha256'] == SOURCE_SHA and old['bankUnit'] == units[0] and
                old['helper'] == helper and old['extraction']['archive'] == ARCHIVE,
                'Frozen Baron audio input/helper differs')
        require([r['path'] for r in old['extraction']['files']] == paths, 'Frozen bank closure differs')
        for row in old['extraction']['files']:
            file = args.output_dir / (row['wadPathHash'] + '.bnk')
            require(not file.is_symlink(), 'Bank cannot be a symlink')
            require(file.exists() or not args.check, 'Missing frozen Baron bank')
            if file.exists():
                raw = file.read_bytes()
                require(len(raw) == row['bytes'] and sha(raw) == row['sha256'], 'Frozen Baron bank differs')
    if not args.check:
        from xxhash import xxh64_intdigest
        all_paths = paths + [TOC]
        archive = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in all_paths},
                              old['extraction'] if old else None, archive_name=ARCHIVE)
        require(all(p in archive.entries for p in paths), 'Declared Baron bank is absent from the source archive')
        require(all(0 < archive.entries[p].size <= 32 * 1024 * 1024 for p in paths), 'Unexpected Baron bank size')
        archive.extract(paths, args.output_dir, flat=True)
        record = dict(format=1, sourcePinSha256=SOURCE_SHA, bankUnit=units[0], helper=helper,
                      extraction=archive.provenance(),
                      scope='Original declared base SFX banks only. Event/media graph, cue selection, decoding and playback remain unverified.')
        for row in record['extraction']['files']:
            require((args.output_dir / (row['wadPathHash'] + '.bnk')).read_bytes()[:4] == b'BKHD', 'Unexpected sound-bank magic')
        encoded = (json.dumps(record, indent=2) + '\n').encode()
        require(old is None or args.record.read_bytes() == encoded, 'Baron audio provenance differs')
        if old is None:
            args.record.parent.mkdir(parents=True, exist_ok=True)
            with args.record.open('xb') as stream:
                stream.write(encoded)
        old = record
    print(json.dumps(dict(status='passed', banks=2, bytes=sum(r['bytes'] for r in old['extraction']['files']), mode='check' if args.check else 'restore')))


if __name__ == '__main__':
    main()
