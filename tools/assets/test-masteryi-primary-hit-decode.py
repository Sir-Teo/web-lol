"""Complete private primary contact mip decode and independent replay guards."""
from pathlib import Path
import builtins,copy,json,runpy,sys,tempfile,unittest
from unittest.mock import patch
from masteryi_primary_hits import SOURCE_ROOT
from masteryi_q_decode import sha
ROOT=Path(__file__).parent
MODULE=runpy.run_path(str(ROOT/'decode-masteryi-primary-hits.py'))
class ActualDecode(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.record=json.loads(MODULE['RECORD'].read_text())
 def test_all_mips_check_without_pillow_or_cdtb(self):
  original=builtins.__import__
  def guard(name,*args,**kwargs):
   if name.split('.')[0]in {'PIL','cdtb'}:raise AssertionError('Independent checker imported producer dependency')
   return original(name,*args,**kwargs)
  with patch('builtins.__import__',guard):record=MODULE['check_record']()
  self.assertEqual((len(record['textures']),sum(len(t['levels'])for t in record['textures']),len(record['meshes'])),(11,93,0));self.assertEqual(sum(m['width']*m['height']*4 for t in record['textures']for m in t['levels']),4767732)
 def test_all_texture_formats_and_no_meshes_stay_explicit(self):self.assertEqual(sorted(t['format']for t in self.record['textures']),[10]*6+[12]*5);self.assertEqual(self.record['meshes'],[])
 def test_shared_q_w_r_texture_blocks_pixels_and_pngs_are_exact(self):
  for system in ['q', 'w', 'r', 'e', 'attack-trail']:
   other=json.loads(Path(f'docs/reference/masteryi/{system}-particles-decoded.json').read_text());by={t['source']['path']:t for t in other['textures']};shared=[t for t in self.record['textures']if t['source']['path']in by];self.assertEqual(len(shared),{'q': 4, 'w': 2, 'r': 3, 'e': 1, 'attack-trail': 1}[system])
   for t in shared:
    self.assertEqual(t['source'],by[t['source']['path']]['source']);self.assertEqual([{k:v for k,v in m.items()if k!='path'}for m in t['levels']],[{k:v for k,v in m.items()if k!='path'}for m in by[t['source']['path']]['levels']])
 def test_zero_mesh_profile_keeps_the_shared_two_mesh_default(self):
  with self.assertRaisesRegex(ValueError,'mesh closure'):MODULE['engine']['check_record'](MODULE['RECORD'],SOURCE_ROOT,MODULE['RECORD_SHA256'],source_load=MODULE['load'],source_pin_sha256=MODULE['PIN_SHA256'],texture_count=11)
 def invalid_record(self,change,pattern):
  record=copy.deepcopy(self.record);change(record)
  with tempfile.TemporaryDirectory()as temp:
   path=Path(temp)/'record.json';raw=(json.dumps(record)+'\n').encode();path.write_bytes(raw)
   with self.assertRaisesRegex(ValueError,pattern):MODULE['check_record'](path,SOURCE_ROOT,sha(raw))
 def test_missing_texture_rejects(self):self.invalid_record(lambda r:r['textures'].pop(),'closure')
 def test_invented_mesh_rejects(self):self.invalid_record(lambda r:r['meshes'].append({}),'closure')
 def test_missing_mip_rejects(self):self.invalid_record(lambda r:r['textures'][0]['levels'].pop(),'mips')
 def test_shifted_compressed_range_rejects(self):self.invalid_record(lambda r:r['textures'][0]['levels'][0].update(sourceOffset=12),'source range')
 def test_fabricated_source_pin_rejects(self):self.invalid_record(lambda r:r.update(sourcePinSha256='0'*64),'source/layout')
 def test_wrong_pixel_digest_rejects(self):self.invalid_record(lambda r:r['textures'][0]['levels'][0].update(rgbaSha256='0'*64),'pixels')
 def test_wrong_alpha_statistics_rejects(self):self.invalid_record(lambda r:r['textures'][0]['levels'][0].update(transparentPixels=-1),'alpha statistics')
 def test_unreviewed_record_hash_rejects(self):
  with self.assertRaisesRegex(ValueError,'Frozen particle input'):MODULE['check_record'](record_sha256='0'*64)
 def test_conflicts_checked_before_writing_any_missing_output(self):
  with tempfile.TemporaryDirectory()as temp:
   root=Path(temp);missing=root/'new.png';conflict=root/'old.png';record=root/'record.json';conflict.write_bytes(b'original');before=conflict.stat().st_mtime_ns
   generate=lambda *args: ([(missing,b'new'),(conflict,b'expected')],self.record)
   with patch.dict(MODULE['main'].__globals__,{'generate':generate}),patch.object(sys,'argv',['decode','--record',str(record)]):
    with self.assertRaisesRegex(ValueError,'Conflicting decoded output'):MODULE['main']()
   self.assertFalse(missing.exists());self.assertFalse(record.exists());self.assertEqual(conflict.read_bytes(),b'original');self.assertEqual(conflict.stat().st_mtime_ns,before)
if __name__=='__main__':unittest.main()
