"""Complete Meditate damage projection and shared transport guards."""
from pathlib import Path
import copy,json,runpy,unittest
from masteryi_w_particles import load
from masteryi_w_damage import profiles
ROOT=Path(__file__).parent
EXPORT=runpy.run_path(str(ROOT/'export-masteryi-w-damage-particles.py'))
class DamageGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.pin,_=load();cls.outputs,cls.content,cls.reading=EXPORT['generate_outputs']();cls.textures={t['source']['path']:t['url']for t in cls.content['textures']};cls.defaults=json.loads(Path('docs/reference/garen-spin-defaults.json').read_text())['defaults']
 def test_complete_source(self):
  e=self.pin['resources']['MasterYi_W_Dmg']['definition']['complexEmitterDefinitionData'];self.assertEqual([p['explicitFields']for p in self.content['profiles']],[sorted(x)for x in e]);self.assertEqual([p['kind']for p in self.content['profiles']],['billboard','billboard'])
 def test_complete_shared_texture_closure(self):
  q=json.loads(Path('src/content/masteryi-q-contact-particles.json').read_text());self.assertEqual((len(self.content['textures']),sum(len(t['rectangles'])for t in self.content['textures'])),(4,32))
  for t in self.content['textures']:self.assertTrue(any((t['url'],t['sha256'],t['bytes'])==(x['url'],x['sha256'],x['bytes'])for x in q['textures']))
 def test_finite_bound(self):self.assertEqual(self.reading['historyTicks'],15);self.assertEqual([p['life']['values'][0][0]for p in self.content['profiles']],[.20000000298023224,.11999999731779099])
 def test_source_modes(self):
  p=self.content['profiles'];self.assertEqual([x['miscRenderFlags']for x in p],[1,0]);self.assertEqual([x['renderOrder']for x in p],[30,0]);self.assertEqual([x['bind']['values'][0][0]for x in p],[1,0]);self.assertNotIn('bindWeight',p[1]['explicitFields']);self.assertNotIn('blendMode',p[0]['explicitFields'])
 def test_complete_output_set(self):
  self.assertEqual(len(self.outputs),7);self.assertEqual(sum(str(p).startswith('public/')for p,_ in self.outputs),4)
  for p,raw in self.outputs:self.assertEqual(p.read_bytes(),raw)
 def invalid(self,change):
  pin=copy.deepcopy(self.pin);change(pin['resources']['MasterYi_W_Dmg']['definition'])
  with self.assertRaises((ValueError,KeyError)):profiles(pin,self.textures,self.defaults)
 def test_lost_emitter(self):self.invalid(lambda d:d['complexEmitterDefinitionData'].pop())
 def test_unknown_field(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(unhandled=1))
 def test_primitive(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(primitive={'__type':'VfxPrimitiveMesh'}))
 def test_shape(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][1]['SpawnShape'].update(radius=3))
 def test_mesh_flags(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(meshRenderFlags=8))
 def test_misc_flags(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(miscRenderFlags=2))
 def test_uv_mode(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(uvMode=2))
 def test_distortion(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(distortionDefinition={'distortionMode':2}))
 def test_system_flags(self):self.invalid(lambda d:d.update(flags=0))
 def test_inferred_sound(self):self.invalid(lambda d:d.update(soundOnCreateDefault='invented'))
 def test_missing_continuous_lifetime(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][1].pop('lifetime'))
 def test_negative_delay(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(timeBeforeFirstEmission=-1))
 def test_boolean_delay(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(timeBeforeFirstEmission=True))
 def test_boolean_lifetime(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(lifetime=True))
if __name__=='__main__':unittest.main()
