"""Preserve candidate attack action/container properties and local ancestry."""
import argparse
import json
import hashlib
from pathlib import Path


def sha(data):
    return hashlib.sha256(data).hexdigest()

GRAPH = Path('docs/reference/baron-audio-graph.json')
GRAPH_SHA = 'eec1c9d1ca816d6c2aeae41ac3190abce2af09034f770de822ec40ab907870b1'
READING = Path('docs/reference/baron-audio-candidate-reading.json')
READING_SHA = 'a6e058c208a15a0c0b11f22781dc077d2b4ed5bf4204a5130f1b07ed85838afe'


def require(ok, message):
    if not ok:
        raise ValueError(message)


def build():
    require(sha(GRAPH.read_bytes()) == GRAPH_SHA and sha(READING.read_bytes()) == READING_SHA,
            'Frozen graph/candidate reading differs')
    graph = json.loads(GRAPH.read_bytes())
    reading = json.loads(READING.read_bytes())
    nodes = {row['id']: row for row in graph['nodes']}
    selected = set()
    for role in reading['roles'].values():
        for action in role['actions']:
            selected.add(action['id'])
            selected.update(action['nodes'])
    queue = list(selected)
    external = set()
    while queue:
        identity = queue.pop()
        parameters = nodes[identity]['parameters']
        for index, (path, kind, value, label) in enumerate(parameters):
            if path.endswith('/pID') and label == '0x46 [AttenuationID]':
                reference = int(parameters[index + 1][2])
                require(reference in nodes, 'Missing local attenuation')
                if reference not in selected:
                    selected.add(reference)
                    queue.append(reference)
            if path.endswith(('/DirectParentID', '/OverrideBusId')):
                parent = int(value)
                if not parent:
                    continue
                if parent not in nodes:
                    external.add(parent)
                elif parent not in selected:
                    selected.add(parent)
                    queue.append(parent)
    # Preserve all scalar rows, including range modifiers, positioning, voice limits,
    # playlist order, flags and RTPC references; do not collapse inheritance to a gain.
    return dict(format=1, graphSha256=GRAPH_SHA, candidateReadingSha256=READING_SHA,
                helperSha256=sha(Path(__file__).read_bytes()),
                nodes=[nodes[identity] for identity in sorted(selected)],
                unresolvedParentOrBusIds=sorted(external), gameplayBinding=None,
                limits=['Action Probability is not an unconditional simultaneous layer.',
                        'DelayTime is relative to event dispatch; native gameplay dispatch remains unknown.',
                        'Global bus gain/routing, native shuffle state and mix remain unresolved.'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--discover', action='store_true')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--record', type=Path, default=Path('docs/reference/baron-basic-audio-properties.json'))
    args = parser.parse_args()
    require(not (args.discover and args.check), 'Discovery/check are exclusive')
    raw = (json.dumps(build(), indent=2) + '\n').encode()
    if args.discover:
        with args.record.open('xb') as stream:
            stream.write(raw)
    else:
        require(args.record.read_bytes() == raw, 'Frozen candidate properties differ')
    print(json.dumps(dict(status='passed', nodes=len(json.loads(raw)['nodes']), runtimePlayback=False)))
