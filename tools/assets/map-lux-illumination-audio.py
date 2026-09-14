"""Resolve pinned Lux Illumination events and extract their encoded media to source cache.

Run inspect-lux-audio.py first. This preserves bank parameters, not a runtime mix.
"""
from pathlib import Path
import hashlib
import json
import struct
import subprocess
import sys
import xml.etree.ElementTree as ET

REVISION = '71654ed1a2c4642894bd7e7ed79eba66986fb770'
assert subprocess.check_output(['git', '-C', '.tools/wwiser', 'rev-parse', 'HEAD'], text=True).strip() == REVISION
sys.path.insert(0, '.tools/wwiser')
from wwiser.wfnv import Fnv


def sha(data):
    return hashlib.sha256(data).hexdigest()


def field(node, name):
    return node.find(f".//field[@name='{name}']")


def number(node, name, default=None):
    found = field(node, name)
    return default if found is None else int(found.get('value'))


def strings(value):
    if isinstance(value, dict):
        for child in value.values():
            yield from strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from strings(child)
    elif isinstance(value, str):
        yield value


pin_path = Path('docs/reference/lux-audio-extraction.json')
pin = json.loads(pin_path.read_text())
for source in pin['files']:
    raw = (Path('.cache/lux-audio-sources') / source['path']).read_bytes()
    assert len(raw) == source['bytes'] and sha(raw) == source['sha256']
# Regenerate the dump from verified bank bytes; never trust a stale XML cache.
subprocess.run([sys.executable, 'tools/assets/inspect-lux-audio.py'], check=True, stdout=subprocess.DEVNULL)
root = ET.fromstring(b'<banks>' + Path('.cache/lux-audio-banks.xml').read_bytes() + b'</banks>')
index = {}
for obj in root.iter('object'):
    identity = obj.find("field[@name='ulID']")
    if identity is not None:
        key = int(identity.get('value'))
        assert key not in index
        index[key] = obj
reference_path = Path('docs/reference/lux-illumination-trigger-vfx.json')
names = sorted({s for s in strings(json.loads(reference_path.read_text()))
                if s == 'Play_sfx_Lux_LuxIlluminationPassive_hit'})
assert len(names) == 1

# Playback edges exclude inheritance, preventing parent mixers from pulling in
# unrelated siblings. Their parameters are collected separately below.
events = []
playback = set()
for name in names:
    event_id = Fnv().get_hash(name)
    assert index[event_id].get('name') == 'CAkEvent'
    actions = [int(f.get('value')) for f in index[event_id].iter('field') if f.get('name') == 'ulActionID']
    queue = list(actions)
    reached = set()
    while queue:
        identity = queue.pop()
        if identity in reached:
            continue
        reached.add(identity)
        obj = index[identity]
        queue.extend(int(f.get('value')) for f in obj.iter('field') if f.get('name') in ('idExt', 'ulChildID'))
    media_ids = sorted({number(index[i], 'sourceID') for i in reached if index[i].get('name') == 'CAkSound'})
    events.append(dict(name=name, id=event_id, actions=actions, playbackNodes=sorted(reached), mediaIds=media_ids))
    playback.update(reached)
    playback.add(event_id)

inherited = set()
unresolved = set()
queue = list(playback)
while queue:
    identity = queue.pop()
    obj = index[identity]
    dependencies = [number(obj, 'DirectParentID', 0), number(obj, 'OverrideBusId', 0)]
    for prop in obj.iter('object'):
        pid = prop.find("field[@name='pID']")
        if pid is not None and '[AttenuationID]' in pid.get('valuefmt', ''):
            dependencies.append(number(prop, 'pValue', 0))
    for dep in dependencies:
        if not dep or dep in playback or dep in inherited:
            continue
        if dep not in index:
            unresolved.add(dep)
        else:
            inherited.add(dep)
            queue.append(dep)

# Preserve full selected parameter trees as paths, including property/range
# distinctions, random playlist order/weights, attenuation curves and RTPCs.
def parameters(node, path=''):
    for child in node:
        name = child.get('name', child.tag)
        suffix = ':' + child.get('index') if child.get('index') is not None else ''
        current = path + '/' + name + suffix
        if child.tag == 'field':
            yield [current, child.get('type'), child.get('value'), child.get('valuefmt')]
        yield from parameters(child, current)

nodes = [dict(id=i, type=index[i].get('name'), role='playback' if i in playback else 'inherited',
              parameters=list(parameters(index[i]))) for i in sorted(playback | inherited)]

# Read DIDX/DATA directly and cross-check the parser's inventory before slicing.
audio_source = next(s for s in pin['files'] if s['path'].endswith('_audio.bnk'))
raw = (Path('.cache/lux-audio-sources') / audio_source['path']).read_bytes()
chunks = {}
offset = 0
while offset < len(raw):
    tag, size = struct.unpack_from('<4sI', raw, offset)
    start = offset + 8
    assert start + size <= len(raw) and tag not in chunks
    chunks[tag] = (start, size)
    offset = start + size
assert offset == len(raw)
start, length = chunks[b'DIDX']
assert length % 12 == 0
entries = {i: (o, s) for i, o, s in struct.iter_unpack('<III', raw[start:start + length])}
assert len(entries) == length // 12
parsed_entries = {number(o, 'id'): (number(o, 'uOffset'), number(o, 'uSize'))
                  for o in root.iter('object') if o.get('name') == 'MediaHeader'}
assert entries == parsed_entries
out = Path('.cache/lux-illumination-audio-media')
out.mkdir(parents=True, exist_ok=True)
media = []
for identity in sorted({m for e in events for m in e['mediaIds']}):
    relative, length = entries[identity]
    data_offset, data_size = chunks[b'DATA']
    assert relative + length <= data_size
    start = data_offset + relative
    encoded = raw[start:start + length]
    assert encoded[:4] == b'RIFF' and encoded[8:12] == b'WAVE'
    assert struct.unpack_from('<I', encoded, 4)[0] + 8 == length
    (out / f'{identity}.wem').write_bytes(encoded)
    media.append(dict(id=identity, bankOffset=start, bytes=length, sha256=sha(encoded)))

result = dict(extractionSha256=sha(pin_path.read_bytes()), referenceSha256=sha(reference_path.read_bytes()),
              parserRevision=REVISION, nameHash='Pinned wwiser lowercase UTF-8 FNV-1 uint32',
              events=events, nodes=nodes, media=media, unresolvedHierarchyIds=sorted(unresolved),
              status='Encoded source media only. Shared bus, native event dispatch/mixing, decoding and listening remain unverified.')
Path('docs/reference/lux-illumination-audio.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(dict(events=len(events), nodes=len(nodes), media=len(media),
                      mediaBytes=sum(m['bytes'] for m in media), unresolvedHierarchyIds=sorted(unresolved))))
