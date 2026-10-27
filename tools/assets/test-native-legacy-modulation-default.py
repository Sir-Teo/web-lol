from pathlib import Path
import json,runpy,struct,unittest
from unittest.mock import patch
import native_legacy_modulation_default as source

class ModulationGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.core=json.loads(source.witness.pinned(source.legacy.ray.defaults.CORE,source.legacy.ray.defaults.CORE_SHA256));raw=source.witness.restored.checked(Path(cls.core['native']['path']).read_bytes(),cls.core['native']);cls.data,cls.sections=runpy.run_path(str(source.witness.PARSER))['arm64_sections'](raw,cls.core['native']['architecture']);cls.image=source.witness.Image(cls.data,cls.sections)
 def changed_word(self,pc,word):
  class Changed(source.witness.Image):
   def word(self,address):return word if source.witness.number(address)==pc else super().word(address)
  return Changed(self.data,self.sections)
 def changed_bytes(self,address,raw):
  s=next(s for s in self.sections if s['address']<=address and address+len(raw)<=s['address']+s['bytes']);offset=s['offset']+address-s['address'];data=bytearray(self.data);data[offset:offset+len(raw)]=raw;return source.witness.Image(data,self.sections)
 def source(self):return json.loads(source.legacy.GROMP.read_bytes()),json.loads(Path('src/content/gromp-death.json').read_bytes())
 def test_exact_offline_observation(self):
  with patch('socket.socket',side_effect=AssertionError('Network forbidden')),patch('subprocess.Popen',side_effect=AssertionError('Child forbidden')):observed=source.observe()
  self.assertEqual(observed,json.loads(source.OUTPUT.read_bytes()));self.assertEqual(len(observed['functionSpans']),10);self.assertEqual(len(observed['selectedInstructions']),85);self.assertEqual(observed['defaultRgba'],[1,1,1,1]);self.assertEqual(sum(len(r['keys'])for r in observed['grompSourceOmissions']),4);self.assertFalse(observed['nativeExecuted']);self.assertFalse(observed['applicationBehaviorChanged'])
 def test_every_function_rejects_changed_bytes(self):
  for name,start,end,digest in source.SPANS:
   with self.subTest(name=name),self.assertRaises(ValueError):source.verify(self.changed_bytes(start,bytes([self.image.at(start,1)[0]^1])),self.core)
 def test_every_selected_word_is_guarded(self):
  for pc,word,reading in source.WORDS:
   with self.subTest(reading=reading),self.assertRaises(ValueError):source.verify(self.changed_word(pc,word^1),self.core)
 def test_function_bounds_cannot_shrink(self):
  rows=list(source.SPANS);name,start,end,digest=rows[0];rows[0]=(name,start,end-4,digest)
  with patch.object(source,'SPANS',rows),self.assertRaisesRegex(ValueError,'function bounds differ'):source.verify(self.image,self.core)
 def test_all_three_vtable_slots_are_bound(self):
  for offset in [0x30,0x38,0x50]:
   with self.subTest(offset=offset),self.assertRaises(ValueError):source.verify(self.changed_bytes(0x102480ed0+offset,struct.pack('<Q',0)),self.core)
 def test_modulation_key_literal_is_exact(self):
  with self.assertRaises(ValueError):source.verify(self.changed_bytes(0x102277e8e,b'X'),self.core)
 def test_empty_lookup_default_is_exact(self):
  with self.assertRaises(ValueError):source.verify(self.changed_bytes(0x102230369,b'X'),self.core)
 def test_legacy_witness_is_mandatory(self):
  with patch.object(source,'LEGACY_SHA256','0'*64),self.assertRaises(ValueError):source.verify(self.image,self.core)
 def test_gromp_source_pin_is_mandatory(self):
  with patch.object(source.legacy,'GROMP_SHA256','0'*64),self.assertRaises(ValueError):source.observe()
 def test_base_fields_cannot_be_hidden_in_unlabeled_typed_rows(self):
  for section in ['pop','popshards']:
   pin,compiled=self.source();pin['records']['data/particles/sru_gromp_death_pop.troybin']['typed']['rows'].append({'hash':source.source_key(section,'e-color-modulate')})
   with self.subTest(section=section),self.assertRaisesRegex(ValueError,'present in typed source'):source.source_rows(pin,compiled)
 def test_first_numbered_fields_cannot_be_hidden_in_unlabeled_typed_rows(self):
  for section in ['pop','popshards']:
   pin,compiled=self.source();pin['records']['data/particles/sru_gromp_death_pop.troybin']['typed']['rows'].append({'hash':source.source_key(section,'e-color-modulate1')})
   with self.subTest(section=section),self.assertRaisesRegex(ValueError,'present in typed source'):source.source_rows(pin,compiled)
 def test_ascii_case_and_separator_match_native_sdbm(self):
  self.assertEqual(source.source_key('POP','E-CoLoR-Modulate'),'85036d84');self.assertEqual(source.source_key('popshards','e-color-modulate1'),'74eeec42');self.assertNotEqual(source.source_key('pop','e-color-modulate'),source.source_key('po','pe-color-modulate'))
 def test_non_ascii_scope_is_rejected(self):
  with self.assertRaises(ValueError):source.source_key('pöp','e-color-modulate')
 def test_legacy_ray_scope_is_inherited(self):
  pin,compiled=self.source();compiled['profiles'][0]['kind']='ray'
  with self.assertRaises(ValueError):source.source_rows(pin,compiled)
if __name__=='__main__':unittest.main()
