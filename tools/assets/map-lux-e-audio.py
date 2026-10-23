"""Map every pinned Skin0 Lucent Singularity audio event, including stop actions.

The Illumination mapper verifies/reparses the same source banks and exposes its
checked object index and DIDX boundaries. No WEM decoding or runtime dispatch.
"""
from pathlib import Path
import json
import runpy
import struct

bank = runpy.run_path('tools/assets/map-lux-illumination-audio.py')
index, number = bank['index'], bank['number']
sha, parameters = bank['sha'], bank['parameters']
reference = Path('docs/reference/lux-model.json')
skin = json.loads(reference.read_text())['skin']['data']['Characters/Lux/Skins/Skin0']
unit = next(u for u in skin['skinAudioProperties']['bankUnits'] if u['name'] == 'Lux_Base_SFX')
names = sorted(n for n in unit['events'] if 'LuxLightStrikeKugel' in n)
assert len(names) == 5 and len(set(names)) == 5


def descendants(identity):
    reached, queue = set(), [identity]
    while queue:
        current = queue.pop()
        if current in reached:
            continue
        reached.add(current)
        obj = index[current]
        assert obj.get('name') in ('CAkRanSeqCntr', 'CAkSound')
        queue.extend(int(f.get('value')) for f in obj.iter('field') if f.get('name') == 'ulChildID')
    return reached


events, selected, media_ids = [], set(), set()
for name in names:
    identity = bank['Fnv']().get_hash(name)
    event = index[identity]
    assert event.get('name') == 'CAkEvent'
    selected.add(identity)
    actions = []
    for field in event.iter('field'):
        if field.get('name') != 'ulActionID':
            continue
        action_id = int(field.get('value'))
        action = index[action_id]
        kind = action.get('name')
        assert kind in ('CAkActionPlay', 'CAkActionStop')
        assert name.startswith('Play_' if kind == 'CAkActionPlay' else 'Stop_')
        target = number(action, 'idExt')
        nodes = descendants(target)
        affected = sorted({number(index[i], 'sourceID') for i in nodes if index[i].get('name') == 'CAkSound'})
        selected.update(nodes | {action_id})
        if kind == 'CAkActionPlay':
            media_ids.update(affected)
        actions.append(dict(id=action_id, type=kind, target=target,
                            targetNodes=sorted(nodes), affectedMediaIds=affected))
    assert actions
    events.append(dict(name=name, id=identity, actions=actions))

inherited, unresolved, queue = set(), set(), list(selected)
while queue:
    obj = index[queue.pop()]
    dependencies = [number(obj, 'DirectParentID', 0), number(obj, 'OverrideBusId', 0)]
    for prop in obj.iter('object'):
        pid = prop.find("field[@name='pID']")
        if pid is not None and '[AttenuationID]' in pid.get('valuefmt', ''):
            dependencies.append(number(prop, 'pValue', 0))
    for dep in dependencies:
        if not dep or dep in selected or dep in inherited:
            continue
        if dep not in index:
            unresolved.add(dep)
        else:
            inherited.add(dep)
            queue.append(dep)

out = Path('.cache/lux-e-audio-media')
out.mkdir(parents=True, exist_ok=True)
media = []
for identity in sorted(media_ids):
    relative, length = bank['entries'][identity]
    data_offset, data_size = bank['chunks'][b'DATA']
    assert relative + length <= data_size
    start = data_offset + relative
    encoded = bank['raw'][start:start + length]
    assert encoded[:4] == b'RIFF' and encoded[8:12] == b'WAVE'
    assert struct.unpack_from('<I', encoded, 4)[0] + 8 == length
    (out / f'{identity}.wem').write_bytes(encoded)
    media.append(dict(id=identity, bankOffset=start, bytes=length, sha256=sha(encoded)))

result = dict(extractionSha256=sha(bank['pin_path'].read_bytes()),
              referenceSha256=sha(reference.read_bytes()), parserRevision=bank['REVISION'],
              nameHash='Pinned wwiser lowercase UTF-8 FNV-1 uint32',
              events=events,
              nodes=[dict(id=i, type=index[i].get('name'),
                          role='event-target' if i in selected else 'inherited',
                          parameters=list(parameters(index[i]))) for i in sorted(selected | inherited)],
              media=media, unresolvedHierarchyIds=sorted(unresolved),
              status='Encoded source media only. Stop actions identify affected media, never playback. Native dispatch timing, decoding, mixing and listening remain unverified.')
Path('docs/reference/lux-e-audio.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(dict(events=len(events), nodes=len(result['nodes']), media=len(media),
                      mediaBytes=sum(m['bytes'] for m in media), unresolvedHierarchyIds=sorted(unresolved))))
