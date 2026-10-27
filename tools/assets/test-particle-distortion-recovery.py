"""Exact shader recovery, parser-corruption, conflict and offline replay guards."""
from pathlib import Path
import copy,json,struct,tempfile,unittest
from unittest.mock import patch
import particle_distortion_recovery as source

class ShaderRecoveryGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.pin=source.load();cls.payloads={r['path']:source.target(r).read_bytes()for r in source.rows(cls.pin)}
  cls.table=cls.pin['programs'][0]['table'];cls.toc=cls.payloads[str(source.CACHE/'native'/cls.table)];cls.bundle=cls.payloads[str(source.CACHE/'native'/(cls.table+'_0'))]
 def test_complete_original_hashes_and_structural_closure_match(self):
  self.assertEqual(source.check(self.pin),{'nativeResources':8,'metalPrograms':15,'bitcodePayloads':15,'exactDisassemblyPayloads':15,'canonicalPayloads':53,'nativeExecuted':False,'originalPinsChanged':False})
 def test_bad_source_pin_rejects(self):
  with tempfile.TemporaryDirectory()as temp:
   path=Path(temp)/'pin.json';path.write_bytes(b'{}')
   with self.assertRaisesRegex(ValueError,'Frozen distortion pin'):source.load(path)
 def test_payload_closure_is_exact(self):
  for mutate in [lambda p:p.pop(next(iter(p))),lambda p:p.update(unpinned=b'')]:
   payloads=dict(self.payloads);mutate(payloads)
   with self.assertRaisesRegex(ValueError,'payload closure'):source.verify(self.pin,payloads)
 def test_resource_byte_corruption_rejects_before_publication(self):self.reject_payload(str(source.CACHE/'native'/self.table))
 def test_metal_byte_corruption_rejects_before_publication(self):self.reject_payload(self.pin['programs'][0]['metallib']['path'])
 def test_bitcode_byte_corruption_rejects_before_publication(self):self.reject_payload(self.pin['programs'][0]['bitcode']['path'])
 def test_last_disassembly_corruption_cannot_publish_partial_closure(self):self.reject_payload(self.pin['programs'][-1]['disassembly']['path'])
 def reject_payload(self,path):
  payloads=dict(self.payloads);raw=bytearray(payloads[path]);raw[-1]^=1;payloads[path]=bytes(raw)
  with tempfile.TemporaryDirectory()as temp:
   with self.assertRaisesRegex(ValueError,'Frozen shader payload'):source.publish(self.pin,payloads,Path(temp))
   self.assertEqual([p for p in Path(temp).rglob('*')if p.is_file()],[])
 def test_late_existing_conflict_prevents_all_other_publication(self):
  with tempfile.TemporaryDirectory()as temp:
   root=Path(temp);last=source.rows(self.pin)[-1];path=source.target(last,root);path.parent.mkdir(parents=True);path.write_bytes(b'conflict');before=path.stat().st_mtime_ns
   with self.assertRaisesRegex(ValueError,'Frozen shader payload'):source.publish(self.pin,self.payloads,root)
   self.assertEqual([p for p in root.rglob('*')if p.is_file()],[path]);self.assertEqual(path.read_bytes(),b'conflict');self.assertEqual(path.stat().st_mtime_ns,before)
 def test_publication_replays_without_network_compiler_or_timestamp_changes(self):
  with tempfile.TemporaryDirectory()as temp:
   root=Path(temp);source.publish(self.pin,self.payloads,root)
   def snapshot():return{r['path']:(source.target(r,root).read_bytes(),source.target(r,root).stat().st_mtime_ns)for r in source.rows(self.pin)}
   before=snapshot()
   with patch.object(source,'download_inputs',side_effect=AssertionError('unexpected network')),patch.object(source,'reconstruct',side_effect=AssertionError('unexpected reconstruction')),patch.object(source,'disassemble',side_effect=AssertionError('unexpected compiler')):
    result=source.restore(self.pin,root=root)
   self.assertTrue(result['alreadyComplete']);self.assertEqual(result['downloads'],[]);self.assertEqual(result['compilerRuns'],[]);self.assertEqual(snapshot(),before)
 def test_table_trailing_bytes_reject(self):
  with self.assertRaisesRegex(ValueError,'TOC inventory'):source.toc(self.toc+b'\0')
 def test_changed_combination_hash_rejects(self):
  r=source.Reader(self.toc);r.string();count,defines,bundles,stage=r.read('4I');r.string()
  for _ in range(defines):r.string();r.string()
  r.string();raw=bytearray(self.toc);raw[r.offset]^=1
  with self.assertRaisesRegex(ValueError,'combination hash'):source.toc(bytes(raw))
 def test_duplicate_program_index_rejects(self):
  raw=bytearray(self.toc);raw[-4:]=raw[-8:-4]
  with self.assertRaisesRegex(ValueError,'TOC inventory'):source.toc(bytes(raw))
 def test_program_truncation_rejects(self):
  with self.assertRaisesRegex(ValueError,'Truncated native Metal'):source.programs(self.bundle[:-1])
 def test_program_magic_rejects(self):
  raw=bytearray(self.bundle);raw[4]^=1
  with self.assertRaisesRegex(ValueError,'Metal magic'):source.programs(bytes(raw))
 def test_short_table_string_rejects(self):
  with self.assertRaisesRegex(ValueError,'Truncated shader table string'):source.toc(struct.pack('<I',100)+b'a')
 def test_static_compiler_mismatch_remains_in_staging(self):
  payloads={k:v for k,v in self.payloads.items()if not k.endswith('.ll')}
  def changed(command,**kwargs):
   Path(command[-1]).write_bytes(b'nonmatching text')
   from subprocess import CompletedProcess
   return CompletedProcess(command,0,'','')
  with tempfile.TemporaryDirectory()as temp,patch.object(source.subprocess,'run',side_effect=changed):
   with self.assertRaisesRegex(ValueError,'Frozen shader payload'):source.disassemble(self.pin,payloads,Path(temp),'unused-static-compiler')
   self.assertFalse((Path(temp)/source.CACHE).exists())
 def test_unsafe_target_path_rejects(self):
  for path in ['/tmp/shader.bc','../shader.bc','.cache/particle-distortion-shaders/../../shader.bc']:
   with self.subTest(path=path),self.assertRaisesRegex(ValueError,'Invalid shader evidence target'):source.target({'path':path})
if __name__=='__main__':unittest.main()
