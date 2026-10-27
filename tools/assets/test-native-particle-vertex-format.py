"""Guard the particle declaration, Metal API chain and bounded dyld decoder."""
from pathlib import Path
import json,runpy,struct,tempfile,unittest
from unittest.mock import patch
import native_particle_vertex_format as source

class FormatGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.core=json.loads(source.witness.pinned(source.defaults.CORE,source.defaults.CORE_SHA256));raw=source.witness.restored.checked(Path(cls.core['native']['path']).read_bytes(),cls.core['native']);cls.data,cls.sections=runpy.run_path(str(source.witness.PARSER))['arm64_sections'](raw,cls.core['native']['architecture']);cls.image=source.witness.Image(cls.data,cls.sections)
 def changed_word(self,pc,word):
  class Changed(source.witness.Image):
   def word(self,address):return word if source.witness.number(address)==pc else super().word(address)
  return Changed(self.data,self.sections)
 def changed_bytes(self,address,raw):
  section=next(s for s in self.sections if s['address']<=address and address+len(raw)<=s['address']+s['bytes']);offset=section['offset']+address-section['address'];data=bytearray(self.data);data[offset:offset+len(raw)]=raw;return source.witness.Image(data,self.sections)
 def test_exact_record_replays_offline_without_child_processes(self):
  with patch('socket.socket',side_effect=AssertionError('Network forbidden')),patch('subprocess.Popen',side_effect=AssertionError('Child forbidden')):observed=source.observe()
  self.assertEqual(observed,json.loads(source.OUTPUT.read_bytes()));self.assertEqual([r['metalFormat']for r in observed['firstParticleLayout']],[30,9,27,25]);self.assertEqual(observed['dynamicBindings']['count'],2297)
  color=observed['firstParticleLayout'][1];self.assertEqual((color['initialComponents'],color['metalComponents']),(1,4))
 def test_each_native_function_rejects_a_changed_byte(self):
  for row in json.loads(source.OUTPUT.read_bytes())['functionSpans']:
   start=int(row['start'],16)
   with self.subTest(name=row['name']),self.assertRaisesRegex(ValueError,'function bytes differ'):source.verify(self.changed_bytes(start,bytes([self.image.at(start,1)[0]^1])),self.core)
 def test_each_selected_instruction_rejects_a_changed_decoding(self):
  for pc,word,reading in source.WORDS:
   with self.subTest(reading=reading),self.assertRaisesRegex(ValueError,'selected instruction differs'):source.verify(self.changed_word(pc,word^1),self.core)
 def test_changed_descriptor_constant_rejects(self):
  with self.assertRaisesRegex(ValueError,'descriptor constants differ'):source.verify(self.changed_bytes(0x102133270,bytes.fromhex('08040300')),self.core)
 def test_changed_initializer_store_offset_rejects(self):
  with self.assertRaisesRegex(ValueError,'initializer store differs'):source.verify(self.changed_word(0x1018a43d0,self.image.word(0x1018a43d0)+(1<<10)),self.core)
 def test_wrong_normalized_color_virtual_slot_rejects(self):
  with self.assertRaisesRegex(ValueError,'virtual layout methods differ'):source.verify(self.changed_bytes(0x102497ca8,struct.pack('<Q',0x101a8f5c4)),self.core)
 def test_changed_format_switch_table_rejects(self):
  with self.assertRaisesRegex(ValueError,'switch table differs'):source.verify(self.changed_bytes(0x1021346f1,b'\x06'),self.core)
 def test_changed_selector_literal_pointer_rejects(self):
  with self.assertRaisesRegex(ValueError,'selector differs'):source.selectors(self.changed_bytes(0x1024fb950,struct.pack('<Q',0x1022b7af8)))
 def test_changed_objc_message_pointer_rejects(self):
  pc=0x102004620+12
  with self.assertRaisesRegex(ValueError,'message target differs'):source.selectors(self.changed_word(pc,self.image.word(pc)+(1<<10)))
 def test_changed_selector_call_target_rejects(self):
  pc=0x101a8f724
  with self.assertRaisesRegex(ValueError,'selector call differs'):source.verify(self.changed_word(pc,self.image.word(pc)+1),self.core)
 def test_official_sdk_archive_corruption_rejects_without_network(self):
  raw=bytearray(source.APPLE_ARCHIVE.read_bytes());raw[0]^=1
  with tempfile.TemporaryDirectory()as root,patch('socket.socket',side_effect=AssertionError('Network forbidden')):
   path=Path(root)/'changed.zip';path.write_bytes(raw)
   with self.assertRaisesRegex(ValueError,'Frozen native witness input differs'):source.api_enums(path)
 def test_function_boundary_rejects(self):
  rows=list(source.SPANS);name,start,end,digest=rows[0];rows[0]=(name,start,end-4,digest)
  with patch.object(source,'SPANS',rows),self.assertRaisesRegex(ValueError,'function bounds differ'):source.verify(self.image,self.core)
 def test_changed_binding_table_rejects(self):
  data=bytearray(self.data);data[source.BINDING_OFFSET]^=1
  with self.assertRaisesRegex(ValueError,'binding table differs'):source.binding_table(data)
 def test_binding_decoder_retains_valid_64_bit_address_wrap(self):
  def uleb(value):
   out=bytearray()
   while value>=128:out.append((value&127)|128);value>>=7
   out.append(value);return bytes(out)
  raw=b'\x11\x40_X\0\x51\x70\x10\x90\x80'+uleb((1<<64)-16)+b'\x90\0'
  rows=source.decode_bindings(raw,[{'name':'test','address':0x1000,'bytes':64}],['test.dylib'])
  self.assertEqual([r['address']for r in rows],['0x1010','0x1008'])
 def test_binding_decoder_rejects_unbounded_or_unsupported_streams(self):
  segments=[{'name':'test','address':0x1000,'bytes':64}];libraries=['test.dylib']
  for raw in [b'\x70'+b'\x80'*11,b'\x70'+b'\xff'*9+b'\x02',b'\x7f\0',b'\xd0',b'\0\x90',b'\x11\x40_X\0\x52\x70\0\x90\0']:
   with self.subTest(raw=raw.hex()),self.assertRaises(ValueError):source.decode_bindings(raw,segments,libraries)
 def test_binding_decoder_rejects_truncated_names_and_missing_terminators(self):
  segments=[{'name':'test','address':0x1000,'bytes':64}]
  for raw in [b'\x40name',b'\x11',b'\x11\x40_X\0\x51\x70\x40\x90\0']:
   with self.subTest(raw=raw.hex()),self.assertRaises(ValueError):source.decode_bindings(raw,segments,['test.dylib'])
if __name__=='__main__':unittest.main()
