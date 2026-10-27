"""Tamper guards for prepared scale writes and ray register lineage."""
from pathlib import Path
import json,runpy,unittest
from unittest.mock import patch
import native_ray_draw_data as source

class DrawDataGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.core=json.loads(source.witness.pinned(source.ray.defaults.CORE,source.ray.defaults.CORE_SHA256));raw=source.witness.restored.checked(Path(cls.core['native']['path']).read_bytes(),cls.core['native'])
  cls.data,cls.sections=runpy.run_path(str(source.witness.PARSER))['arm64_sections'](raw,cls.core['native']['architecture']);cls.image=source.witness.Image(cls.data,cls.sections)
 def changed_word(self,pc,word):
  class Changed(source.witness.Image):
   def word(self,address):return word if source.witness.number(address)==pc else super().word(address)
  return Changed(self.data,self.sections)
 def changed_byte(self,address):
  section=next(s for s in self.sections if s['address']<=address<s['address']+s['bytes']);offset=section['offset']+address-section['address'];data=bytearray(self.data);data[offset]^=1;return source.witness.Image(data,self.sections)
 def test_exact_offline_replay(self):
  with patch('socket.socket',side_effect=AssertionError('Network forbidden')),patch('subprocess.Popen',side_effect=AssertionError('Child forbidden')):observed=source.observe()
  self.assertEqual(observed,json.loads(source.OUTPUT.read_bytes()));self.assertEqual(len(observed['functionSpans']),4);self.assertEqual(len(observed['selectedInstructions']),48);self.assertFalse(observed['nativeExecuted']);self.assertFalse(observed['applicationBehaviorChanged'])
 def test_each_complete_function_rejects_changed_bytes(self):
  for name,start,end,digest in source.SPANS:
   with self.subTest(name=name),self.assertRaisesRegex(ValueError,'function bytes differ'):source.verify(self.changed_byte(start),self.core)
 def test_each_selected_instruction_rejects_changed_words(self):
  for pc,word,reading in source.WORDS:
   with self.subTest(reading=reading),self.assertRaises(ValueError):source.verify(self.changed_word(pc,word^1),self.core)
 def test_function_bounds_cannot_be_shortened(self):
  rows=list(source.SPANS);name,start,end,digest=rows[1];rows[1]=(name,start,end-4,digest)
  with patch.object(source,'SPANS',rows),self.assertRaisesRegex(ValueError,'function bounds differ'):source.verify(self.image,self.core)
 def test_both_scale_hash_candidates_are_guarded(self):
  for i in range(2):
   rows=list(source.FIELDS);name,pc,offset=rows[i];rows[i]=('inventedScale',pc,offset)
   with self.subTest(name=name),patch.object(source,'FIELDS',rows),self.assertRaisesRegex(ValueError,'candidate hash differs'):source.verify(self.image,self.core)
 def test_both_scale_offsets_are_guarded(self):
  for name,pc,offset in source.FIELDS:
   with self.subTest(name=name),self.assertRaises(ValueError):source.verify(self.changed_word(pc+8,self.image.word(pc+8)+(1<<5)),self.core)
 def test_scale_wrapper_branch_cannot_change(self):
  for name,pc,offset in source.FIELDS:
   with self.subTest(name=name),self.assertRaisesRegex(ValueError,'registration wrapper differs'):source.verify(self.changed_word(pc+20,self.image.word(pc+20)+1),self.core)
 def test_scale_descriptor_tag_is_guarded(self):
  with self.assertRaises(ValueError):source.verify(self.changed_word(0x10188965c,0x52801043),self.core)
 def test_scale_registry_branch_is_guarded(self):
  with self.assertRaisesRegex(ValueError,'descriptor registry differs'):source.verify(self.changed_word(0x10188966c,self.image.word(0x10188966c)+1),self.core)
 def test_historical_ray_pin_is_mandatory(self):
  with patch.object(source,'RAY_SHA256','0'*64),self.assertRaises(ValueError):source.verify(self.image,self.core)
 def test_inherited_ray_dispatch_remains_guarded(self):
  with self.assertRaises(ValueError):source.verify(self.changed_word(0x1018def04,0xd503201f),self.core)
if __name__=='__main__':unittest.main()
