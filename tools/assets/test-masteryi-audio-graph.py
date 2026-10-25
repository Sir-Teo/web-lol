"""Offline graph, media-boundary and immutable-output tests, including python -O."""
from pathlib import Path
import copy
import json
import struct
import tempfile
import unittest
import xml.etree.ElementTree as ET
from masteryi_audio_graph import chunks, event_hash, project, write_outputs


def field(node, name, value, kind='u32', valuefmt=None):
    attrs = {'name': name, 'type': kind, 'value': str(value)}
    if valuefmt is not None: attrs['valuefmt'] = valuefmt
    ET.SubElement(node, 'field', attrs)


def node(root, kind, identity, **fields):
    out = ET.SubElement(root, 'object', {'name': kind})
    field(out, 'ulID', identity)
    for key, value in fields.items(): field(out, key, value)
    return out


def fixture():
    root = ET.Element('banks')
    names = ['Play_sfx_MasterYi_Test', 'Stop_sfx_MasterYi_Test']
    node(root, 'CAkEvent', event_hash(names[0]), ulActionID=2)
    node(root, 'CAkEvent', event_hash(names[1]), ulActionID=7)
    node(root, 'CAkActionPlay', 2, idExt=3)
    node(root, 'CAkActionStop', 7, idExt=3)
    switch = node(root, 'CAkSwitchCntr', 3, DirectParentID=6, ulSwitchGroupID=77, ulDefaultSwitch=88)
    field(switch, 'ulChildID', 4); field(switch, 'ulChildID', 5)
    node(root, 'CAkSound', 4, sourceID=101)
    node(root, 'CAkSound', 5, sourceID=102)
    node(root, 'CAkActorMixer', 6, OverrideBusId=999)
    a = b'RIFF' + struct.pack('<I', 4) + b'WAVE'
    b = a
    rows = [(101, 0, len(a)), (102, len(a), len(b))]
    for identity, offset, size in rows:
        header = ET.SubElement(root, 'object', {'name': 'MediaHeader'})
        field(header, 'id', identity); field(header, 'uOffset', offset); field(header, 'uSize', size)
    didx = b''.join(struct.pack('<III', *row) for row in rows)
    audio = b'DIDX' + struct.pack('<I', len(didx)) + didx + b'DATA' + struct.pack('<I', len(a + b)) + a + b
    return root, {'events': names}, audio


class GraphGuards(unittest.TestCase):
    def test_hash_uses_lowercase_fnv1_not_fnv1a(self):
        self.assertEqual(event_hash('hello'), 0xb6fa7167)
        self.assertEqual(event_hash('HELLO'), 0xb6fa7167)

    def test_switch_stop_and_parent_are_preserved_without_flattening(self):
        root, unit, audio = fixture()
        graph, media = project(root, unit, audio)
        self.assertEqual(graph['events'][0]['actions'][0]['targetNodes'], [3, 4, 5])
        self.assertEqual(graph['events'][1]['actions'][0]['type'], 'CAkActionStop')
        switch = next(n for n in graph['nodes'] if n['id'] == 3)
        self.assertEqual(switch['type'], 'CAkSwitchCntr')
        self.assertTrue(any(f[0] == '/ulSwitchGroupID' and f[2] == '77' for f in switch['parameters']))
        self.assertEqual(next(n for n in graph['nodes'] if n['id'] == 6)['role'], 'inherited')
        self.assertEqual(graph['unresolvedHierarchyIds'], [999])
        self.assertEqual(set(media), {101, 102})

    def test_missing_declared_event(self):
        root, unit, audio = fixture(); unit['events'].append('missing')
        with self.assertRaisesRegex(ValueError, 'Missing declared event'): project(root, unit, audio)

    def test_unsupported_action(self):
        root, unit, audio = fixture()
        next(n for n in root if n.get('name') == 'CAkActionPlay').set('name', 'CAkActionSetVolume')
        with self.assertRaisesRegex(ValueError, 'unsupported action'): project(root, unit, audio)

    def test_missing_selected_child(self):
        root, unit, audio = fixture()
        root.remove(next(n for n in root if n.find("field[@name='ulID'][@value='5']") is not None))
        with self.assertRaisesRegex(ValueError, 'hierarchy node'): project(root, unit, audio)

    def test_duplicate_hierarchy(self):
        root, unit, audio = fixture(); root.append(copy.deepcopy(root[0]))
        with self.assertRaisesRegex(ValueError, 'Duplicate hierarchy'): project(root, unit, audio)

    def test_media_table_mismatch(self):
        root, unit, audio = fixture()
        next(root.iterfind("object[@name='MediaHeader']/field[@name='uSize']")).set('value', '99')
        with self.assertRaisesRegex(ValueError, 'DIDX'): project(root, unit, audio)

    def test_duplicate_didx_identity(self):
        root, unit, audio = fixture(); raw = bytearray(audio)
        struct.pack_into('<I', raw, 20, 101)
        with self.assertRaisesRegex(ValueError, 'Duplicate DIDX'): project(root, unit, bytes(raw))

    def test_media_outside_data_even_when_parser_agrees(self):
        root, unit, audio = fixture(); raw = bytearray(audio)
        struct.pack_into('<I', raw, 12, 999)
        next(root.iterfind("object[@name='MediaHeader']/field[@name='uOffset']")).set('value', '999')
        with self.assertRaisesRegex(ValueError, 'outside bank DATA'): project(root, unit, bytes(raw))

    def test_source_id_missing_from_embedded_bank(self):
        root, unit, audio = fixture()
        next(root.iterfind("object[@name='CAkSound']/field[@name='sourceID']")).set('value', '103')
        with self.assertRaisesRegex(ValueError, 'not embedded'): project(root, unit, audio)

    def test_riff_extent_mismatch(self):
        root, unit, audio = fixture(); raw = bytearray(audio)
        start, _ = chunks(audio)[b'DATA']; struct.pack_into('<I', raw, start + 4, 5)
        with self.assertRaisesRegex(ValueError, 'RIFF/WAVE extent'): project(root, unit, bytes(raw))

    def test_truncated_chunk_header(self):
        with self.assertRaisesRegex(ValueError, 'header'): chunks(b'RIFF')

    def test_chunk_extent_overrun(self):
        with self.assertRaisesRegex(ValueError, 'extent'): chunks(b'DATA' + struct.pack('<I', 50) + b'x')

    def test_duplicate_bank_chunk(self):
        empty = b'DATA' + struct.pack('<I', 0)
        with self.assertRaisesRegex(ValueError, 'duplicate'): chunks(empty + empty)

    def test_conflict_preflight_writes_nothing(self):
        with tempfile.TemporaryDirectory() as tmp:
            fresh = Path(tmp) / 'fresh'; existing = Path(tmp) / 'old'
            existing.write_bytes(b'old')
            with self.assertRaisesRegex(ValueError, 'differs'): write_outputs([(fresh, b'new'), (existing, b'new')])
            self.assertFalse(fresh.exists()); self.assertEqual(existing.read_bytes(), b'old')

    def test_check_never_creates_a_missing_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'missing'
            with self.assertRaises(FileNotFoundError): write_outputs([(path, b'data')], check=True)
            self.assertFalse(path.exists())

    def test_repeated_exact_outputs_remain_untouched(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'output'; write_outputs([(path, b'data')])
            before = path.stat().st_mtime_ns
            write_outputs([(path, b'data')], check=True); write_outputs([(path, b'data')])
            self.assertEqual(path.stat().st_mtime_ns, before)
            self.assertEqual(path.read_bytes(), b'data')

    def test_frozen_graph_keeps_declared_multilayer_and_stop_actions(self):
        graph = json.loads(Path('docs/reference/masteryi/audio-graph.json').read_text())
        events = {e['name']: e for e in graph['events']}
        self.assertEqual(len(events['Play_sfx_MasterYi_AlphaStrike_missilecast']['actions']), 2)
        self.assertEqual(len(events['Play_sfx_MasterYi_MasterYiDoubleStrike_OnHit']['actions']), 2)
        self.assertTrue(all(a['type'] == 'CAkActionStop' for a in events['Stop_sfx_MasterYi_Meditate_OnBuffActivate']['actions']))
        self.assertEqual(len(graph['media']), 69)


if __name__ == '__main__': unittest.main()
