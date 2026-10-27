"""Guards for independent ray birth components and the frozen source example."""
from pathlib import Path
import json,runpy,unittest
from unittest.mock import patch
import native_ray_birth_scale as source

class BirthScaleGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.core=json.loads(source.witness.pinned(source.draw.ray.defaults.CORE,source.draw.ray.defaults.CORE_SHA256));raw=source.witness.restored.checked(Path(cls.core['native']['path']).read_bytes(),cls.core['native'])
  cls.data,cls.sections=runpy.run_path(str(source.witness.PARSER))['arm64_sections'](raw,cls.core['native']['architecture']);cls.image=source.witness.Image(cls.data,cls.sections)
 def changed_word(self,pc,word):
  class Changed(source.witness.Image):
   def word(self,address):return word if source.witness.number(address)==pc else super().word(address)
  return Changed(self.data,self.sections)
 def test_exact_offline_replay(self):
  with patch('socket.socket',side_effect=AssertionError('Network forbidden')),patch('subprocess.Popen',side_effect=AssertionError('Child forbidden')):observed=source.observe()
  self.assertEqual(observed,json.loads(source.OUTPUT.read_bytes()));self.assertEqual(len(observed['functionSpans']),1);self.assertEqual(len(observed['selectedInstructions']),89);self.assertFalse(observed['nativeExecuted']);self.assertEqual(observed['sourceRay']['birthScale'],[80,180,0])
 def test_complete_function_rejects_changed_bytes(self):
  _,address,_,_=source.SPANS[0];section=next(s for s in self.sections if s['address']<=address<s['address']+s['bytes']);offset=section['offset']+address-section['address'];data=bytearray(self.data);data[offset]^=1
  with self.assertRaisesRegex(ValueError,'function bytes differ'):source.verify(source.witness.Image(data,self.sections),self.core)
 def test_each_selected_instruction_rejects_changed_words(self):
  for pc,word,reading in source.WORDS:
   with self.subTest(reading=reading),self.assertRaises(ValueError):source.verify(self.changed_word(pc,word^1),self.core)
 def test_complete_function_boundary_is_guarded(self):
  name,start,end,digest=source.SPANS[0]
  with patch.object(source,'SPANS',[(name,start,end-4,digest)]),self.assertRaisesRegex(ValueError,'function bounds differ'):source.verify(self.image,self.core)
 def test_inherited_draw_record_pin_is_mandatory(self):
  with patch.object(source,'DRAW_SHA256','0'*64),self.assertRaises(ValueError):source.verify(self.image,self.core)
 def test_frozen_source_pin_is_mandatory(self):
  with patch.object(source,'SOURCE_SHA256','0'*64),self.assertRaises(ValueError):source.observe()
 def changed_profile(self,key,value):
  data=json.loads(source.SOURCE.read_text());data['resources']['MasterYi_Crit_tar']['definition']['complexEmitterDefinitionData'][1][key]=value;return data
 def test_source_primitive_identity_cannot_change(self):
  with self.assertRaisesRegex(ValueError,'identity differs'):source.verify_profile(self.changed_profile('primitive',{'__type':'VfxPrimitiveCameraQuad'}))
 def test_source_uniform_flag_cannot_disappear(self):
  with self.assertRaisesRegex(ValueError,'uniform flag differs'):source.verify_profile(self.changed_profile('isUniformScale',0))
 def test_source_birth_components_cannot_collapse(self):
  with self.assertRaisesRegex(ValueError,'birth vector differs'):source.verify_profile(self.changed_profile('birthScale0',{'constantValue':[80,80,80],'__type':'ValueVector3'}))
 def test_source_scale_curve_cannot_collapse(self):
  data=json.loads(source.SOURCE.read_text());data['resources']['MasterYi_Crit_tar']['definition']['complexEmitterDefinitionData'][1]['scale0']['dynamics']['values'][-1]=[2.5,2.5,2.5]
  with self.assertRaisesRegex(ValueError,'anisotropic scale differs'):source.verify_profile(data)
 def test_initializer_call_is_guarded(self):
  with self.assertRaises(ValueError):source.verify(self.changed_word(0x1018f8990,0x9400029e),self.core)
 def test_inherited_xyz_draw_writes_remain_guarded(self):
  with self.assertRaises(ValueError):source.verify(self.changed_word(0x1018fc324,0xd503201f),self.core)
if __name__=='__main__':unittest.main()
