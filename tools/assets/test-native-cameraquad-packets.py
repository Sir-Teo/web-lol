"""Guard CameraQuad dispatch and its distinct legacy/optimized packet routes."""
from pathlib import Path
import json,runpy,struct,unittest
from unittest.mock import patch
import native_cameraquad_packets as source

class CameraQuadGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.core=json.loads(source.witness.pinned(source.ray.defaults.CORE,source.ray.defaults.CORE_SHA256));raw=source.witness.restored.checked(Path(cls.core['native']['path']).read_bytes(),cls.core['native'])
  cls.data,cls.sections=runpy.run_path(str(source.witness.PARSER))['arm64_sections'](raw,cls.core['native']['architecture']);cls.image=source.witness.Image(cls.data,cls.sections)
 def changed_word(self,pc,word):
  class Changed(source.witness.Image):
   def word(self,address):return word if source.witness.number(address)==pc else super().word(address)
  return Changed(self.data,self.sections)
 def changed_bytes(self,address,raw):
  section=next(s for s in self.sections if s['address']<=address and address+len(raw)<=s['address']+s['bytes']);offset=section['offset']+address-section['address'];data=bytearray(self.data);data[offset:offset+len(raw)]=raw;return source.witness.Image(data,self.sections)
 def test_exact_offline_replay(self):
  with patch('socket.socket',side_effect=AssertionError('Network forbidden')),patch('subprocess.Popen',side_effect=AssertionError('Child forbidden')):observed=source.observe()
  self.assertEqual(observed,json.loads(source.OUTPUT.read_bytes()));self.assertEqual(len(observed['functionSpans']),8);self.assertEqual(len(observed['selectedInstructions']),90);self.assertEqual(observed['firstLayoutFormats'],[30,9,27,25]);self.assertFalse(observed['nativeExecuted']);self.assertFalse(observed['applicationBehaviorChanged'])
 def test_each_complete_function_rejects_changed_bytes(self):
  for name,start,end,digest in source.SPANS:
   with self.subTest(name=name),self.assertRaises(ValueError):source.verify(self.changed_bytes(start,bytes([self.image.at(start,1)[0]^1])),self.core)
 def test_each_selected_instruction_rejects_changed_words(self):
  for pc,word,reading in source.WORDS:
   with self.subTest(reading=reading),self.assertRaises(ValueError):source.verify(self.changed_word(pc,word^1),self.core)
 def test_function_bounds_cannot_shrink(self):
  rows=list(source.SPANS);name,start,end,digest=rows[3];rows[3]=(name,start,end-4,digest)
  with patch.object(source,'SPANS',rows),self.assertRaisesRegex(ValueError,'function bounds differ'):source.verify(self.image,self.core)
 def test_all_constructor_vptrs_are_guarded(self):
  for pc in [0x10193aaf4,0x10193ab28,0x1018ac8ac]:
   with self.subTest(pc=hex(pc)),self.assertRaises(ValueError):source.verify(self.changed_word(pc,self.image.word(pc)+(1<<10)),self.core)
 def test_constructor_kind_must_stay_zero(self):
  for pc in [0x10193aaec,0x10193ab20,0x1018ac8a4]:
   with self.subTest(pc=hex(pc)),self.assertRaises(ValueError):source.verify(self.changed_word(pc,0x39002008),self.core)
 def test_virtual_slot_cannot_select_ray_builder(self):
  with self.assertRaisesRegex(ValueError,'virtual method differs'):source.verify(self.changed_bytes(0x102481f20,struct.pack('<Q',0x1018d9178)),self.core)
 def test_registration_callbacks_are_guarded(self):
  for pc in [0x1018d7e2c,0x1018d7e3c]:
   with self.subTest(pc=hex(pc)),self.assertRaises(ValueError):source.verify(self.changed_word(pc,self.image.word(pc)+32),self.core)
 def test_type_registry_target_is_guarded(self):
  with self.assertRaises(ValueError):source.verify(self.changed_word(0x1018d7e60,self.image.word(0x1018d7e60)+1),self.core)
 def test_legacy_color_helper_target_is_guarded(self):
  with self.assertRaises(ValueError):source.verify(self.changed_word(0x1018d805c,self.image.word(0x1018d805c)+1),self.core)
 def test_both_optimized_packet_targets_are_guarded(self):
  for pc in [0x1018f1fbc,0x1018f21e8,0x1018f1924]:
   with self.subTest(pc=hex(pc)),self.assertRaises(ValueError):source.verify(self.changed_word(pc,self.image.word(pc)+1),self.core)
 def test_optimized_primitive_filter_is_unsigned_hi_backedge(self):
  self.assertEqual(source.conditional_branch(self.image,0x1018f1c74),(8,0x1018f1c34))
  with self.assertRaises(ValueError):source.verify(self.changed_word(0x1018f1c74,self.image.word(0x1018f1c74)^1),self.core)
 def test_orientation_flag_selects_the_local_packet_backedge(self):
  self.assertEqual(source.bit_branch(self.image,0x1018f21c8),(8,1,0x1018f1fa0))
  with self.assertRaises(ValueError):source.verify(self.changed_word(0x1018f21c8,self.image.word(0x1018f21c8)^(1<<19)),self.core)
 def test_branch_decoders_reject_wrong_opcodes(self):
  for method,pc in [(source.bit_branch,0x1018f21c8),(source.conditional_branch,0x1018f1c74)]:
   with self.subTest(pc=hex(pc)),self.assertRaises(ValueError):method(self.changed_word(pc,0xd503201f),pc)
 def test_ray_record_pin_is_mandatory(self):
  with patch.object(source,'RAY_SHA256','0'*64),self.assertRaises(ValueError):source.verify(self.image,self.core)
 def test_vertex_declaration_pin_is_mandatory(self):
  with patch.object(source,'FORMAT_SHA256','0'*64),self.assertRaises(ValueError):source.observe()
 def test_inherited_primitive_dispatch_is_guarded(self):
  with self.assertRaises(ValueError):source.verify(self.changed_word(0x1018def04,0xd503201f),self.core)
if __name__=='__main__':unittest.main()
