"""Private attack-trail mip/mesh transport and independent replay guards."""
from pathlib import Path
import builtins,copy,json,runpy,sys,tempfile,unittest
from unittest.mock import patch
from masteryi_attack_trails import SOURCE_ROOT,load,cache_path
from masteryi_q_particles import cache_path as particle_cache_path
from masteryi_q_decode import sha
ROOT=Path(__file__).parent
MODULE=runpy.run_path(str(ROOT/'decode-masteryi-attack-trails.py'))
class ActualDecode(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.record=json.loads(MODULE['RECORD'].read_text())
 def test_all_mips_check_without_pillow_or_cdtb(self):
  original=builtins.__import__
  def guard(name,*args,**kwargs):
   if name.split('.')[0]in {'PIL','cdtb'}:raise AssertionError('Independent checker imported producer dependency')
   return original(name,*args,**kwargs)
  with patch('builtins.__import__',guard):record=MODULE['check_record']()
  self.assertEqual((len(record['textures']),sum(len(t['levels'])for t in record['textures']),len(record['meshes'])),(4,34,1));self.assertEqual(sum(m['width']*m['height']*4 for t in record['textures']for m in t['levels']),1070416)
 def test_texture_formats_and_mesh_transport_stay_explicit(self):
  self.assertEqual([t['format']for t in self.record['textures']],[10]*4)
  mesh=self.record['meshes'][0];self.assertEqual((mesh['sourceVertices'],mesh['triangles'],mesh['flags']),(250,500,5));self.assertEqual(len(bytes.fromhex(mesh['tailHex'])),24);self.assertIs(mesh['normalsGenerated'],False);self.assertEqual(mesh['unitScaleApplied'],1)
 def test_shared_q_w_r_texture_blocks_pixels_and_pngs_are_exact(self):
  for system in ['q','w','r','e']:
   other=json.loads(Path(f'docs/reference/masteryi/{system}-particles-decoded.json').read_text());by={t['source']['path']:t for t in other['textures']};shared=[t for t in self.record['textures']if t['source']['path']in by];self.assertEqual(len(shared),1)
   for t in shared:
    self.assertEqual(t['source'],by[t['source']['path']]['source']);self.assertEqual([{k:v for k,v in m.items()if k!='path'}for m in t['levels']],[{k:v for k,v in m.items()if k!='path'}for m in by[t['source']['path']]['levels']])
 def test_one_mesh_profile_keeps_the_shared_two_mesh_default(self):
  pin,model=MODULE['source_profile'](SOURCE_ROOT)
  with self.assertRaisesRegex(ValueError,'mesh closure'):MODULE['engine']['check_record'](MODULE['RECORD'],SOURCE_ROOT,MODULE['RECORD_SHA256'],source_load=lambda:(pin,model),source_pin_sha256=MODULE['PIN_SHA256'],texture_count=4)
 def test_animation_check_preserves_the_particle_extension_guard(self):
  pin,_=load();anm=next(r for r in pin['extraction']['files']if r['path'].endswith('.anm'))
  with self.assertRaisesRegex(ValueError,'extension'):particle_cache_path(SOURCE_ROOT,anm)
  filtered,_=MODULE['source_profile'](SOURCE_ROOT);self.assertFalse(any(r['path'].endswith('.anm')for r in filtered['extraction']['files']))
 def test_modified_animation_rejects_even_though_it_is_not_a_decode_output(self):
  pin,_=load()
  with tempfile.TemporaryDirectory()as temp:
   root=Path(temp)
   for row in pin['extraction']['files']:cache_path(root,row).write_bytes(cache_path(SOURCE_ROOT,row).read_bytes())
   anm=next(r for r in pin['extraction']['files']if r['path'].endswith('.anm'));path=cache_path(root,anm);raw=path.read_bytes();path.write_bytes(bytes([raw[0]^1])+raw[1:])
   with self.assertRaisesRegex(ValueError,'Frozen particle input'):MODULE['check_record'](sources=root)
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
 def invalid_mesh(self,change,pattern):
  record=copy.deepcopy(self.record);mesh=record['meshes'][0];data=json.loads(Path(mesh['path']).read_text());change(data)
  with tempfile.TemporaryDirectory()as temp:
   path=Path(temp)/'mesh.json';raw=(json.dumps(data)+'\n').encode();path.write_bytes(raw);mesh.update(path=str(path),bytes=len(raw),sha256=sha(raw));rpath=Path(temp)/'record.json';rraw=(json.dumps(record)+'\n').encode();rpath.write_bytes(rraw)
   with self.assertRaisesRegex(ValueError,pattern):MODULE['check_record'](rpath,SOURCE_ROOT,sha(rraw))
 def test_missing_mesh_rejects(self):self.invalid_record(lambda r:r['meshes'].pop(),'closure')
 def test_changed_mesh_points_reject(self):self.invalid_mesh(lambda m:m['sourcePoints'][0].__setitem__(0,m['sourcePoints'][0][0]+1),'round trip')
 def test_changed_face_stream_rejects(self):self.invalid_mesh(lambda m:m.update(sourceFaceRgbHex=('ff'if m['sourceFaceRgbHex'][:2]!='ff'else'00')+m['sourceFaceRgbHex'][2:]),'round trip')
 def test_changed_opaque_tail_rejects(self):self.invalid_mesh(lambda m:m.update(tailHex=('ff'if m['tailHex'][:2]!='ff'else'00')+m['tailHex'][2:]),'round trip')
 def test_typed_zero_coordinate_rejects_boolean(self):self.invalid_mesh(lambda m:m['sourceBounds'].__setitem__(0,False),'typed native mesh')
 def test_mesh_metadata_mismatch_rejects(self):self.invalid_record(lambda r:r['meshes'][0].update(sourceVertices=251),'metadata')
 def test_invented_normals_rejects(self):self.invalid_record(lambda r:r['meshes'][0].update(normalsGenerated=True),'transport policy')
 def test_invented_scale_rejects(self):self.invalid_record(lambda r:r['meshes'][0].update(unitScaleApplied=.01),'transport policy')
 def test_changed_mesh_digest_rejects(self):self.invalid_record(lambda r:r['meshes'][0].update(sourceFaceRgbSha256='0'*64),'stream digest')
 def test_changed_animation_policy_rejects(self):self.invalid_record(lambda r:r['animationSourcePolicy'].update(sharedParticleExtensionGuardUnchanged=1),'animation source policy')
if __name__=='__main__':unittest.main()
