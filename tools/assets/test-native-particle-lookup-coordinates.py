"""Guard the lookup field/default/producer/conditional-consumer linkage."""
from pathlib import Path
import json, runpy, struct, unittest
from unittest.mock import patch
import native_particle_lookup_coordinates as source


class LookupCoordinateGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        defaults = source.quad.ray.defaults
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

    def test_exact_offline_replay(self):
        with patch('socket.socket', side_effect=AssertionError('Network forbidden')), patch('subprocess.Popen', side_effect=AssertionError('Child forbidden')):
            result = source.observe()
        self.assertEqual(result, json.loads(source.OUTPUT.read_bytes()))
        self.assertEqual(len(result['functionSpans']), 7)
        self.assertEqual(sum(r['bytes'] for r in result['functionSpans']), 11596)
        self.assertEqual(len(result['selectedInstructions']), 253)
        self.assertEqual([r['definitionOffset'] for r in result['fieldRegistrations']], [204,205,208,216])
        self.assertEqual(result['constructorDefaults']['types'], [1,0])
        self.assertEqual(result['constructorDefaults']['scales'], [1,1])
        self.assertEqual(result['constructorDefaults']['offsets'], [0,0])
        self.assertFalse(result['nativeExecuted'])
        self.assertFalse(result['applicationBehaviorChanged'])

    def test_each_complete_function_is_bound(self):
        for name,start,end,digest in source.SPANS:
            with self.subTest(name=name), self.assertRaises(ValueError):
                source.verify(self.changed_bytes(start, bytes([self.image.at(start,1)[0]^1])), self.core)

    def test_each_selected_instruction_is_bound(self):
        for pc,word,reading in source.WORDS:
            with self.subTest(reading=reading), self.assertRaises(ValueError):
                source.verify(self.changed_word(pc,word^1), self.core)

    def test_complete_function_bounds_cannot_shrink(self):
        for index,row in enumerate(source.SPANS):
            name,start,end,digest=row;rows=list(source.SPANS);rows[index]=(name,start,end-4,digest)
            with self.subTest(name=name), patch.object(source,'SPANS',rows), self.assertRaisesRegex(ValueError,'function bounds differ'):
                source.verify(self.image,self.core)

    def test_every_parent_pin_is_mandatory(self):
        for name in source.PINS:
            with self.subTest(name=name), patch.object(source,'PINS',{**source.PINS,name:'0'*64}), self.assertRaises(ValueError):
                source.verify(self.image,self.core)

    def test_constructor_literal_contents_are_bound(self):
        for offset in [0,4,8,12]:
            with self.subTest(offset=offset), self.assertRaisesRegex(ValueError,'default vector differs'):
                source.verify(self.changed_bytes(0x10210d7c0+offset,struct.pack('<f',0.5)),self.core)

    def test_literal_load_decodes_its_actual_address(self):
        self.assertEqual(source.default_vector_address(self.image),0x10210d7c0)
        for pc in [0x1018ac92c,0x1018ac930]:
            with self.subTest(pc=hex(pc)), self.assertRaises(ValueError):
                source.default_vector_address(self.changed_word(pc,0xd503201f))
    def test_field_candidates_cannot_be_renamed(self):
        for index,row in enumerate(source.FIELDS):
            name,pc,offset,wrapper,tag=row;rows=list(source.FIELDS);rows[index]=('differentLookupField',pc,offset,wrapper,tag)
            with self.subTest(name=name), patch.object(source,'FIELDS',rows), self.assertRaises(ValueError):
                source.verify(self.image,self.core)

    def test_field_offsets_and_descriptor_tags_are_bound(self):
        for pc in [0x1018ab678,0x1018ab694,0x1018ab6b0,0x1018ab6e8,0x1018ac3e0,0x100366394]:
            with self.subTest(pc=hex(pc)), self.assertRaises(ValueError):
                source.verify(self.changed_word(pc,self.image.word(pc)^1),self.core)

    def test_constructor_type_bytes_cannot_reverse(self):
        for pc in [0x1018ac924,0x1018ac928]:
            with self.subTest(pc=hex(pc)), self.assertRaises(ValueError):
                source.verify(self.changed_word(pc,self.image.word(pc)^1),self.core)

    def test_mode_drives_fma_and_draw_stores_are_bound(self):
        for pc in [0x1018fbda4,0x1018fbda8,0x1018fc498,0x1018fc4a8,0x1018fc4d4,0x1018fc4dc,0x1018fc604,0x1018fc608,0x1018fc614]:
            with self.subTest(pc=hex(pc)), self.assertRaises(ValueError):
                source.verify(self.changed_word(pc,self.image.word(pc)^1),self.core)

    def test_vector_norm_arithmetic_is_bound(self):
        for pc in [0x1018fc5d0,0x1018fc5d4,0x1018fc5d8,0x1018fc5dc,0x1018fc5e0]:
            with self.subTest(pc=hex(pc)), self.assertRaises(ValueError):
                source.verify(self.changed_word(pc,self.image.word(pc)^1),self.core)

    def test_quad_uv_selector_zero_affine_and_half_outputs_are_bound(self):
        for pc in [0x1018d83d0,0x1018d83f4,0x1018d83f8,0x1018d83fc,0x1018d8158,0x1018d8160,0x1018d8204,0x1018d820c]:
            with self.subTest(pc=hex(pc)), self.assertRaises(ValueError):
                source.verify(self.changed_word(pc,self.image.word(pc)^1),self.core)

    def test_plane_uv_selector_zero_affine_and_half_outputs_are_bound(self):
        for pc in [0x1018d5d8c,0x1018d5db0,0x1018d5db4,0x1018d5db8,0x1018d5b20,0x1018d5b28,0x1018d5bcc,0x1018d5bd4]:
            with self.subTest(pc=hex(pc)), self.assertRaises(ValueError):
                source.verify(self.changed_word(pc,self.image.word(pc)^1),self.core)

    def test_white_fallback_semantics_cannot_silently_change(self):
        original=source.witness.pinned
        def changed(path,digest):
            raw=original(path,digest)
            if str(path)=='docs/reference/legacy-particle-default-textures.json':
                record=json.loads(raw);record['resources'][0]['mips'][0]['nonwhiteTexels']=1
                return json.dumps(record).encode()
            return raw
        with patch.object(source.witness,'pinned',changed), self.assertRaisesRegex(ValueError,'Opaque white fallback record differs'):
            source.observe()

    def test_inherited_primitive_dispatch_is_bound(self):
        with self.assertRaises(ValueError):
            source.verify(self.changed_word(0x1018def04,0xd503201f),self.core)


    def test_inline_packet_selection_cannot_reverse_or_change_helpers(self):
        for pc in [0x1018d86f0,0x1018d86f4,0x1018d8718,0x1018d5f14,0x1018d5f18,0x1018d5f3c]:
            with self.subTest(pc=hex(pc)), self.assertRaises(ValueError):
                source.verify(self.changed_word(pc,self.image.word(pc)^1),self.core)

if __name__=='__main__':unittest.main()
