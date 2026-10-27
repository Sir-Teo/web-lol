from pathlib import Path
import copy,json,runpy,struct,unittest
from unittest.mock import patch
import native_legacy_color_curves as source

class ColorCurveGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  legacy=source.modulation.legacy;cls.core=json.loads(source.witness.pinned(legacy.ray.defaults.CORE,legacy.ray.defaults.CORE_SHA256));raw=source.witness.restored.checked(Path(cls.core['native']['path']).read_bytes(),cls.core['native']);cls.data,cls.sections=runpy.run_path(str(source.witness.PARSER))['arm64_sections'](raw,cls.core['native']['architecture']);cls.image=source.witness.Image(cls.data,cls.sections)
 def fixture(self):return json.loads(source.modulation.legacy.GROMP.read_bytes()),json.loads(Path('src/content/gromp-death.json').read_bytes()),source.SOURCE_PATH.read_bytes()
 def changed_word(self,pc,word):
  class Changed(source.witness.Image):
   def word(self,address):return word if source.witness.number(address)==pc else super().word(address)
  return Changed(self.data,self.sections)
 def changed_bytes(self,address,raw):
  section=next(s for s in self.sections if s['address']<=address and address+len(raw)<=s['address']+s['bytes']);offset=section['offset']+address-section['address'];data=bytearray(self.data);data[offset:offset+len(raw)]=raw;return source.witness.Image(data,self.sections)
 def test_exact_offline_observation(self):
  with patch('socket.socket',side_effect=AssertionError('Network forbidden')),patch('subprocess.Popen',side_effect=AssertionError('Child forbidden')):observed=source.observe()
  self.assertEqual(observed,json.loads(source.OUTPUT.read_bytes()));self.assertEqual(len(observed['functionSpans']),7);self.assertEqual(len(observed['selectedInstructions']),231);self.assertEqual(observed['source']['typedRows'],272);self.assertEqual(sum(len(p['keys'])for p in observed['source']['profiles']),27);self.assertEqual(sum(len(p['absentBirthAndProbabilityKeys'])for p in observed['source']['profiles']),80);self.assertTrue(observed['source']['hostScanfSourceWordsExact']);self.assertFalse(observed['applicationBehaviorChanged'])
 def test_every_complete_function_is_bound(self):
  for name,start,end,digest in source.SPANS:
   with self.subTest(name=name),self.assertRaises(ValueError):source.verify(self.changed_bytes(start,bytes([self.image.at(start,1)[0]^1])),self.core)
 def test_every_selected_word_is_bound(self):
  for pc,word,reading in source.WORDS:
   with self.subTest(reading=reading),self.assertRaises(ValueError):source.verify(self.changed_word(pc,word^1),self.core)
 def test_complete_function_bounds_cannot_shrink(self):
  rows=list(source.SPANS);name,start,end,digest=rows[0];rows[0]=(name,start,end-4,digest)
  with patch.object(source,'SPANS',rows),self.assertRaisesRegex(ValueError,'function bounds differ'):source.verify(self.image,self.core)
 def test_sample_vtable_is_bound(self):
  with self.assertRaises(ValueError):source.verify(self.changed_bytes(0x102480ed0+0x40,struct.pack('<Q',0)),self.core)
 def test_both_color_field_literals_are_bound(self):
  for address in [0x102278a30,0x102277f6c]:
   with self.subTest(address=address),self.assertRaises(ValueError):source.verify(self.changed_bytes(address,b'X'),self.core)
 def test_modulation_parent_is_mandatory(self):
  with patch.object(source,'MODULATION_SHA256','0'*64),self.assertRaises(ValueError):source.verify(self.image,self.core)
 def test_original_troy_byte_mutation_is_rejected(self):
  pin,compiled,raw=self.fixture()
  with self.assertRaisesRegex(ValueError,'source bytes differ'):source.source_rows(pin,compiled,bytes([raw[0]^1])+raw[1:])
 def test_original_troy_truncation_is_rejected(self):
  pin,compiled,raw=self.fixture()
  with self.assertRaisesRegex(ValueError,'source bytes differ'):source.source_rows(pin,compiled,raw[:-1])
 def test_troy_reader_source_is_mandatory(self):
  with patch.object(source,'TROY_READER_SHA256','0'*64),self.assertRaises(ValueError):source.observe()
 def test_typed_rows_cannot_gain_an_unlabeled_probability_field(self):
  pin,compiled,raw=self.fixture();pin['records'][source.SOURCE_NAME]['typed']['rows'].append({'hash':source.modulation.source_key('pop','p-xrgbaRP1'),'storage':'string','raw':'0 1','value':[0,1]})
  with self.assertRaisesRegex(ValueError,'typed or decoded'):source.source_rows(pin,compiled,raw)
 def test_recovered_labels_cannot_change_the_original_record(self):
  pin,compiled,raw=self.fixture();record=pin['records'][source.SOURCE_NAME];record['labels'][source.modulation.source_key('pop','p-xrgba')]=['pop','wrong-color']
  with self.assertRaises((ValueError,AssertionError)):source.source_rows(pin,compiled,raw)
 def test_compiled_base_color_cannot_drift(self):
  pin,compiled,raw=self.fixture();compiled['profiles'][7]['color'][0]=.41
  with self.assertRaisesRegex(ValueError,'base color differs'):source.source_rows(pin,compiled,raw)
 def test_compiled_key_time_cannot_drift(self):
  pin,compiled,raw=self.fixture();compiled['profiles'][7]['colorCurve'][1]['time']=.51
  with self.assertRaisesRegex(ValueError,'color key differs'):source.source_rows(pin,compiled,raw)
 def test_compiled_key_vector_cannot_drift(self):
  pin,compiled,raw=self.fixture();compiled['profiles'][5]['colorCurve'][1]['value'][0]=.9
  with self.assertRaisesRegex(ValueError,'color key differs'):source.source_rows(pin,compiled,raw)
 def test_compiled_key_scope_cannot_truncate(self):
  pin,compiled,raw=self.fixture();compiled['profiles'][7]['colorCurve'].pop()
  with self.assertRaisesRegex(ValueError,'key scope expands'):source.source_rows(pin,compiled,raw)
 def test_profile_scope_cannot_expand(self):
  pin,compiled,raw=self.fixture();compiled['profiles'].append(copy.deepcopy(compiled['profiles'][0]))
  with self.assertRaisesRegex(ValueError,'color scope differs'):source.source_rows(pin,compiled,raw)
 def test_section_index_binding_is_strict(self):
  pin,compiled,raw=self.fixture();compiled['profiles'][0]['sourceIndex']=1
  with self.assertRaisesRegex(ValueError,'section/index linkage differs'):source.source_rows(pin,compiled,raw)
 def test_source_arity_is_strict(self):
  with self.assertRaises(ValueError):source.numeric_string({'storage':'string','raw':'0 1'},5)
 def test_source_storage_is_strict(self):
  with self.assertRaises(ValueError):source.numeric_string({'storage':'f32_vec4','raw':[1,1,1,1]},4)
 def test_nonfinite_source_is_rejected(self):
  with self.assertRaises(ValueError):source.numeric_string({'storage':'string','raw':'nan 1 1 1'},4)
 def test_native_prepared_purple_words_are_retained(self):
  pin,compiled,raw=self.fixture();result=source.source_rows(pin,compiled,raw)
  self.assertEqual(result['profiles'][7]['keys'][0]['preparedWords'],['3ecccccd','3e4ccccd','3f4ccccd','00000000']);self.assertEqual(result['profiles'][0]['base']['words'],['3f800000']*4)
if __name__=='__main__':unittest.main()
