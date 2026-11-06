"""Overlay attested animation-event strings onto the immutable numeric audio graph."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def require(ok, message):
    if not ok:
        raise ValueError(message)


MODEL = Path('docs/reference/epic-models-source.json')
MODEL_SHA = '193ac8c3693acb846601bca8b623eb906f9587ed2fad0fe984e3fba7c86a4b2b'
GRAPH = Path('docs/reference/baron-audio-graph.json')
GRAPH_SHA = 'eec1c9d1ca816d6c2aeae41ac3190abce2af09034f770de822ec40ab907870b1'


def build():
    require(sha(MODEL.read_bytes()) == MODEL_SHA and sha(GRAPH.read_bytes()) == GRAPH_SHA,
            'Frozen animation source/audio graph differs')
    require(subprocess.check_output(['git', '-C', '.tools/wwiser', 'rev-parse', 'HEAD'], text=True).strip() ==
            '71654ed1a2c4642894bd7e7ed79eba66986fb770', 'Pinned FNV reader revision differs')
    require(Path('.tools/wwiser/wwiser/wfnv.py').read_bytes() ==
            subprocess.check_output(['git', '-C', '.tools/wwiser', 'show', 'HEAD:wwiser/wfnv.py']),
            'Pinned FNV reader bytes differ')
    sys.path.insert(0, '.tools/wwiser')
    from wwiser.wfnv import Fnv
    source = json.loads(MODEL.read_bytes())['records']['data/characters/sru_baron/animations/skin0.bin']
    actor_path = 'Characters/SRU_Baron/Animations/Skin0'
    clips = source[actor_path]['mClipDataMap']
    graph = json.loads(GRAPH.read_bytes())
    bank_events = {event['id']: event for event in graph['events']}
    occurrences, labels = [], {}
    for clip_key, clip in clips.items():
        for event_key, event in clip.get('mEventDataMap', {}).items():
            label = event.get('{9d477e74}')
            if label is None:
                continue
            require(isinstance(label, str) and label.startswith(('Play_', 'Stop_')), 'Unexpected stored audio label')
            identity = Fnv().get_hash(label)
            matched = bank_events.get(identity)
            if label not in labels:
                labels[label] = dict(label=label, id=identity, attestedSourceString=True,
                                     foundInPinnedBank=matched is not None,
                                     actions=matched['actions'] if matched else None,
                                     media=sorted({m for a in matched['actions'] for m in a['media']}) if matched else None)
            occurrences.append(dict(clipKey=clip_key, clipAnimationResource=clip.get('mAnimationResourceData'),
                                    eventKey=event_key, event=event, id=identity,
                                    startFramePresent='mStartFrame' in event,
                                    startFrame=event.get('mStartFrame')))
    require(len(labels) == 9 and len({entry['id'] for entry in labels.values()}) == 9,
            'Attested animation label closure/collision differs')
    missing = sorted(label for label, entry in labels.items() if not entry['foundInPinnedBank'])
    require(missing == ['Play_sfx_SRU_Baron_BaronSpellCast6NS_cast'], 'Missing bank label set differs')
    require(all(bank_events[entry['id']]['declaredName'] is None for entry in labels.values() if entry['foundInPinnedBank']),
            'Immutable graph naming evidence changed')
    return dict(format=1, sourceModelsSha256=MODEL_SHA, numericGraphSha256=GRAPH_SHA,
                helperSha256=sha(Path(__file__).read_bytes()), fnvReaderSha256=sha(Path('.tools/wwiser/wwiser/wfnv.py').read_bytes()),
                sourceActorPath=actor_path, labels=[labels[label] for label in sorted(labels)],
                occurrences=occurrences, gameplayBinding=None,
                limits=['Stored strings are attested animation-source values; numeric graph remains unchanged.',
                        'Omitted start frames stay absent; no default time, frame rate or native dispatch is inferred.',
                        'One stored label has no event in the pinned skin bank; no fallback event/media is invented.',
                        'Basic-attack cast/hit labels remain separate hash-derived candidates, not attested by this overlay.',
                        'No boss ability kit, native timing, shuffle, global mix or runtime playback is added.'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--discover', action='store_true')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--record', type=Path, default=Path('docs/reference/baron-animation-audio-reading.json'))
    args = parser.parse_args()
    require(not (args.discover and args.check), 'Discovery/check are exclusive')
    result = build()
    raw = (json.dumps(result, indent=2) + '\n').encode()
    if args.discover:
        with args.record.open('xb') as stream:
            stream.write(raw)
    else:
        require(args.record.read_bytes() == raw, 'Frozen animation audio reading differs')
    print(json.dumps(dict(status='passed', labels=len(result['labels']), occurrences=len(result['occurrences']),
                          bankMatches=sum(row['foundInPinnedBank'] for row in result['labels']), runtimeBinding=False)))
