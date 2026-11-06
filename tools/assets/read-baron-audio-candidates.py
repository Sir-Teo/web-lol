"""Correlate candidate cast/hit FNV labels with original numeric Baron events."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
from riot_archive import sha

GRAPH = Path('docs/reference/baron-audio-graph.json')
GRAPH_SHA = 'eec1c9d1ca816d6c2aeae41ac3190abce2af09034f770de822ec40ab907870b1'
CHARACTER = Path('docs/reference/epic-character-source.json')
CHARACTER_SHA = 'a8f920b71c3c44b5311db3555914db47e8fe207cc489ff7d925b2ff38a250391'


def require(ok, message):
    if not ok:
        raise ValueError(message)


def build():
    require(sha(GRAPH.read_bytes()) == GRAPH_SHA and sha(CHARACTER.read_bytes()) == CHARACTER_SHA,
            'Candidate source graph/character differs')
    require(subprocess.check_output(['git', '-C', '.tools/wwiser', 'rev-parse', 'HEAD'], text=True).strip() ==
            '71654ed1a2c4642894bd7e7ed79eba66986fb770', 'FNV reader revision differs')
    sys.path.insert(0, '.tools/wwiser')
    from wwiser.wfnv import Fnv
    graph = json.loads(GRAPH.read_bytes())
    records = json.loads(CHARACTER.read_bytes())['records']['data/characters/sru_baron/sru_baron.bin']
    actor_path = 'Characters/SRU_Baron/CharacterRecords/Root'
    root = records[actor_path]
    attacks = root['extraAttacks']
    require(len(attacks) == 1 and attacks[0]['mAttackProbability'] == 1 and root['basicAttack']['mAttackProbability'] == 0,
            'Unexpected Baron source attack dispatch declaration')
    script = attacks[0]['mAttackName']
    spell = [v for v in records.values() if isinstance(v, dict) and v.get('ObjectName') == script]
    require(len(spell) == 1 and spell[0]['mScriptName'] == script == 'BaronBasicAttack', 'Unexpected basic spell script')
    actor = actor_path.split('/')[1]
    index = {e['id']: e for e in graph['events']}
    roles = {}
    for role, suffix, count in [('cast', 'OnCast', 6), ('hit', 'OnHit', 2)]:
        label = f'Play_sfx_{actor}_{script}_{suffix}'
        identity = Fnv().get_hash(label)
        require(identity in index and index[identity]['declaredName'] is None, 'Candidate does not match an unlabelled bank event')
        event = index[identity]
        require(all(a['type'] == 'CAkActionPlay' for a in event['actions']), 'Unexpected candidate action type')
        media = sorted({m for a in event['actions'] for m in a['media']})
        require(len(media) == count, 'Candidate media closure differs')
        roles[role] = dict(candidateLabel=label, id=identity, declaredSourceString=False,
                           evidence='FNV-1 label crack corroborated by the skin actor path, source script name and existing event naming convention; not an attested stored event string.',
                           actions=event['actions'], media=media)
    return dict(format=1, graphSha256=GRAPH_SHA, characterSha256=CHARACTER_SHA,
                helperSha256=sha(Path(__file__).read_bytes()), actor=actor, script=script,
                roles=roles, gameplayBinding=None,
                limits=['Candidate semantic labels are separate from the immutable unlabelled source graph.',
                        'Native event timing, dispatch, random sequence, global bus/mix and listening parity remain unverified.'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    record = Path('docs/reference/baron-audio-candidate-reading.json')
    result = build()
    raw = (json.dumps(result, indent=2) + '\n').encode()
    require(not record.exists() or record.read_bytes() == raw, 'Frozen candidate reading differs')
    require(not args.check or record.exists(), 'Missing candidate reading')
    if not args.check and not record.exists():
        with record.open('xb') as stream:
            stream.write(raw)
    print(json.dumps(dict(status='passed', roles={k: dict(event=v['id'], actions=len(v['actions']), media=len(v['media'])) for k, v in result['roles'].items()}, runtimeBinding=False)))
