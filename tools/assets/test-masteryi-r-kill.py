"""Complete Highlander takedown delivery and fail-closed projection guards."""
from pathlib import Path
import copy,json,runpy,unittest
from masteryi_r_particles import load
from masteryi_r_kill import profiles
EXPORT=runpy.run_path(str(Path(__file__).with_name('export-masteryi-r-kill-particles.py')))
class KillGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.pin,_=load();cls.outputs,cls.content,cls.reading=EXPORT['generate_outputs']();cls.textures={t['source']['path']:t['url']for t in cls.content['textures']};cls.meshes={'assets/characters/masteryi/skins/base/particles/common_hecarim_qtrail.scb':cls.content['mesh']['url']};cls.defaults=json.loads(Path('docs/reference/garen-spin-defaults.json').read_text())['defaults']
 def test_complete_source_and_delivery(self):
  self.assertEqual((len(self.content['profiles']),len(self.content['textures'])),(3,5));self.assertEqual(sum(len(t['rectangles'])for t in self.content['textures']),42);self.assertEqual(self.reading['historyTicks'],88)
  native=self.pin['resources']['MasterYi_R_OnBuffKill']['definition']['complexEmitterDefinitionData'];self.assertEqual([p['explicitFields']for p in self.content['profiles']],[sorted(e)for e in native])
 def test_exact_outputs_and_shared_mesh(self):
  for p,raw in self.outputs:self.assertEqual(p.read_bytes(),raw)
  self.assertEqual(self.content['mesh'],json.loads(Path('src/content/masteryi-q-contact-particles.json').read_text())['mesh']);self.assertEqual(sum('masteryi-r-kill-'in t['url']for t in self.content['textures']),3)
 def test_raw_controls(self):
  p=self.content['profiles'];self.assertEqual([x['renderOrder']for x in p],[-13,100,0]);self.assertEqual(p[1]['uv']['birthScroll']['values'][0],[3,0]);self.assertTrue(p[1]['noCull']);self.assertTrue(p[2]['uniform']);self.assertEqual(p[2]['life']['values'][0][0],0.949999988079071);self.assertIsNone(p[0]['lookup'])
 def invalid(self,change):
  pin=copy.deepcopy(self.pin);change(pin['resources']['MasterYi_R_OnBuffKill']['definition'])
  with self.assertRaises((ValueError,KeyError)):profiles(pin,self.textures,self.meshes,self.defaults)
 def test_lost_emitter(self):self.invalid(lambda d:d['complexEmitterDefinitionData'].pop())
 def test_unknown_field(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(unhandled=1))
 def test_unknown_primitive(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][1]['primitive'].update(__type='Unknown'))
 def test_wrong_mesh(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][1]['primitive']['mMesh'].update(mSimpleMeshName='Unknown.scb'))
 def test_new_shape(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].setdefault('SpawnShape',{}).update(radius=3))
 def test_render_flags(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(meshRenderFlags=8))
 def test_uv_mode(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][1].update(uvMode=2))
 def test_distortion(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(distortionDefinition={'distortionMode':2}))
 def test_system_flags(self):self.invalid(lambda d:d.update(flags=0))
 def test_inferred_sound(self):self.invalid(lambda d:d.update(soundOnCreateDefault='invented'))
 def test_missing_continuous_lifetime(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][1].pop('lifetime'))
 def test_negative_delay(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(timeBeforeFirstEmission=-1))
 def test_boolean_delay(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(timeBeforeFirstEmission=True))
 def test_boolean_lifetime(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(lifetime=True))
if __name__=='__main__':unittest.main()
