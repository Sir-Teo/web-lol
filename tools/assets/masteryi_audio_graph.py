"""Source-event graph projection and bounded encoded-media extraction."""
from pathlib import Path
import hashlib
import struct
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from masteryi_audio_source import BANKS, BANK_ROOT, EXTRACTION_SHA256, REFERENCE_SHA256, inputs

PARSER_REVISION = '71654ed1a2c4642894bd7e7ed79eba66986fb770'
CONTAINERS = {'CAkRanSeqCntr', 'CAkSound', 'CAkActorMixer', 'CAkLayerCntr', 'CAkSwitchCntr'}


def sha(data): return hashlib.sha256(data).hexdigest()


def event_hash(name):
    value = 2166136261
    for byte in name.lower().encode('utf-8'):
        value = ((value * 16777619) ^ byte) & 0xffffffff
    return value


def chunks(raw):
    result = {}; offset = 0
    while offset < len(raw):
        if offset + 8 > len(raw): raise ValueError('Truncated bank chunk header')
        tag, size = struct.unpack_from('<4sI', raw, offset)
        start = offset + 8
        if tag in result or start + size > len(raw): raise ValueError('Invalid bank chunk extent or duplicate')
        result[tag] = (start, size)
        offset = start + size
    return result


def number(node, name, default=None):
    field = node.find(f".//field[@name='{name}']")
    return default if field is None else int(field.get('value'))


def parameters(node, path=''):
    for child in node:
        current = path + '/' + child.get('name', child.tag)
        if child.get('index') is not None: current += ':' + child.get('index')
        if child.tag == 'field': yield [current, child.get('type'), child.get('value'), child.get('valuefmt')]
        yield from parameters(child, current)


def project(root, unit, audio):
    index = {}
    for obj in root.iter('object'):
        field = obj.find("field[@name='ulID']")
        if field is None: continue
        identity = int(field.get('value'))
        if identity in index: raise ValueError('Duplicate hierarchy identity')
        index[identity] = obj

    def descendants(identity):
        reached = set(); queue = [identity]
        while queue:
            current = queue.pop()
            if current in reached: continue
            obj = index.get(current)
            if obj is None or obj.get('name') not in CONTAINERS: raise ValueError('Missing or unsupported selected hierarchy node')
            reached.add(current)
            queue.extend(int(f.get('value')) for f in obj.iter('field') if f.get('name') == 'ulChildID')
        return reached

    events = []; selected = set(); media_ids = set()
    for name in unit['events']:
        identity = event_hash(name)
        if identity not in index or index[identity].get('name') != 'CAkEvent': raise ValueError('Missing declared event: ' + name)
        selected.add(identity); actions = []
        for field in index[identity].iter('field'):
            if field.get('name') != 'ulActionID': continue
            action_id = int(field.get('value'))
            action = index.get(action_id)
            if action is None or action.get('name') not in {'CAkActionPlay', 'CAkActionStop'}: raise ValueError('Missing or unsupported action')
            target = number(action, 'idExt')
            nodes = descendants(target)
            affected = {number(index[i], 'sourceID') for i in nodes if index[i].get('name') == 'CAkSound'}
            if None in affected: raise ValueError('Sound omits source identity')
            selected.update(nodes | {action_id})
            if action.get('name') == 'CAkActionPlay': media_ids.update(affected)
            actions.append({'id': action_id, 'type': action.get('name'), 'target': target, 'targetNodes': sorted(nodes), 'affectedMediaIds': sorted(affected)})
        if not actions: raise ValueError('Declared event has no actions')
        events.append({'name': name, 'id': identity, 'actions': actions})

    inherited = set(); unresolved = set(); queue = list(selected)
    while queue:
        obj = index[queue.pop()]
        dependencies = [number(obj, 'DirectParentID', 0), number(obj, 'OverrideBusId', 0)]
        for prop in obj.iter('object'):
            field = prop.find("field[@name='pID']")
            if field is not None and '[AttenuationID]' in field.get('valuefmt', ''): dependencies.append(number(prop, 'pValue', 0))
        for dep in dependencies:
            if not dep or dep in selected or dep in inherited: continue
            if dep not in index: unresolved.add(dep)
            else: inherited.add(dep); queue.append(dep)

    parts = chunks(audio)
    if b'DIDX' not in parts or b'DATA' not in parts: raise ValueError('Audio bank omits media chunks')
    start, length = parts[b'DIDX']
    if length % 12: raise ValueError('Misaligned DIDX table')
    rows = list(struct.iter_unpack('<III', audio[start:start + length]))
    entries = {identity: (offset, size) for identity, offset, size in rows}
    if len(entries) != len(rows): raise ValueError('Duplicate DIDX media')
    parsed = {number(obj, 'id'): (number(obj, 'uOffset'), number(obj, 'uSize')) for obj in root.iter('object') if obj.get('name') == 'MediaHeader'}
    if parsed != entries: raise ValueError('Parser media table differs from bank DIDX')
    data_start, data_size = parts[b'DATA']; media = []; encoded = {}
    for identity in sorted(media_ids):
        if identity not in entries: raise ValueError('Referenced source media is not embedded in this bank')
        offset, size = entries[identity]
        if offset + size > data_size: raise ValueError('Media outside bank DATA')
        start = data_start + offset; data = audio[start:start + size]
        if len(data) < 12 or data[:4] != b'RIFF' or data[8:12] != b'WAVE' or struct.unpack_from('<I', data, 4)[0] + 8 != size:
            raise ValueError('Embedded media has inconsistent RIFF/WAVE extent')
        encoded[identity] = data
        media.append({'id': identity, 'bankOffset': start, 'bytes': size, 'sha256': sha(data)})
    result = {'extractionSha256': EXTRACTION_SHA256, 'referenceSha256': REFERENCE_SHA256,
        'parser': {'repository': 'https://github.com/bnnm/wwiser', 'revision': PARSER_REVISION, 'optionalNameDatabasesLoaded': False},
        'nameHash': 'Pinned wwiser lowercase UTF-8 FNV-1 uint32', 'events': events,
        'nodes': [{'id': i, 'type': index[i].get('name'), 'role': 'event-target' if i in selected else 'inherited', 'parameters': list(parameters(index[i]))} for i in sorted(selected | inherited)],
        'media': media, 'unusedEmbeddedMediaIds': sorted(set(entries) - media_ids), 'unresolvedHierarchyIds': sorted(unresolved),
        'status': 'Authored bank graph and encoded media only; active spell bindings, native dispatch, inherited bus mix, decoding and runtime playback remain separate.'}
    return result, encoded


def generate(parser_root, banks=BANK_ROOT):
    parser_root = Path(parser_root).resolve()
    top = subprocess.check_output(['git', '-C', str(parser_root), 'rev-parse', '--show-toplevel'], text=True).strip()
    revision = subprocess.check_output(['git', '-C', str(parser_root), 'rev-parse', 'HEAD'], text=True).strip()
    if Path(top).resolve() != parser_root or revision != PARSER_REVISION: raise ValueError('The exact parser repository/revision is required')
    if subprocess.check_output(['git', '-C', str(parser_root), 'diff', '--name-only', 'HEAD'], text=True).strip(): raise ValueError('Parser tracked sources differ from the pinned revision')
    _, unit = inputs(banks=banks)
    sys.path.insert(0, str(parser_root))
    from wwiser.wfnv import Fnv
    if any(event_hash(name) != Fnv().get_hash(name) for name in unit['events']): raise ValueError('Name hash differs from pinned parser')
    from wwiser.parser.wparser import Parser
    from wwiser.viewer.wdumper import DumpPrinter, TYPE_XML
    parser = Parser()
    parser.parse_banks([str(Path(banks) / row[0]) for row in BANKS])
    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp) / 'banks'
        # Intentionally bypass optional name-database loading in the CLI.
        DumpPrinter(parser.get_banks(), TYPE_XML, str(base)).dump()
        raw = base.with_suffix('.xml').read_bytes()
    root = ET.fromstring(b'<banks>' + raw + b'</banks>')
    audio = (Path(banks) / BANKS[0][0]).read_bytes()
    return project(root, unit, audio)


def write_outputs(outputs, check=False):
    # Preflight every output before creating any missing one.
    for path, data in outputs:
        path = Path(path)
        if path.exists():
            if path.read_bytes() != data: raise ValueError('Existing output differs: ' + str(path))
        elif check: raise FileNotFoundError(path)
    if not check:
        for path, data in outputs:
            path = Path(path)
            if path.exists(): continue
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open('xb') as stream: stream.write(data)
