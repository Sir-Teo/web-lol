"""Freeze Ahri death/respawn's ordered source action/playlist/property closure."""
import argparse
import hashlib
import json
from pathlib import Path

GRAPH = '489b0ab33120dc347a8d8a6cbf5f70dc6818a81c7dbab85f540b1e70efa1ecf0'
DECODED = 'b265f964b941c3800dbfb1b7826a90743e4b9cdbcd35368df1876465b88e158e'
EVENTS = ['Play_sfx_Ahri_Death3D_cast', 'Stop_sfx_Ahri_Death3D_cast', 'Play_sfx_Ahri_Respawn3D_buffactivate']


def require(ok, message):
    if not ok:
        raise ValueError(message)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def read():
    graph_raw = Path('docs/reference/ahri-audio-graph.json').read_bytes()
    decoded_raw = Path('docs/reference/ahri-audio-decoded.json').read_bytes()
    require(sha(graph_raw) == GRAPH and sha(decoded_raw) == DECODED, 'Frozen Ahri source inputs differ')
    graph, decoded = json.loads(graph_raw), json.loads(decoded_raw)
    nodes = {n['id']: n for n in graph['nodes']}
    events = {e['declaredName']: e for e in graph['events']}
    chosen = [events[name] for name in EVENTS]
    selected, media = set(), set()
    for event in chosen:
        selected.add(event['id'])
        for action in event['actions']:
            selected.add(action['id'])
            selected.update(action['nodes'])
            media.update(action['media'])
    # Keep ancestor nodes, but never flatten inherited gain/pitch or global bus.
    pending = list(selected)
    while pending:
        identity = pending.pop()
        node = nodes[identity]
        for path, kind, value, label in node['parameters']:
            if not path.endswith('/DirectParentID'):
                continue
            parent = int(value)
            if parent and parent not in selected:
                require(parent in nodes, 'Unresolved local actor ancestry')
                selected.add(parent)
                pending.append(parent)
    # Lifecycle audio has its own actor root, attenuation and unresolved bus.
    require(693628260 in selected, 'Missing lifecycle actor ancestry')
    selected.add(687014649)
    masters = {m['id']: m for m in decoded['media']}
    require(all(identity in masters for identity in media), 'Missing decoded source master')
    play = [a for e in chosen for a in e['actions'] if a['type'] == 'CAkActionPlay']
    stop = [a for e in chosen for a in e['actions'] if a['type'] == 'CAkActionStop']
    reset = [a for e in chosen for a in e['actions'] if a['type'] == 'CAkActionResetPlaylist']
    require(len(play) == 2 and len(stop) == 1 and not reset, 'Changed lifecycle action closure')
    require([a['target'] for a in play] == [889858872, 451024335], 'Changed lifecycle play targets')
    require(stop[0]['target'] == 889858872, 'Changed lifecycle stop target')
    require(len(media) == 2 and set(stop[0]['media']) == {357887993}, 'Changed lifecycle media closure')
    shared = sorted(i for i in media if sum(i in a['media'] for a in play) > 1)
    require(not shared, 'Changed lifecycle Play master sharing')
    return dict(format=1, purpose='Raw lifecycle audio reading; no native dispatch or playback certification',
                helperSha256=sha(Path(__file__).read_bytes()), graphSha256=GRAPH, decodedSha256=DECODED,
                events=chosen, nodes=[nodes[i] for i in sorted(selected)],
                media=[masters[i] for i in sorted(media)],
                summary=dict(events=len(chosen), playActions=len(play), stopActions=len(stop),
                             resetPlaylistActions=len(reset), nodes=len(selected), media=len(media),
                             wavBytes=sum(masters[i]['wavBytes'] for i in media), sharedMediaIds=shared),
                limits=[
                    'Event names are stored in the source SFX declaration and joined by their IDs.',
                    'Action and playlist order, including repeated child IDs, remain in the raw scalar rows.',
                    'Reset/Stop descendant media are affected closures, not assertions that those actions play clips.',
                    'Ancestor properties and randomized ranges remain separate; no native inheritance/default flattening.',
                    'The unresolved global bus, listener calibration and cross-owner playlist scope remain unverified.',
                    'Death and respawn have distinct masters; the death Stop names the affected closure only.',
                    'Lifecycle actor 693628260 declares priority 55, attenuation 687014649 and unresolved bus 2232828494.',
                    'The reading alone does not establish native death/respawn/Stop callback timing.',
                    'No runtime assets, saved state or gameplay bindings are added by this reading.',
                ])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='docs/reference/ahri-lifecycle-audio-properties.json')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    raw = (json.dumps(read(), indent=2) + '\n').encode()
    path = Path(args.output)
    require(not any(p.is_symlink() for p in [path, *path.parents]), 'Reading output closure cannot contain symlinks')
    if path.exists():
        require(path.read_bytes() == raw, 'Existing lifecycle reading differs')
    else:
        require(not args.check, 'Missing lifecycle reading')
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open('xb') as stream:
            stream.write(raw)
    print(json.dumps(dict(status='passed', bytes=len(raw), sha256=sha(raw), **json.loads(raw)['summary'])))
