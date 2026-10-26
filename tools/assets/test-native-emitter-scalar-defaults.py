"""Guard native scalar/flag extraction against changed bytes and registrations."""
from pathlib import Path
import json,runpy,struct,unittest
from unittest.mock import patch
import native_emitter_scalar_defaults as source

class ScalarGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  core=json.loads(source.witness.pinned(source.CORE,source.CORE_SHA256));raw=Path(core['native']['path']).read_bytes()
  cls.data,cls.sections=runpy.run_path(str(source.witness.PARSER))['arm64_sections'](raw,core['native']['architecture'])
  cls.image=source.witness.Image(cls.data,cls.sections)
 def corrupt(self,pc,word):
  class Changed(source.witness.Image):
   def word(self,address):return word if source.witness.number(address)==pc else super().word(address)
  return Changed(self.data,self.sections)
 def test_exact_native_record_replays(self):
  observed=source.observe();self.assertEqual(json.loads(source.OUTPUT.read_bytes()),observed)
  self.assertEqual(observed['atlas'],{'startFrame':0,'numFrames':1,'frameRate':0.0})
  self.assertEqual(len(observed['functionSpans']),5)
  self.assertEqual(len(observed['scalarRegistrations']),3)
  self.assertEqual(len(observed['flags']),22)
  self.assertEqual([r['candidate']for r in observed['flags']if r['constructorSet']],['useEmissionMeshNormalForBirth','isLocalOrientation'])
 def test_native_function_byte_corruption_rejects(self):
  s=next(s for s in self.sections if s['address']<=0x1018ac9f0<s['address']+s['bytes']);offset=s['offset']+0x1018ac9f0-s['address'];data=bytearray(self.data);data[offset]^=1
  with self.assertRaisesRegex(ValueError,'function bytes differ'):source.verify(source.witness.Image(data,self.sections))
 def test_native_wrapper_byte_corruption_rejects(self):
  s=next(s for s in self.sections if s['address']<=0x100086e94<s['address']+s['bytes']);offset=s['offset']+0x100086e94-s['address'];data=bytearray(self.data);data[offset]^=1
  with self.assertRaisesRegex(ValueError,'function bytes differ'):source.verify(source.witness.Image(data,self.sections))
 def test_wrong_atlas_store_base_rejects(self):
  with self.assertRaisesRegex(ValueError,'saved this'):source.verify(self.corrupt(0x1018ac9f4,0xf901328b))
 def test_narrow_atlas_store_rejects(self):
  with self.assertRaisesRegex(ValueError,'saved this'):source.verify(self.corrupt(0x1018ac9f4,0xb901326b))
 def test_wrong_flag_store_offset_rejects(self):
  with self.assertRaisesRegex(ValueError,'store offset'):source.verify(self.corrupt(0x1018aca64,0xb902d66a))
 def test_wrong_constructor_frame_count_rejects(self):
  with self.assertRaisesRegex(ValueError,'constructor values'):source.verify(self.corrupt(0x1018ac9f0,0x52a0004b))
 def test_wrong_local_constructor_bit_rejects(self):
  with self.assertRaisesRegex(ValueError,'constructor values'):source.verify(self.corrupt(0x1018aca60,0x72a0080a))
 def test_wrong_scalar_registration_offset_rejects(self):
  with self.assertRaises(ValueError):source.verify(self.corrupt(0x1018abc98,0x52804c02))
 def test_wrong_scalar_wrapper_type_rejects(self):
  with self.assertRaises(ValueError):source.verify(self.corrupt(0x100086e94,0x52800143))
 def test_wrong_field_name_rejects(self):
  with patch.object(source,'SCALARS',[('inventedField',source.SCALARS[0][1]),*source.SCALARS[1:]]):
   with self.assertRaises((KeyError,ValueError)):source.verify(self.image)
 def test_wrong_flag_mask_rejects(self):
  rows=list(source.FLAGS);name,hashed,pc,mask=rows[0];rows[0]=(name,hashed,pc,mask<<1)
  with patch.object(source,'FLAGS',rows):
   with self.assertRaises(ValueError):source.verify(self.image)
 def test_unknown_flag_remains_unlabelled(self):
  rows=source.verify(self.image)['flags'];unknown=[r for r in rows if r['candidate']is None]
  self.assertEqual([(r['hash'],r['mask'])for r in unknown],[('d1ee8634',1)])
 def test_wrong_move_register_rejects(self):
  with self.assertRaisesRegex(ValueError,'MOVZ/MOVK'):source.mov_value(self.image,0x1018ac9f0,10)
 def test_store_width_is_bounded(self):
  with self.assertRaisesRegex(ValueError,'store width'):source.store(self.image,0x1018ac9f4,11,0x260,16)
if __name__=='__main__':unittest.main()
