"""Guard the p-type1 plane's exact factory, virtual dispatch and color packet route."""
from pathlib import Path
import json, runpy, struct, unittest
from unittest.mock import patch
import native_plane_color_packets as source


class PlaneColorGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        defaults = source.routes.queues.quad.ray.defaults
        cls.core = json.loads(source.witness.pinned(defaults.CORE, defaults.CORE_SHA256))
        raw = source.witness.restored.checked(Path(cls.core['native']['path']).read_bytes(), cls.core['native'])
        cls.data, cls.sections = runpy.run_path(str(source.witness.PARSER))['arm64_sections'](raw, cls.core['native']['architecture'])
        cls.image = source.witness.Image(cls.data, cls.sections)

    def changed_word(self, pc, word):
        class Changed(source.witness.Image):
            def word(self, address):
                return word if source.witness.number(address) == pc else super().word(address)
        return Changed(self.data, self.sections)

    def changed_bytes(self, address, raw):
        section = next(s for s in self.sections if s['address'] <= address and address + len(raw) <= s['address'] + s['bytes'])
        offset = section['offset'] + address - section['address']
        data = bytearray(self.data)
        data[offset:offset + len(raw)] = raw
        return source.witness.Image(data, self.sections)

    def fixture(self):
        return (json.loads(source.routes.legacy.GROMP.read_bytes()),
                json.loads(Path('src/content/gromp-death.json').read_bytes()),
                source.routes.colors.SOURCE_PATH.read_bytes())

    def test_exact_offline_replay(self):
        with patch('socket.socket', side_effect=AssertionError('Network forbidden')), patch('subprocess.Popen', side_effect=AssertionError('Child forbidden')):
            result = source.observe()
        self.assertEqual(result, json.loads(source.OUTPUT.read_bytes()))
        self.assertEqual(len(result['functionSpans']), 1)
        self.assertEqual(len(result['selectedInstructions']), 62)
        self.assertEqual(result['primitive']['virtualMethod'], '0x1018d5924')
        self.assertEqual(result['firstLayoutFormats'], [30, 9, 27, 25])
        self.assertFalse(result['nativeExecuted'])
        self.assertFalse(result['applicationBehaviorChanged'])

    def test_every_complete_function_is_bound(self):
        for name, start, end, digest in source.SPANS:
            with self.subTest(name=name), self.assertRaises(ValueError):
                source.verify(self.changed_bytes(start, bytes([self.image.at(start, 1)[0] ^ 1])), self.core)

    def test_every_selected_instruction_is_bound(self):
        for pc, word, reading in source.WORDS:
            with self.subTest(reading=reading), self.assertRaises(ValueError):
                source.verify(self.changed_word(pc, word ^ 1), self.core)

    def test_complete_bounds_cannot_shrink(self):
        name, start, end, digest = source.SPANS[0]
        with patch.object(source, 'SPANS', [(name, start, end - 4, digest)]), self.assertRaisesRegex(ValueError, 'Plane function bounds differ'):
            source.verify(self.image, self.core)

    def test_every_input_pin_is_mandatory(self):
        for name in source.PINS:
            with self.subTest(name=name), patch.object(source, 'PINS', {**source.PINS, name: '0' * 64}), self.assertRaises(ValueError):
                source.verify(self.image, self.core)

    def test_switch_cannot_route_plane_to_ray(self):
        with self.assertRaises(ValueError):
            source.verify(self.changed_bytes(0x10213342c, bytes([0x11])), self.core)

    def test_plane_virtual_slot_cannot_select_cameraquad_or_ray(self):
        for target in [0x1018d7f34, 0x1018d9178]:
            with self.subTest(target=hex(target)), self.assertRaisesRegex(ValueError, 'Plane virtual builder differs'):
                source.verify(self.changed_bytes(0x102481c38, struct.pack('<Q', target)), self.core)

    def test_kind_allocation_vptr_and_result_stores_are_bound(self):
        for pc in range(0x10189bb2c, 0x10189bb4c, 4):
            with self.subTest(pc=hex(pc)), self.assertRaises(ValueError):
                source.verify(self.changed_word(pc, self.image.word(pc) ^ 1), self.core)

    def test_helper_call_cannot_select_a_rounded_packet(self):
        with self.assertRaises(ValueError):
            source.verify(self.changed_word(0x1018d5a30, self.image.word(0x1018d5a30) + 1), self.core)

    def test_premultiply_branch_cannot_reverse(self):
        with self.assertRaises(ValueError):
            source.verify(self.changed_word(0x1018d5cf8, self.image.word(0x1018d5cf8) ^ 1), self.core)

    def test_inherited_queue_dispatch_is_bound(self):
        with self.assertRaises(ValueError):
            source.verify(self.changed_word(0x1018def04, 0xd503201f), self.core)

    def test_original_source_bytes_cannot_change(self):
        pin, compiled, raw = self.fixture()
        with self.assertRaises(ValueError):
            source.source_rows(pin, compiled, raw[:-1])

    def test_profile_group_and_kind_cannot_drift(self):
        for field, value in [('sourceIndex', 2), ('kind', 'billboard')]:
            pin, compiled, raw = self.fixture()
            compiled['profiles'][4][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                source.source_rows(pin, compiled, raw)

    def test_blend_cannot_silently_add_premultiplication(self):
        for blend in [0, 2, 4]:
            pin, compiled, raw = self.fixture()
            compiled['profiles'][4]['blend'] = blend
            with self.subTest(blend=blend), self.assertRaisesRegex(ValueError, 'plane blend differs'):
                source.source_rows(pin, compiled, raw)

    def test_plane_cannot_gain_simple_override(self):
        pin, compiled, raw = self.fixture()
        key = source.routes.colors.modulation.source_key('System', 'GroupPart4Type')
        pin['records'][source.routes.colors.SOURCE_NAME]['typed']['rows'].append(
            {'hash': key, 'storage': 'string', 'raw': 'Simple', 'value': 'Simple'})
        with self.assertRaises(ValueError):
            source.source_rows(pin, compiled, raw)


if __name__ == '__main__':
    unittest.main()
