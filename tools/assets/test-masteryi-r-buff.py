"""Lossless sustained Highlander source guards."""
import copy,unittest,sys,runpy,json
from pathlib import Path
sys.path.insert(0,str(Path('tools/assets').resolve()))
from masteryi_r_particles import load
from masteryi_r_buff import selected,SYSTEMS
class BuffGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.pin,_=load();cls.export=runpy.run_path(str(Path(__file__).with_name('prepare-masteryi-r-buff.py')));cls.outputs,cls.reading=cls.export['generate_outputs']()
 def test_exact_independent_selection(self):
  result=selected(self.pin);self.assertEqual([len(result[n]['complexEmitterDefinitionData'])for n in SYSTEMS],[3,3,4]);result[SYSTEMS[0]]['complexEmitterDefinitionData'].pop();self.assertEqual(len(self.pin['resources'][SYSTEMS[0]]['definition']['complexEmitterDefinitionData']),3)
 def test_unsorted_keys_retained(self):
  for d in selected(self.pin).values():self.assertEqual(d['complexEmitterDefinitionData'][0]['Color']['dynamics']['times'],[0.,.5,.4000000059604645,1.])
 def test_source_lifetime_omissions(self):
  for d in selected(self.pin).values():self.assertEqual(d['complexEmitterDefinitionData'][0]['lifetime'],20.);self.assertNotIn('lifetime',d['complexEmitterDefinitionData'][1])
 def test_attached_overlay(self):
  e=selected(self.pin)[SYSTEMS[2]]['complexEmitterDefinitionData'][3];self.assertEqual(e['primitive'],{'mMesh':{'mLockMeshToAttachment':True,'__type':'VfxMeshDefinitionData'},'__type':'VfxPrimitiveAttachedMesh'});self.assertEqual(e['bindWeight']['dynamics']['values'],[.5,-1.5])
 def test_complete_private_delivery(self):
  outputs,r=self.outputs,self.reading;t=json.loads(Path('docs/reference/masteryi/r-buff-texture-transport.json').read_text());self.assertEqual((len(t['textures']),sum(len(x['rectangles'])for x in t['textures'])),(6,56));self.assertEqual(len(r['unsortedColorKeys']),3)
  for p,raw in outputs:self.assertEqual(p.read_bytes(),raw)
 def test_complete_raw_fields(self):
  r=self.reading;self.assertEqual(r['systems'],{n:self.pin['resources'][n]['definition']for n in SYSTEMS})
 def test_reused_private_mesh(self):
  r=self.reading;self.assertEqual((r['mesh']['sourceVertices'],r['mesh']['triangles'],r['mesh']['exportedCorners']),(27,24,72));self.assertEqual(r['mesh'],json.loads(Path('docs/reference/masteryi/q-missile-mesh-transport.json').read_text()))
 def test_raw_frame_controls(self):
  r=self.reading;fields=r['rawFrameRateCandidate']['fields'];self.assertEqual(len(fields),2);self.assertTrue(all(f['value']==2 and f['frames']==2 and f['divisions']==[2.,1.]and f['uvMode']==2 for f in fields))
 def invalid(self,change):
  pin=copy.deepcopy(self.pin);change(pin['resources'][SYSTEMS[0]]['definition'])
  with self.assertRaises((ValueError,KeyError)):selected(pin)
 def test_lost_emitter(self):self.invalid(lambda d:d['complexEmitterDefinitionData'].pop())
 def test_added_emitter(self):self.invalid(lambda d:d['complexEmitterDefinitionData'].append({}))
 def test_unknown_field(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(unhandled=1))
 def test_lost_sound(self):self.invalid(lambda d:d.pop('soundPersistentDefault'))
 def test_inferred_create_sound(self):self.invalid(lambda d:d.update(soundOnCreateDefault='guessed'))
 def test_inferred_system_flags(self):self.invalid(lambda d:d.update(flags=0))
 def test_sorted_colors(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0]['Color']['dynamics']['times'].sort())
 def test_rate_probability(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0]['rate']['dynamics']['probabilityTables'][0]['keyValues'].reverse())
 def test_numeric_boolean(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(particleIsLocalOrientation=True))
 def test_uv_mode(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(uvMode=0))
 def test_atlas_frames(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(numFrames=1))
 def test_atlas_grid(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(texDiv=[1.,2.]))
 def test_raw_frame_rate(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update({'{9b111ae4}':3.}))
 def test_layer_omission(self):
  pin=copy.deepcopy(self.pin);pin['resources'][SYSTEMS[1]]['definition']['complexEmitterDefinitionData'][2].pop('textureMult')
  with self.assertRaises(ValueError):selected(pin)
 def test_inferred_lifetime(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][1].update(lifetime=7.))
 def test_missing_lifetime(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].pop('lifetime'))
 def test_shader_flag(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(meshRenderFlags=8))
 def test_primitive(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0]['primitive'].update(__type='billboard'))
if __name__=='__main__':unittest.main()
