"""Exact Q reappearance source fields and fail-closed private transport guards."""
from pathlib import Path
import copy,json,runpy,unittest
from masteryi_q_particles import load
from masteryi_q_end import profiles,binhash
EXPORT=runpy.run_path(str(Path(__file__).with_name('prepare-masteryi-q-end.py')))
class CastGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.pin,_=load();cls.outputs,cls.reading=EXPORT['generate_outputs']();cls.content={'profiles':cls.reading['profiles'],'textures':cls.reading['privateTextures']};cls.textures={t['source']['path']:t['source']['path']for t in cls.content['textures']};cls.defaults=json.loads(Path('docs/reference/garen-spin-defaults.json').read_text())['defaults']
 def test_complete_delivery(self):
  self.assertEqual(len(self.content['profiles']),2);self.assertEqual(len(self.content['textures']),5);self.assertEqual(sum(len(t['rectangles'])for t in self.content['textures']),41);self.assertEqual(self.reading['historyTicks'],18)
  emitters=self.pin['resources']['MasterYi_Q_End']['definition']['complexEmitterDefinitionData'];self.assertEqual([p['explicitFields']for p in self.content['profiles']],[sorted(e)for e in emitters])
 def test_source_outputs_are_exact_without_public_assets(self):
  for path,raw in self.outputs:
   self.assertEqual(path.read_bytes(),raw);self.assertTrue(str(path).startswith('docs/reference/'))
  self.assertFalse(self.reading['onCreateSoundAuthored'])
  self.assertEqual([p['bind']['values'][0][0]for p in self.content['profiles']],[1,0])
 def test_raw_distortion_phase_and_strength_are_retained(self):
  d=self.content['profiles'][1]['distortion'];self.assertEqual(d['mode'],2);self.assertEqual(d['strength'],0.09000000357627869);self.assertTrue(d['texture'].endswith('common_distort-heat.tex'))
 def test_raw_frame_rate_hash_is_retained(self):
  self.assertEqual(binhash('frameRate'),'{9b111ae4}');self.assertIn('{9b111ae4}',self.content['profiles'][0]['explicitFields']);self.assertNotIn('frameRate',self.content['profiles'][0]['explicitFields']);self.assertEqual([p['uv']['frameRate']for p in self.content['profiles']],[10,0])
 def invalid(self,change):
  pin=copy.deepcopy(self.pin);change(pin['resources']['MasterYi_Q_End']['definition'])
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
 def test_invented_sound_binding(self):self.invalid(lambda d:d.update(soundOnCreateDefault='invented'))
 def test_changed_distortion_mode(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][1]['distortionDefinition'].update(distortionMode=1))
 def test_changed_distortion_strength(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][1]['distortionDefinition'].update(distortion=0.1))
 def test_unknown_distortion_field(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][1]['distortionDefinition'].update(unhandled=1))
 def test_changed_blend(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][1].update(blendMode=0))
 def test_animated_rate(self):self.invalid(lambda d:d['complexEmitterDefinitionData'][0].update(rate={'dynamics':{'times':[0,1],'values':[24,30]}}))
if __name__=='__main__':unittest.main()
