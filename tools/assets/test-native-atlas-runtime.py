"""Reject changed atlas bytes, function bounds, import bindings and shader inputs."""
from pathlib import Path
import copy,json,runpy,struct,tempfile,unittest
from unittest.mock import patch
import native_atlas_runtime as source

class AtlasGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.core=json.loads(source.witness.pinned(source.defaults.CORE,source.defaults.CORE_SHA256))
  raw=source.witness.restored.checked(Path(cls.core['native']['path']).read_bytes(),cls.core['native'])
  cls.data,cls.sections=runpy.run_path(str(source.witness.PARSER))['arm64_sections'](raw,cls.core['native']['architecture'])
  cls.image=source.witness.Image(cls.data,cls.sections)
  cls.pin=json.loads(source.witness.pinned(source.SHADER_PIN,source.SHADER_SHA256))
 def changed_word(self,pc,word):
  class Changed(source.witness.Image):
   def word(self,address):return word if source.witness.number(address)==pc else super().word(address)
  return Changed(self.data,self.sections)
 def test_record_replays_offline_without_child_processes(self):
  with tempfile.TemporaryDirectory()as work,patch('socket.socket',side_effect=AssertionError('Network forbidden')),patch('subprocess.Popen',side_effect=AssertionError('Child process forbidden')):
   observed=source.observe(Path(work))
  self.assertEqual(observed,json.loads(source.OUTPUT.read_bytes()))
  self.assertFalse(observed['nativeExecuted']);self.assertFalse(observed['nativeShaderExecuted'])
  self.assertEqual(len(observed['functionSpans']),5)
 def test_each_native_span_rejects_changed_bytes(self):
  for name,start,end,digest in source.SPANS:
   with self.subTest(name=name):
    section=next(s for s in self.sections if s['address']<=start<s['address']+s['bytes']);offset=section['offset']+start-section['address'];data=bytearray(self.data);data[offset]^=1
    with self.assertRaisesRegex(ValueError,'function bytes differ'):source.verify_native(source.witness.Image(data,self.sections),self.core)
 def test_each_selected_instruction_rejects_changed_decoding(self):
  for pc,word,meaning in source.WORDS:
   with self.subTest(meaning=meaning),self.assertRaisesRegex(ValueError,'selected instruction differs'):
    source.verify_native(self.changed_word(pc,word^1),self.core)
 def test_function_boundary_rejects(self):
  rows=list(source.SPANS);name,start,end,digest=rows[0];rows[0]=(name,start,end-4,digest)
  with patch.object(source,'SPANS',rows),self.assertRaisesRegex(ValueError,'function bounds differ'):source.verify_native(self.image,self.core)
 def test_function_start_table_rejects(self):
  core=copy.deepcopy(self.core);core['functionStarts']['sha256']='0'*64
  with self.assertRaisesRegex(ValueError,'function-start table differs'):source.verify_native(self.image,core)
 def test_import_name_rejects(self):
  with self.assertRaisesRegex(ValueError,'import binding differs'):source.imports(self.data,[(0x1020003c0,'_fmod')])
 def test_import_alignment_rejects(self):
  with self.assertRaisesRegex(ValueError,'stub alignment'):source.imports(self.data,[(0x1020003c4,'_fmodf')])
 def test_import_outside_stub_rejects(self):
  with self.assertRaisesRegex(ValueError,'import stub'):source.imports(self.data,[(0x1018f2068,'_fmodf')])
 def test_import_call_target_rejects(self):
  with self.assertRaisesRegex(ValueError,'direct branch differs'):source.verify_native(self.changed_word(0x1018f2068,0x941c38d7),self.core)
 def test_uniform_literal_pointer_rejects(self):
  with self.assertRaisesRegex(ValueError,'TEXTURE_INFO pointer differs'):source.verify_native(self.changed_word(0x10188f00c,self.image.word(0x10188f00c)+(1<<10)),self.core)
 def test_missing_manifest_rejects_before_network_or_child(self):
  with tempfile.TemporaryDirectory()as work,patch.object(source.witness,'pinned',side_effect=FileNotFoundError('manifest')),patch('socket.socket',side_effect=AssertionError('Network forbidden')),patch('subprocess.Popen',side_effect=AssertionError('Child forbidden')):
   with self.assertRaisesRegex(FileNotFoundError,'manifest'):source.reconstruct_shader(self.pin,Path(work))
 def test_shader_resource_pin_rejects(self):
  pin=copy.deepcopy(self.pin);next(r for r in pin['extraction']['files']if r['path']==source.TABLE+'_0')['sha256']='0'*64
  with tempfile.TemporaryDirectory()as work,self.assertRaises(ValueError):source.reconstruct_shader(pin,Path(work))
 def test_shader_program_pin_rejects(self):
  pin=copy.deepcopy(self.pin);next(r for r in pin['selections']if r['toc']==source.TABLE and r['defines']=={})['sha256']='0'*64
  with tempfile.TemporaryDirectory()as work,self.assertRaises(ValueError):source.reconstruct_shader(pin,Path(work))
 def test_shader_define_selection_rejects(self):
  pin=copy.deepcopy(self.pin);next(r for r in pin['selections']if r['toc']==source.TABLE and r['defines']=={})['index']=0
  with tempfile.TemporaryDirectory()as work,self.assertRaisesRegex(ValueError,'selection differs'):source.reconstruct_shader(pin,Path(work))
 def test_half_frame_counterexamples_under_nearest_even(self):
  # Python's binary16 conversion is an independent nearest-even packet oracle.
  # These are conditional arithmetic examples, not native FPCR or RNG claims.
  for continuous,expected in [(0.9999,1),(3.9996,4),(15.999,16)]:
   rounded=struct.unpack('<e',struct.pack('<e',continuous))[0]
   self.assertEqual(int(rounded),expected);self.assertNotEqual(int(continuous),expected)
 def test_same_packet_must_not_be_generalized_to_mesh(self):
  record=json.loads(source.OUTPUT.read_bytes());self.assertIn('FCVTZS',record['reading']['meshFrame'])
  self.assertIn('half4',record['reading']['quadPacket'])
if __name__=='__main__':unittest.main()
