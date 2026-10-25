"""Restore exact source WEM caches from the already pinned/extracted Garen bank.

This does not decode audio or regenerate authoring graphs, public WAVs or pins.
Run extract-garen-audio.py first. Every selected source is validated before any
write; differing existing cache files are never overwritten. Guards survive -O.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[2]
ABILITIES = ('aa', 'p', 'q', 'w', 'e', 'r')
PARSER_REVISION = '71654ed1a2c4642894bd7e7ed79eba66986fb770'


def require(ok, message):
    if not ok:
        raise ValueError(message)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def prepare(root, abilities):
    require(abilities and len(set(abilities)) == len(abilities)
            and all(a in ABILITIES for a in abilities), 'Invalid/duplicate ability selection')
    reference = root / 'docs/reference'
    extraction_raw = (reference / 'garen-audio-extraction.json').read_bytes()
    extraction = json.loads(extraction_raw)
    require(extraction['referenceVersion'] == '16.18.8175716'
            and extraction['archive'] == 'DATA/FINAL/Champions/Garen.wad.client',
            'Frozen Garen source identity differs')
    audio = [r for r in extraction['files'] if r['path'].endswith('garen_base_sfx_audio.bnk')]
    require(len(audio) == 1, 'Expected one source media bank')
    row = audio[0]
    path = Path(row['path'])
    require(not path.is_absolute() and '..' not in path.parts, 'Invalid bank path')
    bank = (root / '.cache/garen-audio-sources' / path).read_bytes()
    require(len(bank) == row['bytes'] and sha(bank) == row['sha256'], 'Original bank differs')
    model_sha = sha((reference / 'garen-model.json').read_bytes())
    result = []
    for ability in abilities:
        graph_raw = (reference / f'garen-{ability}-audio.json').read_bytes()
        graph = json.loads(graph_raw)
        decoded = json.loads((reference / f'garen-{ability}-audio-decoded.json').read_bytes())
        require(graph['extractionSha256'] == sha(extraction_raw)
                and graph['referenceSha256'] == model_sha
                and graph['parserRevision'] == PARSER_REVISION
                and decoded['sourceGraphSha256'] == sha(graph_raw), 'Graph provenance differs')
        media = graph['media']
        known = {m['id']: m for m in decoded['media']}
        require(media and len(known) == len(decoded['media']) == len(media),
                'Media coverage differs')
        seen = set()
        for entry in media:
            identity, start, length = entry['id'], entry['bankOffset'], entry['bytes']
            require(type(identity) is int and identity > 0 and identity not in seen
                    and identity in known, 'Invalid/duplicate media identity')
            require(type(start) is int and type(length) is int and start >= 0
                    and length >= 12 and start + length <= len(bank), 'Media outside source bank')
            raw = bank[start:start + length]
            require(sha(raw) == entry['sha256'] == known[identity]['encodedSha256'],
                    'Encoded source media differs')
            require(raw[:4] == b'RIFF' and raw[8:12] == b'WAVE'
                    and struct.unpack_from('<I', raw, 4)[0] + 8 == length,
                    'Invalid original WEM extent')
            output = root / f'.cache/garen-{ability}-audio-media/{identity}.wem'
            if output.exists():
                require(output.read_bytes() == raw, 'Existing media differs: ' + str(output))
            result.append((output, raw))
            seen.add(identity)
    return result


def restore(root, abilities, check=False):
    prepared = prepare(root, abilities)
    if check:
        require(all(p.exists() for p, _ in prepared), 'Source WEM cache is incomplete')
    else:
        for path, raw in prepared:
            if not path.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                # Exclusive creation also prevents a concurrent restore replacing a file.
                with path.open('xb') as out:
                    out.write(raw)
    return {'files': len(prepared), 'bytes': sum(len(b) for _, b in prepared), 'check': check}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ability', action='append', choices=ABILITIES)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    print(json.dumps(restore(ROOT, args.ability or ['aa', 'p'], args.check)))
