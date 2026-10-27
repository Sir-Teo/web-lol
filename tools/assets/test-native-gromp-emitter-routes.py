"""Guard Gromp's explicit Simple flash and seven default Complex source groups."""
from pathlib import Path
import copy, json, runpy, struct, unittest
from unittest.mock import patch
import native_gromp_emitter_routes as source


class GrompRouteGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.core = json.loads(source.witness.pinned(source.queues.quad.ray.defaults.CORE, source.queues.quad.ray.defaults.CORE_SHA256))
        raw = source.witness.restored.checked(Path(cls.core['native']['path']).read_bytes(), cls.core['native'])
        cls.data, cls.sections = runpy.run_path(str(source.witness.PARSER))['arm64_sections'](raw, cls.core['native']['architecture'])
        cls.image = source.witness.Image(cls.data, cls.sections)

    def fixture(self):
        return (json.loads(source.legacy.GROMP.read_bytes()),
                json.loads(Path('src/content/gromp-death.json').read_bytes()),
                source.colors.SOURCE_PATH.read_bytes())

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

    def test_exact_offline_replay(self):
        with patch('socket.socket', side_effect=AssertionError('Network forbidden')), patch('subprocess.Popen', side_effect=AssertionError('Child forbidden')):
            result = source.observe()
        self.assertEqual(result, json.loads(source.OUTPUT.read_bytes()))
        self.assertEqual(len(result['functionSpans']), 3)
        self.assertEqual(len(result['selectedInstructions']), 112)
        self.assertEqual(result['source']['simpleProfiles'], [0])
        self.assertEqual(result['source']['complexProfiles'], list(range(1, 8)))
        self.assertEqual(result['source']['complexCameraQuadProfiles'], [1, 2, 3])
        self.assertEqual([r['group'] for r in result['source']['profiles']], [1, 2, 5, 3, 4, 6, 7, 8])
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
        spans = list(source.SPANS)
        name, start, end, digest = spans[0]
        spans[0] = (name, start, end - 4, digest)
        with patch.object(source, 'SPANS', spans), self.assertRaisesRegex(ValueError, 'function bounds differ'):
            source.verify(self.image, self.core)

    def test_each_parent_pin_is_mandatory(self):
        for name in source.PINS:
            pins = {**source.PINS, name: '0' * 64}
            with self.subTest(name=name), patch.object(source, 'PINS', pins), self.assertRaises(ValueError):
                source.verify(self.image, self.core)

    def test_group_type_and_default_literals_are_bound(self):
        for address, value in source.LITERALS:
            with self.subTest(value=value), self.assertRaises(ValueError):
                source.verify(self.changed_bytes(address, b'X'), self.core)

    def test_simple_branch_cannot_reverse(self):
        with self.assertRaises(ValueError):
            source.verify(self.changed_word(0x101899bcc, self.image.word(0x101899bcc) | 0x01000000), self.core)

    def test_cameraquad_virtual_method_cannot_select_ray(self):
        with self.assertRaises(ValueError):
            source.verify(self.changed_bytes(0x102481ef8 + 40, struct.pack('<Q', 0x1018d9178)), self.core)

    def test_original_source_bytes_cannot_change(self):
        pin, compiled, raw = self.fixture()
        for altered in [raw[:-1], bytes([raw[0] ^ 1]) + raw[1:]]:
            with self.subTest(bytes=len(altered)), self.assertRaises(ValueError):
                source.source_rows(pin, compiled, altered)

    def test_explicit_simple_declaration_cannot_disappear(self):
        pin, compiled, raw = self.fixture()
        record = pin['records'][source.colors.SOURCE_NAME]
        key = source.colors.modulation.source_key('System', 'GroupPart1Type')
        record['typed']['rows'] = [r for r in record['typed']['rows'] if r['hash'] != key]
        del record['decoded']['values']['System']['GroupPart1Type']
        with self.assertRaises(ValueError):
            source.source_rows(pin, compiled, raw)

    def test_omitted_type_keys_cannot_gain_a_simple_override(self):
        for group in range(2, 9):
            pin, compiled, raw = self.fixture()
            record = pin['records'][source.colors.SOURCE_NAME]
            key = source.colors.modulation.source_key('System', f'GroupPart{group}Type')
            record['typed']['rows'].append({'hash': key, 'storage': 'string', 'raw': 'Simple', 'value': 'Simple'})
            with self.subTest(group=group), self.assertRaises(ValueError):
                source.source_rows(pin, compiled, raw)

    def test_group_and_profile_indices_cannot_be_confused(self):
        pin, compiled, raw = self.fixture()
        compiled['profiles'][2]['sourceIndex'] = 2
        with self.assertRaises(ValueError):
            source.source_rows(pin, compiled, raw)

    def test_profile_order_is_not_group_order(self):
        pin, compiled, raw = self.fixture()
        compiled['profiles'][2], compiled['profiles'][3] = compiled['profiles'][3], compiled['profiles'][2]
        with self.assertRaises(ValueError):
            source.source_rows(pin, compiled, raw)

    def test_compiled_primitive_kind_cannot_expand_cameraquad_scope(self):
        for index in [0, 1, 2, 3, 4, 6]:
            pin, compiled, raw = self.fixture()
            compiled['profiles'][index]['kind'] = 'billboard' if index in [4, 6] else 'quad'
            with self.subTest(index=index), self.assertRaises(ValueError):
                source.source_rows(pin, compiled, raw)

    def test_decoded_type_case_cannot_drift_from_original(self):
        pin, compiled, raw = self.fixture()
        pin['records'][source.colors.SOURCE_NAME]['decoded']['values']['System']['GroupPart1Type'] = 'simple'
        with self.assertRaises(ValueError):
            source.source_rows(pin, compiled, raw)


if __name__ == '__main__':
    unittest.main()
