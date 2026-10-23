"""Shared frozen Garen event graph traversal; callers select declared spell events."""
from pathlib import Path
import hashlib
import json
import struct
import subprocess
import sys
import xml.etree.ElementTree as ET

REVISION = '71654ed1a2c4642894bd7e7ed79eba66986fb770'
sys.path.insert(0, '.tools/wwiser')
from wwiser.wfnv import Fnv
sha = lambda b: hashlib.sha256(b).hexdigest()
def map_garen_audio(ability, expected_events):
    assert ability in ['aa', 'p', 'q', 'w', 'e', 'r']
    pin_path = Path('docs/reference/garen-audio-extraction.json')
    pin = json.loads(pin_path.read_text())
    subprocess.run([sys.executable, 'tools/assets/inspect-garen-audio.py'], check=True, stdout=subprocess.DEVNULL)
    root = ET.fromstring(b'<banks>' + Path('.cache/garen-audio-banks.xml').read_bytes() + b'</banks>')
    index = {}
    for obj in root.iter('object'):
        field = obj.find("field[@name='ulID']")
        if field is not None:
            identity = int(field.get('value'))
            assert identity not in index
            index[identity] = obj
    def number(node, name, default=None):
        field = node.find(f".//field[@name='{name}']")
        return default if field is None else int(field.get('value'))
    def parameters(node, path=''):
        for child in node:
            current = path + '/' + child.get('name', child.tag) + (':' + child.get('index') if child.get('index') is not None else '')
            if child.tag == 'field': yield [current, child.get('type'), child.get('value'), child.get('valuefmt')]
            yield from parameters(child, current)
    def descendants(identity):
        reached, queue = set(), [identity]
        while queue:
            current = queue.pop()
            if current in reached: continue
            reached.add(current)
            obj = index[current]
            assert obj.get('name') in ('CAkRanSeqCntr', 'CAkSound', 'CAkActorMixer', 'CAkLayerCntr', 'CAkSwitchCntr'), obj.get('name')
            queue.extend(int(f.get('value')) for f in obj.iter('field') if f.get('name') == 'ulChildID')
        return reached
    reference = Path('docs/reference/garen-model.json')
    skin = json.loads(reference.read_text())['skin']['data']['Characters/Garen/Skins/Skin0']
    unit = next(u for u in skin['skinAudioProperties']['bankUnits'] if u['name'] == 'Garen_Base_SFX')
    prefixes = ['_GarenRecouperate1_'] if ability == 'p' else [f'_Garen{ability.upper()}_'] + (['_GarenQAttack_'] if ability == 'q' else [])
    if ability == 'aa': prefixes = ['_GarenBasicAttack_', '_GarenBasicAttack2_', '_GarenCritAttack_']
    names = sorted(n for n in unit['events'] if any(prefix in n for prefix in prefixes))
    assert len(names) == expected_events
    events, selected, media_ids = [], set(), set()
    for name in names:
        identity = Fnv().get_hash(name)
        assert index[identity].get('name') == 'CAkEvent'
        selected.add(identity)
        actions = []
        for f in index[identity].iter('field'):
            if f.get('name') != 'ulActionID': continue
            action_id = int(f.get('value')); action = index[action_id]
            kind = action.get('name')
            assert kind in ('CAkActionPlay', 'CAkActionStop')
            assert name.startswith('Play_' if kind == 'CAkActionPlay' else 'Stop_')
            target = number(action, 'idExt'); nodes = descendants(target)
            affected = sorted({number(index[i], 'sourceID') for i in nodes if index[i].get('name') == 'CAkSound'})
            selected.update(nodes | {action_id})
            if kind == 'CAkActionPlay': media_ids.update(affected)
            actions.append(dict(id=action_id, type=kind, target=target, targetNodes=sorted(nodes), affectedMediaIds=affected))
        assert actions
        events.append(dict(name=name, id=identity, actions=actions))
    inherited, unresolved, queue = set(), set(), list(selected)
    while queue:
        obj = index[queue.pop()]
        dependencies = [number(obj, 'DirectParentID', 0), number(obj, 'OverrideBusId', 0)]
        for prop in obj.iter('object'):
            p = prop.find("field[@name='pID']")
            if p is not None and '[AttenuationID]' in p.get('valuefmt', ''): dependencies.append(number(prop, 'pValue', 0))
        for dep in dependencies:
            if not dep or dep in selected or dep in inherited: continue
            if dep not in index: unresolved.add(dep)
            else: inherited.add(dep); queue.append(dep)
    audio = next(s for s in pin['files'] if s['path'].endswith('_audio.bnk'))
    raw = (Path('.cache/garen-audio-sources') / audio['path']).read_bytes()
    chunks, offset = {}, 0
    while offset < len(raw):
        tag, size = struct.unpack_from('<4sI', raw, offset); start = offset + 8
        assert tag not in chunks and start + size <= len(raw)
        chunks[tag] = (start, size); offset = start + size
    assert offset == len(raw)
    start, length = chunks[b'DIDX']; assert length % 12 == 0
    entries = {i: (o, s) for i, o, s in struct.iter_unpack('<III', raw[start:start+length])}
    assert len(entries) == length // 12
    parsed = {number(o, 'id'): (number(o, 'uOffset'), number(o, 'uSize')) for o in root.iter('object') if o.get('name') == 'MediaHeader'}
    assert parsed == entries
    out = Path(f'.cache/garen-{ability}-audio-media'); out.mkdir(exist_ok=True)
    media = []
    for identity in sorted(media_ids):
        relative, length = entries[identity]; data_offset, data_size = chunks[b'DATA']
        assert relative + length <= data_size
        start = data_offset + relative; encoded = raw[start:start+length]
        assert encoded[:4] == b'RIFF' and encoded[8:12] == b'WAVE'
        assert struct.unpack_from('<I', encoded, 4)[0] + 8 == length
        (out / f'{identity}.wem').write_bytes(encoded)
        media.append(dict(id=identity, bankOffset=start, bytes=length, sha256=sha(encoded)))
    result = dict(extractionSha256=sha(pin_path.read_bytes()), referenceSha256=sha(reference.read_bytes()),
        parserRevision=REVISION, nameHash='Pinned wwiser lowercase UTF-8 FNV-1 uint32', events=events,
        nodes=[dict(id=i, type=index[i].get('name'), role='event-target' if i in selected else 'inherited', parameters=list(parameters(index[i]))) for i in sorted(selected | inherited)],
        media=media, unresolvedHierarchyIds=sorted(unresolved),
        status='Encoded source media and authored play/stop policy. Native event timing, bus mix and runtime playback remain separate.')
    Path(f'docs/reference/garen-{ability}-audio.json').write_text(json.dumps(result, indent=2) + '\n')
    return result
