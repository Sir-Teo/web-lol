"""Trace all five declared Daybreak play/stop events through the frozen Leona banks."""
from pathlib import Path
import hashlib
import json
import struct
import subprocess
import sys
import xml.etree.ElementTree as ET
def require(condition, message):
    if not condition:
        raise ValueError(message)

def emit(path, raw):
    if '--check' in sys.argv:
        require(path.is_file() and path.read_bytes() == raw, 'Changed or missing output: ' + str(path))
    elif path.exists():
        require(path.read_bytes() == raw, 'Refuse changed output: ' + str(path))
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)

require(all(arg == '--check' for arg in sys.argv[1:]), 'Unknown argument')

REVISION = '71654ed1a2c4642894bd7e7ed79eba66986fb770'
require(subprocess.check_output(['git', '-C', '.tools/wwiser', 'rev-parse', 'HEAD'], text=True).strip() == REVISION, 'Source graph constraint failed')
sys.path.insert(0, '.tools/wwiser')
from wwiser.wfnv import Fnv
sha = lambda b: hashlib.sha256(b).hexdigest()

def map_leona_q_audio():
    pin_path = Path('docs/reference/leona-audio-extraction.json')
    require(sha(pin_path.read_bytes()) == '4e7f472582ad48b5818746fccdafe784a6248388406975f8fef3cb5e37eb4fdb', 'Pinned extraction changed')
    pin = json.loads(pin_path.read_text())
    root = ET.fromstring(b'<banks>' + Path('.cache/leona-audio-banks-v1-20261023.xml').read_bytes() + b'</banks>')
    index = {}
    for obj in root.iter('object'):
        field = obj.find("field[@name='ulID']")
        if field is not None:
            identity = int(field.get('value'))
            require(identity not in index, 'Source graph constraint failed')
            index[identity] = obj

    def number(node, name, default=None):
        field = node.find(f".//field[@name='{name}']")
        return default if field is None else int(field.get('value'))

    def parameters(node, path=''):
        for child in node:
            current = path + '/' + child.get('name', child.tag) + (':' + child.get('index') if child.get('index') is not None else '')
            if child.tag == 'field':
                yield [current, child.get('type'), child.get('value'), child.get('valuefmt')]
            yield from parameters(child, current)

    def descendants(identity):
        reached, queue = (set(), [identity])
        while queue:
            current = queue.pop()
            if current in reached:
                continue
            reached.add(current)
            obj = index[current]
            require(obj.get('name') in ('CAkRanSeqCntr', 'CAkSound', 'CAkActorMixer', 'CAkLayerCntr', 'CAkSwitchCntr'), obj.get('name'))
            queue.extend((int(f.get('value')) for f in obj.iter('field') if f.get('name') == 'ulChildID'))
        return reached
    reference = Path('docs/reference/leona-model.json')
    require(sha(reference.read_bytes()) == '4afb6c31fc7d23c6c820d380d6ac789fada29866776dea29d4f60355b2348cc7', 'Pinned model reference changed')
    skin = json.loads(reference.read_text())['skin']['data']['Characters/Leona/Skins/Skin0']
    unit = next((u for u in skin['skinAudioProperties']['bankUnits'] if u['name'] == 'Leona_Base_SFX'))
    names = sorted((n for n in unit['events'] if '_LeonaShieldOfDaybreak' in n))
    require(len(names) == 5, 'Source graph constraint failed')
    events, selected, media_ids = ([], set(), set())
    for name in names:
        identity = Fnv().get_hash(name)
        require(index[identity].get('name') == 'CAkEvent', 'Source graph constraint failed')
        selected.add(identity)
        actions = []
        for f in index[identity].iter('field'):
            if f.get('name') != 'ulActionID':
                continue
            action_id = int(f.get('value'))
            action = index[action_id]
            kind = action.get('name')
            require(kind in ('CAkActionPlay', 'CAkActionStop'), 'Source graph constraint failed')
            require(name.startswith('Play_' if kind == 'CAkActionPlay' else 'Stop_'), 'Source graph constraint failed')
            target = number(action, 'idExt')
            nodes = descendants(target)
            affected = sorted({number(index[i], 'sourceID') for i in nodes if index[i].get('name') == 'CAkSound'})
            selected.update(nodes | {action_id})
            if kind == 'CAkActionPlay':
                media_ids.update(affected)
            actions.append(dict(id=action_id, type=kind, target=target, targetNodes=sorted(nodes), affectedMediaIds=affected))
        require(actions, 'Source graph constraint failed')
        events.append(dict(name=name, id=identity, actions=actions))
    inherited, unresolved, queue = (set(), set(), list(selected))
    while queue:
        obj = index[queue.pop()]
        dependencies = [number(obj, 'DirectParentID', 0), number(obj, 'OverrideBusId', 0)]
        for prop in obj.iter('object'):
            p = prop.find("field[@name='pID']")
            if p is not None and '[AttenuationID]' in p.get('valuefmt', ''):
                dependencies.append(number(prop, 'pValue', 0))
        for dep in dependencies:
            if not dep or dep in selected or dep in inherited:
                continue
            if dep not in index:
                unresolved.add(dep)
            else:
                inherited.add(dep)
                queue.append(dep)
    audio = next((s for s in pin['files'] if s['path'].endswith('_audio.bnk')))
    bank_sources = []
    for item in pin['files']:
        local = Path('.cache/leona-audio-sources-v1-20261023') / item['path']
        bank_raw = local.read_bytes()
        require(len(bank_raw) == item['bytes'] and sha(bank_raw) == item['sha256'], 'Source graph constraint failed')
        bank_sources.append(dict(item, localPath=str(local)))
    raw = (Path('.cache/leona-audio-sources-v1-20261023') / audio['path']).read_bytes()
    chunks, offset = ({}, 0)
    while offset < len(raw):
        tag, size = struct.unpack_from('<4sI', raw, offset)
        start = offset + 8
        require(tag not in chunks and start + size <= len(raw), 'Source graph constraint failed')
        chunks[tag] = (start, size)
        offset = start + size
    require(offset == len(raw), 'Source graph constraint failed')
    start, length = chunks[b'DIDX']
    require(length % 12 == 0, 'Source graph constraint failed')
    entries = {i: (o, s) for i, o, s in struct.iter_unpack('<III', raw[start:start + length])}
    require(len(entries) == length // 12, 'Source graph constraint failed')
    parsed = {number(o, 'id'): (number(o, 'uOffset'), number(o, 'uSize')) for o in root.iter('object') if o.get('name') == 'MediaHeader'}
    require(parsed == entries, 'Source graph constraint failed')
    out = Path('.cache/leona-q-audio-media-v1-20261024')
    out.mkdir(exist_ok=True)
    media = []
    for identity in sorted(media_ids):
        relative, length = entries[identity]
        data_offset, data_size = chunks[b'DATA']
        require(relative + length <= data_size, 'Source graph constraint failed')
        start = data_offset + relative
        encoded = raw[start:start + length]
        require(encoded[:4] == b'RIFF' and encoded[8:12] == b'WAVE', 'Source graph constraint failed')
        require(struct.unpack_from('<I', encoded, 4)[0] + 8 == length, 'Source graph constraint failed')
        emit(out / f'{identity}.wem', encoded)
        media.append(dict(id=identity, bankOffset=start, bytes=length, sha256=sha(encoded)))
    require(len(media) == 13 and len(events) == 5, 'Source graph constraint failed')
    xml_path = Path('.cache/leona-audio-banks-v1-20261023.xml')
    require(sha(xml_path.read_bytes()) == '3e6a35374dfa4501b044c061f996721f0d448853c2654502127d1e1ab044dcd3', 'Source graph constraint failed')
    result = dict(extractionSha256=sha(pin_path.read_bytes()), referenceSha256=sha(reference.read_bytes()), provenance=pin, bankSources=bank_sources, parserXml=dict(path=str(xml_path), bytes=xml_path.stat().st_size, sha256=sha(xml_path.read_bytes())), parserRevision=REVISION, nameHash='Pinned wwiser lowercase UTF-8 FNV-1 uint32', events=events, nodes=[dict(id=i, type=index[i].get('name'), role='event-target' if i in selected else 'inherited', parameters=list(parameters(index[i]))) for i in sorted(selected | inherited)], media=media, unresolvedHierarchyIds=sorted(unresolved), status='Encoded source media and authored play/stop policy. Native event timing, bus mix and runtime playback remain separate.')
    emit(Path('docs/reference/leona-q-audio.json'), (json.dumps(result, indent=2) + '\n').encode())
    return result
if __name__ == '__main__':
    result = map_leona_q_audio()
    print(json.dumps(dict(events=result['events'], media=len(result['media']), nodes=len(result['nodes']), unresolvedHierarchyIds=result['unresolvedHierarchyIds'])))
