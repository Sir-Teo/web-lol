"""Guard the bounded source-definition to native particle queue route witness."""
from pathlib import Path
import json, runpy, struct, unittest
from unittest.mock import patch
import native_particle_queue_routes as source


class QueueRouteGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.core = json.loads(source.witness.pinned(source.quad.ray.defaults.CORE, source.quad.ray.defaults.CORE_SHA256))
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

    def rejects_words(self, addresses):
        for pc in addresses:
            with self.subTest(pc=hex(pc)), self.assertRaises(ValueError):
                source.verify(self.changed_word(pc, self.image.word(pc) ^ 1), self.core)

    def test_exact_offline_replay(self):
        with patch('socket.socket', side_effect=AssertionError('Network forbidden')), patch('subprocess.Popen', side_effect=AssertionError('Child forbidden')):
            observed = source.observe()
        self.assertEqual(observed, json.loads(source.OUTPUT.read_bytes()))
        self.assertEqual(len(observed['functionSpans']), 8)
        self.assertEqual(len(observed['selectedInstructions']), 260)
        self.assertEqual([row['sourceField'] for row in observed['routes']], ['complexEmitterDefinitionData', 'simpleEmitterDefinitionData'])
        self.assertEqual([row['runtimeFactory']['systemPointer'] for row in observed['routes']], [48, 64])
        self.assertEqual([row['queue']['entryBytes'] for row in observed['routes']], [32, 8])
        self.assertFalse(observed['nativeExecuted'])
        self.assertFalse(observed['nativeShaderExecuted'])
        self.assertFalse(observed['applicationBehaviorChanged'])

    def test_every_complete_function_rejects_byte_changes(self):
        for name, start, end, digest in source.SPANS:
            with self.subTest(name=name), self.assertRaises(ValueError):
                source.verify(self.changed_bytes(start, bytes([self.image.at(start, 1)[0] ^ 1])), self.core)

    def test_every_selected_instruction_rejects_word_changes(self):
        self.rejects_words([pc for pc, word, reading in source.WORDS])

    def test_complete_bounds_cannot_shrink(self):
        spans = list(source.SPANS)
        name, start, end, digest = spans[0]
        spans[0] = (name, start, end - 4, digest)
        with patch.object(source, 'SPANS', spans), self.assertRaisesRegex(ValueError, 'function bounds differ'):
            source.verify(self.image, self.core)

    def test_parent_quad_pin_is_mandatory(self):
        with patch.object(source, 'QUAD_SHA256', '0' * 64), self.assertRaises(ValueError):
            source.verify(self.image, self.core)

    def test_both_source_name_hashes_are_bound(self):
        self.rejects_words([0x101896c94, 0x101896c98, 0x101896cb0, 0x101896cb4])

    def test_complex_and_simple_source_offsets_cannot_swap(self):
        for a, b in [(0x101896c9c, 0x101896cb8), (0x101896cb8, 0x101896c9c)]:
            with self.subTest(pc=hex(a)), self.assertRaises(ValueError):
                source.verify(self.changed_word(a, self.image.word(b)), self.core)

    def test_runtime_allocations_and_constructor_targets_are_bound(self):
        self.rejects_words([0x1018fdb78, 0x1018fdb8c, 0x1018fdfb8, 0x1018fdfcc])

    def test_distinct_runtime_pointer_and_float_initializers_are_bound(self):
        self.rejects_words([0x1018f4f34, 0x101905310])

    def test_runtime_list_insertions_are_bound(self):
        self.rejects_words([0x1018fdc80, 0x1018fdc8c, 0x1018fe0b8, 0x1018fe0c4])

    def test_queue_insertions_and_entry_strides_are_bound(self):
        self.rejects_words([0x1018e7d80, 0x1018e7d8c, 0x1018e830c, 0x101916500])

    def test_every_dispatch_call_is_bound(self):
        self.rejects_words([pc for pc, target in source.CALLS])

    def test_job_vptr_and_virtual_call_are_bound(self):
        self.rejects_words([0x1018e73a4, 0x1018e8868, 0x1018e8870])

    def test_job_slot_cannot_point_at_another_consumer(self):
        with self.assertRaisesRegex(ValueError, 'virtual target differs'):
            source.verify(self.changed_bytes(0x102486828, struct.pack('<Q', 0x1018f1bc4)), self.core)

    def test_inherited_legacy_and_optimized_packers_remain_bound(self):
        self.rejects_words([0x1018d805c, 0x1018f1924, 0x1018f21c8])


if __name__ == '__main__':
    unittest.main()
