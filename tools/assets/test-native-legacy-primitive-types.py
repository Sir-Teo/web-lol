from pathlib import Path
import json,runpy,struct,sys,unittest
from unittest.mock import patch
import native_legacy_primitive_types as source
class LegacyGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.core=json.loads(source.witness.pinned(source.ray.defaults.CORE,source.ray.defaults.CORE_SHA256));raw=source.witness.restored.checked(Path(cls.core['native']['path']).read_bytes(),cls.core['native']);cls.data,cls.sections=runpy.run_path(str(source.witness.PARSER))['arm64_sections'](raw,cls.core['native']['architecture']);cls.image=source.witness.Image(cls.data,cls.sections)
 def changed_word(self,pc,word):
  class Changed(source.witness.Image):
   def word(self,address):return word if source.witness.number(address)==pc else super().word(address)
  return Changed(self.data,self.sections)
 def changed_bytes(self,address,raw):
  s=next(s for s in self.sections if s['address']<=address and address+len(raw)<=s['address']+s['bytes']);offset=s['offset']+address-s['address'];data=bytearray(self.data);data[offset:offset+len(raw)]=raw;return source.witness.Image(data,self.sections)
 def test_exact_offline_observation(self):
  with patch('socket.socket',side_effect=AssertionError('Network forbidden')),patch('subprocess.Popen',side_effect=AssertionError('Child forbidden')):observed=source.observe()
  self.assertEqual(observed,json.loads(source.OUTPUT.read_bytes()));self.assertEqual(len(observed['functionSpans']),2);self.assertEqual(len(observed['selectedInstructions']),43);self.assertEqual(observed['switch']['entries'][2]['target'],'0x10189bb58');self.assertEqual(observed['firstLayoutFormats'],[30,9,27,25]);self.assertFalse(observed['nativeExecuted']);self.assertFalse(observed['applicationBehaviorChanged'])
 def test_every_function_rejects_changed_bytes(self):
  for name,start,end,digest in source.SPANS:
   with self.subTest(name=name),self.assertRaises(ValueError):source.verify(self.changed_bytes(start,bytes([self.image.at(start,1)[0]^1])),self.core)
 def test_every_selected_word_is_guarded(self):
  for pc,word,reading in source.WORDS:
   with self.subTest(reading=reading),self.assertRaises(ValueError):source.verify(self.changed_word(pc,word^1),self.core)
 def test_function_bounds_cannot_shrink(self):
  rows=list(source.SPANS);name,start,end,digest=rows[0];rows[0]=(name,start,end-4,digest)
  with patch.object(source,'SPANS',rows),self.assertRaisesRegex(ValueError,'function bounds differ'):source.verify(self.image,self.core)
 def test_type2_table_entry_cannot_select_camera_quad(self):
  with self.assertRaisesRegex(ValueError,'switch bytes differ'):source.verify(self.changed_bytes(0x10213342b+2,b'\0'),self.core)
 def test_all_thirteen_table_entries_are_guarded(self):
  for i in range(13):
   with self.subTest(index=i),self.assertRaises(ValueError):source.verify(self.changed_bytes(0x10213342b+i,bytes([self.image.at(0x10213342b+i,1)[0]^1])),self.core)
 def test_ray_vtable_slot_cannot_select_quad_builder(self):
  with self.assertRaises(ValueError):source.verify(self.changed_bytes(0x102482250,struct.pack('<Q',0x1018d7f34)),self.core)
 def test_p_type_literal_is_exact(self):
  with self.assertRaises(ValueError):source.verify(self.changed_bytes(0x102277dc2,b'x'),self.core)
 def test_both_default_texture_names_are_exact(self):
  for address in [0x1022780aa,0x1022780e8]:
   with self.subTest(address=hex(address)),self.assertRaises(ValueError):source.verify(self.changed_bytes(address,b'X'),self.core)
 def test_factory_kind_cannot_change(self):
  with self.assertRaises(ValueError):source.verify(self.changed_word(0x10189bb60,0x52800068),self.core)
 def test_ray_witness_pin_is_mandatory(self):
  with patch.object(source,'RAY_SHA256','0'*64),self.assertRaises(ValueError):source.verify(self.image,self.core)
 def test_declaration_pin_is_mandatory(self):
  with patch.object(source,'FORMAT_SHA256','0'*64),self.assertRaises(ValueError):source.observe()
 def test_gromp_source_pin_is_mandatory(self):
  with patch.object(source,'GROMP_SHA256','0'*64),self.assertRaises(ValueError):source.observe()
 def test_gromp_p_type_must_remain_two(self):
  pin=json.loads(source.GROMP.read_bytes());compiled=json.loads(Path('src/content/gromp-death.json').read_bytes());p=compiled['profiles'][5];pin['records'][p['sourceRecord']]['decoded']['values'][p['sourceSection']]['p-type']=0
  with self.assertRaisesRegex(ValueError,'p-type differs'):source.source_rows(pin,compiled)
 def test_gromp_profile_scope_cannot_expand(self):
  pin=json.loads(source.GROMP.read_bytes());compiled=json.loads(Path('src/content/gromp-death.json').read_bytes());compiled['profiles'][0]['kind']='ray'
  with self.assertRaises(ValueError):source.source_rows(pin,compiled)
if __name__=='__main__':unittest.main()
