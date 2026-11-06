"""Freeze/check the two base SFX banks declared by the original Ahri skin."""
import argparse
import json
from pathlib import Path
import struct
import subprocess
from riot_archive import RiotArchive, sha

SOURCE = Path('docs/reference/ahri-model.json')
SOURCE_SHA = '74d0b55f5aad08646fbd24f660ed533bc8fd5798e8a60dc0983d97960b47a377'
ARCHIVE = 'DATA/FINAL/Champions/Ahri.wad.client'
TOC = 'data/final/champions/ahri.wad.subchunktoc'
PATHS = ['assets/sounds/wwise2016/sfx/characters/ahri/skins/base/ahri_base_sfx_audio.bnk',
         'assets/sounds/wwise2016/sfx/characters/ahri/skins/base/ahri_base_sfx_events.bnk']


def require(ok, message):
    if not ok:
        raise ValueError(message)


def inspect_bank(raw):
    require(len(raw) >= 20 and raw[:4] == b'BKHD', 'Invalid Ahri sound-bank header')
    chunks, cursor = [], 0
    while cursor < len(raw):
        require(cursor + 8 <= len(raw), 'Truncated sound-bank chunk')
        tag, size = struct.unpack_from('<4sI', raw, cursor)
        require(cursor + 8 + size <= len(raw), 'Sound-bank chunk outside file')
        chunks.append(dict(tag=tag.decode('ascii'), bytes=size))
        cursor += 8 + size
    require(cursor == len(raw) and chunks[0]['bytes'] >= 12, 'Invalid sound-bank extent')
    version, identity, language = struct.unpack_from('<III', raw, 8)
    return dict(version=version, bankId=identity, languageId=language, chunks=chunks)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--discover', action='store_true')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--record', type=Path, default=Path('docs/reference/ahri-audio-source.json'))
    parser.add_argument('--output-dir', type=Path, default=Path('.cache/ahri-audio-sources-v1'))
    args = parser.parse_args()
    require(not (args.discover and args.check), 'Discovery/check are exclusive')
    require(sha(SOURCE.read_bytes()) == SOURCE_SHA, 'Pinned Ahri skin definition differs')
    require(subprocess.check_output(['git', '-C', '.tools/cdtb', 'rev-parse', 'HEAD'], text=True).strip() ==
            'ba981db2a2c814a0d78e55f6483e0636b527850f', 'CDTB revision differs')
    units = json.loads(SOURCE.read_bytes())['skin']['data']['Characters/Ahri/Skins/Skin0']['skinAudioProperties']['bankUnits']
    sfx = [unit for unit in units if unit['name'] == 'Ahri_Base_SFX']
    require(len(sfx) == 1 and [p.lower() for p in sfx[0]['bankPath']] == PATHS and
            len(sfx[0]['events']) == len(set(sfx[0]['events'])) == 56, 'Ahri SFX declarations differ')
    old = json.loads(args.record.read_bytes()) if args.record.exists() else None
    require(old is not None or args.discover, 'Initial discovery requires --discover')
    require(not args.discover or (old is None and not args.output_dir.exists()), 'Discovery needs fresh paths')
    helper = dict(path='tools/assets/extract-ahri-audio.py', sha256=sha(Path(__file__).read_bytes()))
    if old:
        require(old['sourcePinSha256'] == SOURCE_SHA and old['bankUnit'] == sfx[0] and old['helper'] == helper and
                old['extraction']['archive'] == ARCHIVE, 'Frozen Ahri input/helper differs')
        require([row['path'] for row in old['extraction']['files']] == PATHS, 'Frozen bank closure differs')
        for row in old['extraction']['files']:
            path = args.output_dir / (row['wadPathHash'] + '.bnk')
            require(not path.is_symlink(), 'Ahri bank cannot be a symlink')
            require(path.exists() or not args.check, 'Missing frozen Ahri bank')
            if path.exists():
                raw = path.read_bytes()
                require(len(raw) == row['bytes'] and sha(raw) == row['sha256'], 'Frozen Ahri bank differs')
                require(inspect_bank(raw) == old['bankHeaders'][row['path']], 'Frozen bank header differs')
    if not args.check:
        from xxhash import xxh64_intdigest
        archive = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in PATHS + [TOC]},
                              old['extraction'] if old else None, archive_name=ARCHIVE)
        require(all(path in archive.entries and 0 < archive.entries[path].size <= 32 * 1024 * 1024 for path in PATHS),
                'Declared Ahri SFX bank absent or outside size bounds')
        archive.extract(PATHS, args.output_dir, flat=True)
        extraction = archive.provenance()
        headers = {row['path']: inspect_bank((args.output_dir / (row['wadPathHash'] + '.bnk')).read_bytes())
                   for row in extraction['files']}
        record = dict(format=1, sourcePinSha256=SOURCE_SHA, bankUnit=sfx[0], helper=helper,
                      extraction=extraction, bankHeaders=headers,
                      limits=['Original base SFX banks and their 56 stored event declarations only.',
                              'Separate voice banks/WPK are outside this extraction.',
                              'Hierarchy/media closure, decoding, native timing/mix and playback remain unverified.'])
        encoded = (json.dumps(record, indent=2) + '\n').encode()
        require(old is None or args.record.read_bytes() == encoded, 'Frozen Ahri provenance differs')
        if old is None:
            with args.record.open('xb') as stream:
                stream.write(encoded)
        old = record
    print(json.dumps(dict(status='passed', banks=2, bytes=sum(row['bytes'] for row in old['extraction']['files']),
                          declaredEvents=56, mode='check' if args.check else 'restore', runtimeChanged=False)))
