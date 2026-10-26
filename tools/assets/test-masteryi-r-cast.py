"""Complete Highlander cast delivery and fail-closed source projection guards."""
from pathlib import Path
import copy,json,runpy,unittest
from masteryi_r_particles import load
from masteryi_r_cast import profiles
EXPORT=runpy.run_path(str(Path(__file__).with_name('export-masteryi-r-cast-particles.py')))
class CastGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.pin,_=load();cls.outputs,cls.content,cls.reading=EXPORT['generate_outputs']();cls.textures={t['source']['path']:t['url']for t in cls.content['textures']};cls.meshes={m['source']['path']:m['url']for m in cls.content['meshes']};cls.defaults=json.loads(Path('docs/reference/garen-spin-defaults.json').read_text())['defaults']
 def test_complete_source_and_delivery(self):
  self.assertEqual((len(self.content['profiles']),len(self.content['textures']),len(self.content['meshes'])),(8,10,2));self.assertEqual(sum(len(t['rectangles'])for t in self.content['textures']),86);self.assertEqual(self.reading['historyTicks'],27)
  native=self.pin['resources']['MasterYi_R_Cas']['definition']['complexEmitterDefinitionData'];self.assertEqual([p['explicitFields']for p in self.content['profiles']],[sorted(e)for e in native])
 def test_exact_output_bytes_and_four_reused_transports(self):
  for p,raw in self.outputs:self.assertEqual(p.read_bytes(),raw)
  self.assertEqual(sum('masteryi-r-cast-'in t['url']for t in self.content['textures']),6)
 def test_both_native_meshes_keep_exact_corners_and_flags(self):self.assertEqual([(m['sourceVertices'],m['triangles'],m['exportedCorners'],m['flags'])for m in self.content['meshes']],[(1440,480,1440,1),(161,300,900,5)])
 def test_omitted_lens_lifetime_and_authored_delay_stay_distinct(self):
  p=self.content['profiles'];self.assertIsNone(p[4]['emitterLife']);self.assertNotIn('lifetime',p[4]['explicitFields']);self.assertEqual(p[5]['delay'],0.10000000149011612);self.assertIn('timeBeforeFirstEmission',p[5]['explicitFields'])
 def test_distortion_is_raw_and_source_sound_stays_omitted(self):
  self.assertEqual(self.content['profiles'][6]['distortion']['strength'],1);self.assertEqual(self.content['profiles'][6]['distortion']['mode'],2);self.assertFalse(any(k.lower().startswith('sound')for k in self.pin['resources']['MasterYi_R_Cas']['definition']))
 def invalid(self,change):
  pin=copy.deepcopy(self.pin);change(pin['resources']['MasterYi_R_Cas']['definition'])
  with self.assertRaises((ValueError,KeyError)):profiles(pin,self.textures,self.meshes,self.defaults)
 def test_lost_emitter(self):self.invalid(lambda d:d['complexEmitterDefinitionData'].pop())
 def test_unknown_field(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(unhandled=1))
 def test_unknown_primitive(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0]['primitive'].update(__type='Unknown'))
 def test_wrong_mesh(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0]['primitive']['mMesh'].update(mSimpleMeshName='Unknown.scb'))
 def test_new_shape(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][3]['SpawnShape'].update(radius=3))
 def test_render_flags(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][7].update(meshRenderFlags=8))
 def test_uv_mode(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][4].update(uvMode=2))
 def test_distortion_mode(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][6]['distortionDefinition'].update(distortionMode=1))
 def test_distortion_power(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][6]['distortionDefinition'].update(distortion=0.5))
 def test_new_system_flags(self):self.invalid(lambda d:d.update(flags=0))
 def test_inferred_sound(self):self.invalid(lambda d:d.update(soundPersistentDefault='Play_sfx_MasterYi_Highlander_trail'))
 def test_missing_continuous_lifetime(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][1].pop('lifetime'))
 def test_negative_delay(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][5].update(timeBeforeFirstEmission=-1))
 def test_boolean_delay(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][5].update(timeBeforeFirstEmission=True))
 def test_boolean_lifetime(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(lifetime=True))
if __name__=='__main__':unittest.main()
