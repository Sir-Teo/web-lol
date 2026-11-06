"""Freeze Orb of Deception's ordered source action/playlist/property closure."""
import argparse
import hashlib
import json
from pathlib import Path

GRAPH = '489b0ab33120dc347a8d8a6cbf5f70dc6818a81c7dbab85f540b1e70efa1ecf0'
DECODED = 'b265f964b941c3800dbfb1b7826a90743e4b9cdbcd35368df1876465b88e158e'
EVENTS = [
    'Play_sfx_Ahri_AhriQ_OnCast',
    'Play_sfx_Ahri_AhriQMissile_OnMissileLaunch',
    'Stop_sfx_Ahri_AhriQMissile_OnMissileLaunch',
    'Play_sfx_Ahri_AhriQDamage_hit',
    'Play_sfx_Ahri_AhriQReturnMissile_OnMissileLaunch',
    'Stop_sfx_Ahri_AhriQReturnMissile_OnMissileLaunch',
    'Play_sfx_Ahri_AhriQReturnDamage_hit',
    'Play_sfx_Ahri_AhriQReturnMissile_buffdeactivate',
]

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
    # Shared local spell attenuation is stored on the actor root.
    require(353175404 in selected and 150405345 in selected, 'Missing Q spell mixer ancestry')
    selected.add(339248780)
    masters = {m['id']: m for m in decoded['media']}
    require(all(identity in masters for identity in media), 'Missing decoded source master')
    play = [a for e in chosen for a in e['actions'] if a['type'] == 'CAkActionPlay']
    stop = [a for e in chosen for a in e['actions'] if a['type'] == 'CAkActionStop']
    reset = [a for e in chosen for a in e['actions'] if a['type'] == 'CAkActionResetPlaylist']
    require(len(play) == 6 and len(stop) == 2 and len(reset) == 2, 'Changed Q action closure')
    require([a['type'] for a in chosen[0]['actions']] ==
            ['CAkActionResetPlaylist', 'CAkActionResetPlaylist', 'CAkActionPlay'], 'Changed ordered Q cast dispatch')
    require([a['target'] for a in chosen[0]['actions']] == [910996742, 1066170488, 838875043],
            'Changed reset/play targets')
    return dict(format=1, purpose='Raw Q audio reading; no native dispatch or playback certification',
                helperSha256=sha(Path(__file__).read_bytes()), graphSha256=GRAPH, decodedSha256=DECODED,
                events=chosen, nodes=[nodes[i] for i in sorted(selected)],
                media=[masters[i] for i in sorted(media)],
                summary=dict(events=len(chosen), playActions=len(play), stopActions=len(stop),
                             resetPlaylistActions=len(reset), nodes=len(selected), media=len(media),
                             wavBytes=sum(masters[i]['wavBytes'] for i in media)),
                limits=[
                    'Event names are stored in the source SFX declaration and joined by their IDs.',
                    'Action and playlist order, including repeated child IDs, remain in the raw scalar rows.',
                    'Reset/Stop descendant media are affected closures, not assertions that those actions play clips.',
                    'Ancestor properties and randomized ranges remain separate; no native inheritance/default flattening.',
                    'The unresolved global bus, listener calibration and cross-owner playlist scope remain unverified.',
                    'No runtime assets, saved state or gameplay bindings are added by this reading.',
                ])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='docs/reference/ahri-q-audio-properties.json')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    raw = (json.dumps(read(), indent=2) + '\n').encode()
    path = Path(args.output)
    require(not path.is_symlink(), 'Reading output cannot be a symlink')
    if path.exists():
        require(path.read_bytes() == raw, 'Existing Q reading differs')
    else:
        require(not args.check, 'Missing Q reading')
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open('xb') as stream:
            stream.write(raw)
    print(json.dumps(dict(status='passed', bytes=len(raw), sha256=sha(raw), **json.loads(raw)['summary'])))
