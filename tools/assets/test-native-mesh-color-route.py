"""Guard the mesh primitive's exclusion from quads and separate float color transfer."""
from pathlib import Path
import json, runpy, struct, unittest
from unittest.mock import patch
import native_mesh_color_route as source


class MeshColorGuards(unittest.TestCase):
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
        self.assertEqual(len(result['functionSpans']), 5)
        self.assertEqual(len(result['selectedInstructions']), 110)
        self.assertEqual(result['primitive']['quadSlotBehavior'], 'RET only')
        self.assertEqual(result['quadExclusion']['excludedKinds'], [3, 7, 11, 16, 17])
        self.assertEqual(result['separateSelector']['maskSelectedKinds'], [3, 6, 11, 16, 17, 18])
        self.assertFalse(result['source']['quadBytePolicyApplicable'])
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
        for index, row in enumerate(source.SPANS):
            name, start, end, digest = row
            spans = list(source.SPANS)
            spans[index] = (name, start, end - 4, digest)
            with self.subTest(name=name), patch.object(source, 'SPANS', spans), self.assertRaisesRegex(ValueError, 'function bounds differ'):
                source.verify(self.image, self.core)

    def test_every_input_pin_is_mandatory(self):
        for name in source.PINS:
            with self.subTest(name=name), patch.object(source, 'PINS', {**source.PINS, name: '0' * 64}), self.assertRaises(ValueError):
                source.verify(self.image, self.core)

    def test_switch_cannot_route_mesh_to_plane(self):
        with self.assertRaises(ValueError):
            source.verify(self.changed_bytes(0x10213342e, bytes([6])), self.core)

    def test_quad_virtual_slot_cannot_select_a_real_quad_builder(self):
        for target in [0x1018d7f34, 0x1018d5924, 0x1018d9178]:
            with self.subTest(target=hex(target)), self.assertRaisesRegex(ValueError, 'RET stub'):
                source.verify(self.changed_bytes(0x102486208, struct.pack('<Q', target)), self.core)

    def test_factory_kind_allocation_and_result_stores_are_bound(self):
        for pc in [0x10189bb74, 0x10189bb78, 0x10189bb7c, 0x10189bb80, 0x10189bbc0, 0x10189bbc4, 0x10189bbc8, 0x10189bbcc]:
            with self.subTest(pc=hex(pc)), self.assertRaises(ValueError):
                source.verify(self.changed_word(pc, self.image.word(pc) ^ 1), self.core)
    def test_mesh_exclusion_and_selector_cannot_reverse(self):
        for pc in [0x1018decfc, 0x1018ded00, 0x1018ded08, 0x1018ded0c, 0x1018e1584, 0x1018e1590, 0x1018e1594, 0x1018e159c]:
            with self.subTest(pc=hex(pc)), self.assertRaises(ValueError):
                source.verify(self.changed_word(pc, self.image.word(pc) ^ 1), self.core)

    def test_float4_copy_and_input_pointer_cannot_drift(self):
        for pc in [0x1018df688, 0x1018df694, 0x1018df69c, 0x1018df6a0, 0x1018df6dc, 0x101953728, 0x10195373c, 0x101953740]:
            with self.subTest(pc=hex(pc)), self.assertRaises(ValueError):
                source.verify(self.changed_word(pc, self.image.word(pc) ^ 1), self.core)

    def test_draw_setter_and_premultiply_targets_are_bound(self):
        for pc in [0x1018e15ac, 0x1018df6e0, 0x1018df6b4]:
            with self.subTest(pc=hex(pc)), self.assertRaises(ValueError):
                source.verify(self.changed_word(pc, self.image.word(pc) ^ 1), self.core)

    def test_inherited_queue_dispatch_is_bound(self):
        with self.assertRaises(ValueError):
            source.verify(self.changed_word(0x1018def04, 0xd503201f), self.core)

    def test_original_source_bytes_cannot_change(self):
        pin, compiled, raw = self.fixture()
        with self.assertRaises(ValueError):
            source.source_rows(pin, compiled, raw[:-1])

    def test_profile_group_and_kind_cannot_drift(self):
        for field, value in [('sourceIndex', 3), ('kind', 'quad')]:
            pin, compiled, raw = self.fixture()
            compiled['profiles'][6][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                source.source_rows(pin, compiled, raw)

    def test_blend_cannot_silently_add_premultiplication(self):
        for blend in [0, 2, 4]:
            pin, compiled, raw = self.fixture()
            compiled['profiles'][6]['blend'] = blend
            with self.subTest(blend=blend), self.assertRaisesRegex(ValueError, 'mesh blend differs'):
                source.source_rows(pin, compiled, raw)


if __name__ == '__main__':
    unittest.main()
