"""Freeze all numeric Ahri event graphs and bounded original WEM media; retain declared names without inferring dispatch."""
import argparse
from collections import Counter
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from riot_archive import sha

PIN = Path('docs/reference/ahri-audio-source.json')
PIN_SHA = '0c025cb33d2f0b2f0fd3aed6e9fb7140f3270f10a7aee30f6e4095470b864c0a'
PARSER_REVISION = '71654ed1a2c4642894bd7e7ed79eba66986fb770'


def require(ok, message):
    if not ok:
        raise ValueError(message)


def chunks(raw):
    result, cursor = {}, 0
    while cursor < len(raw):
        require(cursor + 8 <= len(raw), 'Truncated audio chunk header')
        tag, size = struct.unpack_from('<4sI', raw, cursor)
        require(tag not in result and cursor + 8 + size <= len(raw), 'Duplicate/outside audio chunk')
        result[tag] = (cursor + 8, size)
        cursor += 8 + size
    require(cursor == len(raw), 'Audio chunk tail differs')
    return result


def number(node, name, default=None):
    value = node.find(".//field[@name='" + name + "']")
    return default if value is None else int(value.get('value'))


def fields(node, path=''):
    for child in node:
        current = path + '/' + child.get('name', child.tag)
        if child.get('index') is not None:
            current += ':' + child.get('index')
        if child.tag == 'field':
            yield [current, child.get('type'), child.get('value'), child.get('valuefmt')]
        yield from fields(child, current)


def build(output):
    require(sha(PIN.read_bytes()) == PIN_SHA, 'Frozen Ahri bank source record differs')
    require(subprocess.run(['git', '-C', '.tools/wwiser', 'diff', '--quiet']).returncode == 0 and
            subprocess.run(['git', '-C', '.tools/wwiser', 'diff', '--cached', '--quiet']).returncode == 0,
            'Tracked parser source changed')
    require(subprocess.check_output(['git', '-C', '.tools/wwiser', 'rev-parse', 'HEAD'], text=True).strip() == PARSER_REVISION,
            'Wwiser revision differs')
    subprocess.run([sys.executable, 'tools/assets/extract-ahri-audio.py', '--check'], check=True, stdout=subprocess.DEVNULL)
    pin = json.loads(PIN.read_bytes())
    raw_banks, bank_paths = [], []
    for row in pin['extraction']['files']:
        path = Path('.cache/ahri-audio-sources-v1') / (row['wadPathHash'] + '.bnk')
        raw = path.read_bytes()
        require(len(raw) == row['bytes'] and sha(raw) == row['sha256'], 'Ahri bank differs')
        raw_banks.append(raw)
        bank_paths.append(str(path))
    with tempfile.TemporaryDirectory(prefix='ahri-wwiser-') as temporary:
        target = Path(temporary) / 'banks'
        result = subprocess.run([sys.executable, '.tools/wwiser/wwiser.py', '-d', 'xml', '-dn', str(target), *bank_paths], capture_output=True, text=True)
        require(result.returncode == 0, 'Wwiser failed: ' + result.stderr)
        xml = target.with_suffix('.xml').read_bytes()
    roots = ET.fromstring(b'<banks>' + xml + b'</banks>')
    require(len(roots) == 2 and [int(r.get('version')) for r in roots] == [145, 145], 'Bank parser versions differ')
    require(not list(roots.iter('error')), 'Bank parser reported errors')
    index = {}
    for obj in roots.iter('object'):
        identity = obj.find("field[@name='ulID']")
        if identity is None:
            continue
        identity = int(identity.get('value'))
        require(identity not in index, 'Duplicate HIRC identity')
        index[identity] = obj
    counts = dict(sorted(Counter(obj.get('name') for obj in index.values()).items()))
    require(counts == {'CAkActionPlay': 42, 'CAkActionStop': 15, 'CAkActionResetPlaylist': 2,
                       'CAkActorMixer': 10, 'CAkAttenuation': 5,
                       'CAkEvent': 56, 'CAkRanSeqCntr': 40, 'CAkSound': 86}, 'Ahri hierarchy closure differs')
    audio_chunks = chunks(raw_banks[0])
    require(set(audio_chunks) == {b'BKHD', b'DIDX', b'DATA'}, 'Unexpected audio bank chunks')
    start, extent = audio_chunks[b'DIDX']
    data_start, data_size = audio_chunks[b'DATA']
    require(extent % 12 == 0, 'Invalid media index extent')
    media, encoded, ranges = [], {}, []
    for at in range(start, start + extent, 12):
        identity, offset, size = struct.unpack_from('<III', raw_banks[0], at)
        require(identity not in encoded and size >= 12 and offset + size <= data_size, 'Invalid media extent/identity')
        raw = raw_banks[0][data_start + offset:data_start + offset + size]
        require(raw[:4] == b'RIFF' and raw[8:12] == b'WAVE' and struct.unpack_from('<I', raw, 4)[0] + 8 == len(raw), 'Encoded media RIFF differs')
        encoded[identity] = raw
        ranges.append((offset, offset + size))
        media.append(dict(id=identity, offset=offset, bytes=size, sha256=sha(raw), path=str(identity) + '.wem'))
    ordered = sorted(ranges)
    require(all(b <= c for (_, b), (c, _) in zip(ordered, ordered[1:])), 'Overlapping embedded media')
    sound_ids = {number(obj, 'sourceID') for obj in index.values() if obj.get('name') == 'CAkSound'}
    require(sound_ids == set(encoded) and len(media) == 83, 'Sound/media closure differs')
    containers = {'CAkSound', 'CAkRanSeqCntr', 'CAkActorMixer'}

    def descendants(identity):
        reached, queue = set(), [identity]
        while queue:
            current = queue.pop()
            if current in reached:
                continue
            obj = index.get(current)
            require(obj is not None and obj.get('name') in containers, 'Missing/unsupported event target')
            reached.add(current)
            queue.extend(int(f.get('value')) for f in obj.iter('field') if f.get('name') == 'ulChildID')
        return reached

    sys.path.insert(0, '.tools/wwiser')
    from wwiser.wfnv import Fnv
    declared = {Fnv().get_hash(label): label for label in pin['bankUnit']['events']}
    require(len(declared) == 56, 'Declared event hash collision')
    events = []
    for identity, obj in sorted(index.items()):
        if obj.get('name') != 'CAkEvent':
            continue
        actions = []
        for f in obj.iter('field'):
            if f.get('name') != 'ulActionID':
                continue
            action_id = int(f.get('value'))
            action = index.get(action_id)
            require(action is not None and action.get('name') in {'CAkActionPlay', 'CAkActionStop', 'CAkActionResetPlaylist'}, 'Missing/unsupported action')
            target = number(action, 'idExt')
            reached = descendants(target)
            affected = sorted({number(index[n], 'sourceID') for n in reached if index[n].get('name') == 'CAkSound'})
            require(set(affected) <= sound_ids, 'Unknown affected media')
            actions.append(dict(id=action_id, type=action.get('name'), target=target, nodes=sorted(reached), media=affected))
        require(actions, 'Empty bank event')
        events.append(dict(id=identity, declaredName=declared.get(identity), actions=actions))
    unresolved = set()
    for obj in index.values():
        for name in ['DirectParentID', 'OverrideBusId']:
            dependency = number(obj, name, 0)
            if dependency and dependency not in index:
                unresolved.add(dependency)
    graph = dict(format=1, sourcePinSha256=sha(PIN.read_bytes()), parserRevision=PARSER_REVISION,
                 helperSha256=sha(Path(__file__).read_bytes()), parserErrors=0, nodeCounts=counts,
                 declaredEventNames=pin['bankUnit']['events'],
                 unmatchedDeclaredEvents=[dict(id=n, label=label) for n, label in sorted(declared.items()) if n not in {e['id'] for e in events}],
                 undeclaredBankEvents=[e['id'] for e in events if e['declaredName'] is None],
                 events=events, media=media, unresolvedParentOrBusIds=sorted(unresolved),
                 nodes=[dict(id=n, type=obj.get('name'), parameters=list(fields(obj))) for n, obj in sorted(index.items())],
                 limits=['Source skin event strings joined by FNV ID; unmatched declarations stay explicit. No gameplay cue binding, native dispatch, decoding or playback inferred.',
                         'All scalar parser fields are retained; global parent/bus dependencies remain explicit. Original banks stay pinned.',
                         'Action descendant media describe affected closure, not an assertion that Stop/ResetPlaylist plays those clips.'])
    return graph, xml, encoded


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--discover', action='store_true')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--record', type=Path, default=Path('docs/reference/ahri-audio-graph.json'))
    parser.add_argument('--output-dir', type=Path, default=Path('.cache/ahri-audio-media-v1'))
    args = parser.parse_args()
    require(not (args.discover and args.check), 'Discovery/check are exclusive')
    require(args.record.exists() or args.discover, 'Initial graph needs --discover')
    require(not args.discover or (not args.record.exists() and not args.output_dir.exists()), 'Graph discovery needs fresh paths')
    graph, xml, media = build(args.output_dir)
    raw = (json.dumps(graph, indent=2) + '\n').encode()
    require(not args.record.exists() or args.record.read_bytes() == raw, 'Frozen Ahri graph differs')
    outputs = {'banks.xml': xml, **{str(identity) + '.wem': data for identity, data in media.items()}}
    for name, data in outputs.items():
        path = args.output_dir / name
        require(not path.is_symlink(), 'Graph/media cannot be a symlink')
        require(not path.exists() or path.read_bytes() == data, 'Frozen graph/media differs: ' + name)
        require(not args.check or path.exists(), 'Missing graph/media: ' + name)
    if not args.check:
        args.output_dir.mkdir(parents=True, exist_ok=True)
        for name, data in outputs.items():
            path = args.output_dir / name
            if not path.exists():
                with path.open('xb') as stream:
                    stream.write(data)
        if not args.record.exists():
            with args.record.open('xb') as stream:
                stream.write(raw)
    print(json.dumps(dict(status='passed', nodes=sum(graph['nodeCounts'].values()), events=len(graph['events']), media=len(media), decoded=False, runtimePlayback=False)))
