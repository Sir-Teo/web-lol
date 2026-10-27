"""Guard native ray type, virtual dispatch, packet and distinct color conversions."""
from pathlib import Path
import json,runpy,struct,unittest
from unittest.mock import patch
import native_ray_packet as source

class RayGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.core=json.loads(source.witness.pinned(source.defaults.CORE,source.defaults.CORE_SHA256));raw=source.witness.restored.checked(Path(cls.core['native']['path']).read_bytes(),cls.core['native'])
  cls.data,cls.sections=runpy.run_path(str(source.witness.PARSER))['arm64_sections'](raw,cls.core['native']['architecture']);cls.image=source.witness.Image(cls.data,cls.sections)
 def changed_word(self,pc,word):
  class Changed(source.witness.Image):
   def word(self,address):return word if source.witness.number(address)==pc else super().word(address)
  return Changed(self.data,self.sections)
 def changed_bytes(self,address,raw):
  section=next(s for s in self.sections if s['address']<=address and address+len(raw)<=s['address']+s['bytes']);offset=section['offset']+address-section['address'];data=bytearray(self.data);data[offset:offset+len(raw)]=raw;return source.witness.Image(data,self.sections)
 def test_record_replays_with_network_and_child_processes_blocked(self):
  with patch('socket.socket',side_effect=AssertionError('Network forbidden')),patch('subprocess.Popen',side_effect=AssertionError('Child forbidden')):observed=source.observe()
  self.assertEqual(observed,json.loads(source.OUTPUT.read_bytes()));self.assertEqual(observed['rayType']['kind'],2);self.assertEqual(len(observed['functionSpans']),7);self.assertFalse(observed['nativeExecuted'])
 def test_each_function_rejects_a_changed_byte(self):
  for name,start,end,digest in source.SPANS:
   with self.subTest(name=name),self.assertRaisesRegex(ValueError,'function bytes differ'):
    source.verify(self.changed_bytes(start,bytes([self.image.at(start,1)[0]^1])),self.core)
 def test_each_selected_instruction_rejects_a_changed_word(self):
  for pc,word,reading in source.WORDS:
   with self.subTest(reading=reading),self.assertRaisesRegex(ValueError,'selected instruction differs'):source.verify(self.changed_word(pc,word^1),self.core)
 def test_ray_kind_must_match_in_both_constructor_paths(self):
  for pc in [0x10193aca0,0x10193acd8]:
   with self.subTest(pc=hex(pc)),self.assertRaises(ValueError):source.verify(self.changed_word(pc,0x52800068),self.core)
 def test_constructor_callback_cannot_point_to_another_function(self):
  with self.assertRaises(ValueError):source.verify(self.changed_word(0x1018d9070,self.image.word(0x1018d9070)+32),self.core)
 def test_constructor_vptr_rejects_a_different_pointer(self):
  with self.assertRaisesRegex(ValueError,'constructor vptr differs'):source.verify(self.changed_word(0x10193acac,self.image.word(0x10193acac)+(1<<10)),self.core)
 def test_virtual_slot_must_point_to_the_ray_builder(self):
  with self.assertRaisesRegex(ValueError,'virtual slot differs'):source.verify(self.changed_bytes(0x102482250,struct.pack('<Q',0x1018d7f34)),self.core)
 def test_function_boundary_cannot_be_shortened(self):
  rows=list(source.SPANS);name,start,end,digest=rows[3];rows[3]=(name,start,end-4,digest)
  with patch.object(source,'SPANS',rows),self.assertRaisesRegex(ValueError,'function bounds differ'):source.verify(self.image,self.core)
 def test_wrong_modulation_registration_offset_rejects(self):
  with self.assertRaises(ValueError):source.verify(self.changed_word(0x1018ab774,0x52801e02),self.core)
 def test_changed_field_candidate_rejects(self):
  rows=list(source.FIELDS);_,pc,offset,wrapper=rows[1];rows[1]=('inventedModulation',pc,offset,wrapper)
  with patch.object(source,'FIELDS',rows),self.assertRaisesRegex(ValueError,'candidate hash differs'):source.verify(self.image,self.core)
 def test_changed_field_wrapper_rejects(self):
  rows=list(source.FIELDS);name,pc,offset,_=rows[1];rows[1]=(name,pc,offset,0x10007e314)
  with patch.object(source,'FIELDS',rows),self.assertRaisesRegex(ValueError,'field wrapper differs'):source.verify(self.image,self.core)
 def test_modulation_wrapper_must_register_float4(self):
  with self.assertRaises(ValueError):source.verify(self.changed_word(0x10034f414,0x52800183),self.core)
 def test_distinct_color_packers_have_concrete_finite_counterexamples(self):
  # Independent arithmetic examples of the statically decoded operations;
  # this test does not execute either native routine.
  ray=lambda v:0 if v<=0 else 255 if v>=1 else int(v*255+.5)
  fast=lambda v:int(max(0,v)*255)&255
  self.assertEqual([ray(v)for v in [0,.5,1,1.5]],[0,128,255,255])
  self.assertEqual([fast(v)for v in [0,.5,1,1.5]],[0,127,255,126])
if __name__=='__main__':unittest.main()
