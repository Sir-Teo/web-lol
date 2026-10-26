"""Bounded native-image reads, ARM64 decoders and actual-word corruption guards."""
from pathlib import Path
import copy,json,runpy,struct,unittest
import native_constructor_witness as source

def image(words,base=0x1000):
 data=struct.pack('<'+'I'*len(words),*words)
 return source.Image(data,[{'address':base,'bytes':len(data),'offset':0,'flags':0}])
class DecoderGuards(unittest.TestCase):
 def test_forward_and_backward_direct_branches(self):
  r=image([0x94000002,0x17ffffff]);self.assertEqual(r.branch(0x1000),0x1008);self.assertEqual(r.branch(0x1004,False),0x1000)
 def test_wrong_branch_kind_rejects(self):
  with self.assertRaises(ValueError):image([0x14000000]).branch(0x1000)
 def test_unaligned_instruction_rejects(self):
  with self.assertRaises(ValueError):image([0]).word(0x1001)
 def test_unmapped_span_rejects(self):
  with self.assertRaises(ValueError):image([0]).at(0x0ffc,4)
 def test_outside_file_span_rejects(self):
  r=source.Image(b'1234',[{'address':0x1000,'bytes':100,'offset':0,'flags':0}])
  with self.assertRaises(ValueError):r.at(0x1000,8)
 def test_overlapping_sections_reject(self):
  row={'address':0x1000,'bytes':4,'offset':0,'flags':0};r=source.Image(b'1234',[row,dict(row)])
  with self.assertRaises(ValueError):r.at(0x1000,4)
 def test_zerofill_cannot_supply_instruction_bytes(self):
  for flags in [1,12,18]:
   with self.subTest(flags=flags),self.assertRaises(ValueError):source.Image(b'1234',[{'address':0x1000,'bytes':4,'offset':0,'flags':flags}]).word(0x1000)
 def test_nonpositive_extent_rejects(self):
  for count in [0,-1,True,4.0]:
   with self.subTest(count=count),self.assertRaises(ValueError):image([0]).at(0x1000,count)
 def test_literal_movz_register_and_value(self):
  image([0x52800307]).movz(0x1000,7,24)
  with self.assertRaises(ValueError):image([0x52800307]).movz(0x1000,7,25)
 def test_adr_zero_and_negative_offsets(self):
  self.assertEqual(image([0x10000002]).adr(0x1000,2),0x1000);self.assertEqual(image([0x10ffffe2]).adr(0x1000,2),0xffc)
 def test_actual_constructor_page_pair(self):self.assertEqual(image([0xb0005ea8,0x913be108],0x1018ac8a8).page_pointer(0x1018ac8a8,0x1018ac8ac,8),0x102481ef8)
 def test_wrong_pointer_register_rejects(self):
  with self.assertRaises(ValueError):image([0xb0005ea8,0x913be108],0x1018ac8a8).page_pointer(0x1018ac8a8,0x1018ac8ac,7)

class ActualNativeGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  matching=source.restored.load();row=next(r for r in matching['selectedFiles']if r['name']==matching['executableName']);raw=source.restored.checked(source.restored.target(row).read_bytes(),row);arch=next(a for a in matching['macho']['architectures']if a['architecture']=='arm64');source.pinned(source.PARSER,source.PARSER_SHA256)
  cls.data,sections=runpy.run_path(str(source.PARSER))['arm64_sections'](raw,arch);cls.image=source.Image(cls.data,sections);cls.defaults=json.loads(source.pinned(source.DEFAULTS,source.DEFAULTS_SHA256));cls.loader=json.loads(source.pinned(source.LOADER,source.LOADER_SHA256))
 def invalid(self,change):
  defaults=copy.deepcopy(self.defaults);change(defaults)
  with self.assertRaises(ValueError):source.verify_records(self.image,defaults,self.loader)
 def test_all_selected_records_match_actual_machine_bytes(self):self.assertEqual(len(source.verify_records(self.image,self.defaults,self.loader)),28)
 def test_all_declared_function_bounds_and_table_match(self):
  r=source.function_bounds(self.data,self.defaults,self.loader);self.assertEqual(r['count'],173303);self.assertEqual(len(r['declaredBounds']),len(self.defaults['llvmRecords'])+len(self.loader['llvmRecords']));self.assertFalse(r['historicalLlvmTextReverified'])
 def test_corrupt_inline_hex_rejects(self):self.invalid(lambda p:p['instructionSpans'][0].update(hex='00'))
 def test_corrupt_inline_hash_rejects(self):self.invalid(lambda p:p['instructionSpans'][0].update(sha256='0'*64))
 def test_changed_exact_word_rejects(self):self.invalid(lambda p:p['exactWords'][0].update(word='0x0'))
 def test_changed_branch_target_rejects(self):self.invalid(lambda p:p['directBranches'][0].update(target='0x0'))
 def test_changed_type_label_rejects(self):self.invalid(lambda p:p['typeRegistrations'][0].update(name='InventedType'))
 def test_changed_object_size_rejects(self):self.invalid(lambda p:p['typeRegistrations'][0].update(size=1))
 def test_changed_field_offset_rejects(self):self.invalid(lambda p:p['fieldRegistrations'][0].update(offset=1))
 def test_changed_callback_rejects(self):self.invalid(lambda p:p['typeRegistrations'][0]['callbacks'][0].update(target='0x0'))
 def test_changed_field_wrapper_rejects(self):self.invalid(lambda p:p['fieldRegistrations'][0].update(wrapper='0x0'))
 def test_changed_function_table_hash_rejects(self):
  p=copy.deepcopy(self.defaults);p['functionStarts']['sha256']='0'*64
  with self.assertRaises(ValueError):source.function_bounds(self.data,p,self.loader)
 def test_changed_declared_function_bound_rejects(self):
  p=copy.deepcopy(self.loader);p['llvmRecords'][0]['nextFunctionStart']='0x0'
  with self.assertRaises(ValueError):source.function_bounds(self.data,self.defaults,p)
 def test_complete_masteryi_archive_matches_both_manifests(self):
  r=source.primary_archive_match();self.assertEqual(r['archive'],'DATA/FINAL/Champions/MasterYi.wad.client');self.assertTrue(r['orderedChunkIdsAndDecodedSizesIdentical']);self.assertGreater(r['chunks'],100);self.assertEqual(len(r['sequenceSha256']),64)
 def test_all_primary_emitters_use_the_registered_wire_type(self):
  r=source.primary_alignment();self.assertEqual(len(r['emitters']),11);self.assertEqual(sum(x['primitiveOmitted']for x in r['emitters']),9);self.assertEqual(sum(x['alphaRefOmitted']for x in r['emitters']),7);self.assertTrue(all(x['concreteTypeHash']=='09cde442'and x['elementWireType']==0x82 for x in r['emitters']))
if __name__=='__main__':unittest.main()
