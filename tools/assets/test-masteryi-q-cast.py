"""Exact Q cast closure, finite transport, and unreviewed-source guards."""
from pathlib import Path
import copy,json,runpy,unittest
from masteryi_q_particles import load
from masteryi_q_cast import profiles,binhash
EXPORT=runpy.run_path(str(Path(__file__).with_name('export-masteryi-q-cast-particles.py')))
class CastGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.pin,_=load();cls.outputs,cls.content,cls.reading=EXPORT['generate_outputs']();cls.textures={t['source']['path']:t['url']for t in cls.content['textures']};cls.defaults=json.loads(Path('docs/reference/garen-spin-defaults.json').read_text())['defaults']
 def test_complete_delivery(self):
  self.assertEqual(len(self.content['profiles']),2);self.assertEqual(len(self.content['textures']),4);self.assertEqual(sum(len(t['rectangles'])for t in self.content['textures']),35);self.assertEqual(self.reading['historyTicks'],15)
  emitters=self.pin['resources']['MasterYi_Q_Cas']['definition']['complexEmitterDefinitionData'];self.assertEqual([p['explicitFields']for p in self.content['profiles']],[sorted(e)for e in emitters])
 def test_export_reuses_two_exact_existing_transports(self):
  for path,raw in self.outputs:self.assertEqual(path.read_bytes(),raw)
  self.assertEqual(sum('masteryi-q-contact-'in t['url']for t in self.content['textures']),2)
 def test_raw_frame_rate_hash_is_retained(self):
  self.assertEqual(binhash('frameRate'),'{9b111ae4}');self.assertIn('{9b111ae4}',self.content['profiles'][0]['explicitFields']);self.assertNotIn('frameRate',self.content['profiles'][0]['explicitFields']);self.assertEqual([p['uv']['frameRate']for p in self.content['profiles']],[10,0])
 def invalid(self,change):
  pin=copy.deepcopy(self.pin);change(pin['resources']['MasterYi_Q_Cas']['definition'])
  with self.assertRaises((ValueError,KeyError)):profiles(pin,self.textures,self.defaults)
 def test_lost_emitter(self):self.invalid(lambda d:d['complexEmitterDefinitionData'].pop())
 def test_new_field(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(unhandled=1))
 def test_new_primitive(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(primitive={'__type':'Unknown'}))
 def test_changed_frame_rate(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update({'{9b111ae4}':11}))
 def test_changed_atlas(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(texDiv=[4,1]))
 def test_changed_frames(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(numFrames=3))
 def test_shape_field(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0]['SpawnShape'].update(radius=4))
 def test_render_flags(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(meshRenderFlags=8))
 def test_system_flags(self):self.invalid(lambda d:d.update(flags=0))
 def test_sound_binding(self):self.invalid(lambda d:d.update(soundOnCreateDefault='invented'))
 def test_animated_rate(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(rate={'dynamics':{'times':[0,1],'values':[24,30]}}))
if __name__=='__main__':unittest.main()
