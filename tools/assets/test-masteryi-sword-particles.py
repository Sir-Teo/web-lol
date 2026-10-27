"""Complete sword source compilation, atlas distinctions and transport guards."""
from pathlib import Path
import copy,json,runpy,unittest
from masteryi_e_particles import load
from masteryi_sword_particles import profiles
EXPORT=runpy.run_path(str(Path(__file__).with_name('export-masteryi-sword-particles.py')))
class SwordProfiles(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.pin,_=load();cls.outputs,cls.content,cls.reading=EXPORT['generate_outputs']();cls.urls={t['source']['path']:t['url']for t in cls.content['textures']};cls.defaults=json.loads(Path('docs/reference/garen-spin-defaults.json').read_text())['defaults']
 def test_complete_source_fields(self):self.assertEqual([p['explicitFields']for p in self.content['profiles']],[sorted(e)for r in self.pin['resources'].values()for e in r['definition']['complexEmitterDefinitionData']]);self.assertEqual(len(self.content['profiles']),14)
 def test_complete_output_and_mips(self):
  self.assertEqual(len(self.content['textures']),9);self.assertEqual(sum(len(t['rectangles'])for t in self.content['textures']),78)
  for p,b in self.outputs:self.assertEqual(p.read_bytes(),b)
 def test_native_bindings(self):self.assertEqual([b['glbNode']for b in self.content['bindings']],[87,88,89,90,87]);self.assertEqual(self.reading['tailTicks'],62)
 def test_raw_flare_grid_omission_stays_distinct(self):
  for p in self.content['profiles']:
   if p['name']=='Activate_Flare':self.assertEqual(p['rawUv']['numFrames'],4);self.assertIsNone(p['rawUv']['texDiv']);self.assertEqual(p['uv']['divisions'],[1,1])
   if p['name']=='beam':self.assertEqual(p['rawUv']['texDiv'],[2.,2.]);self.assertEqual(p['uv']['frames'],4)
 def invalid(self,change):
  pin=copy.deepcopy(self.pin);change(pin['resources']['MasterYi_E_SuperChraged_buf']['definition']['complexEmitterDefinitionData'])
  with self.assertRaises((ValueError,KeyError)):profiles(pin,self.urls,self.defaults)
 def test_missing_emitter(self):self.invalid(lambda e:e.pop())
 def test_unknown_field(self):self.invalid(lambda e:e[0].update(unhandled=1))
 def test_unimplemented_color(self):self.invalid(lambda e:e[0].update(Color={'constantValue':[1,0,0,1]}))
 def test_primitive(self):self.invalid(lambda e:e[0].update(primitive={'__type':'VfxPrimitiveAttachedMesh'}))
 def test_partial_bind(self):self.invalid(lambda e:e[0]['bindWeight'].update(constantValue=.5))
 def test_world_orientation(self):self.invalid(lambda e:e[0].update(particleIsLocalOrientation=0))
 def test_boolean_orientation(self):self.invalid(lambda e:e[0].update(particleIsLocalOrientation=True))
 def test_boolean_frames(self):self.invalid(lambda e:e[2].update(numFrames=True))
 def test_boolean_random_start(self):self.invalid(lambda e:e[2].update(isRandomStartFrame=True))
 def test_unhandled_uv_mode(self):self.invalid(lambda e:e[0].update(uvMode=1))
 def test_unhandled_blend_mode(self):self.invalid(lambda e:e[0].update(blendMode=3))
 def test_bad_grid(self):self.invalid(lambda e:e[3].update(texDiv=[2.,1.]))
 def test_oversized_life(self):self.invalid(lambda e:e[0]['particleLifetime'].update(constantValue=2.))
 def test_boolean_emitter_life(self):self.invalid(lambda e:e[2].update(lifetime=True))
 def test_unknown_multiplier_field(self):self.invalid(lambda e:e[0]['textureMult'].update(unhandled=1))
 def test_bad_lookup_dimension(self):self.invalid(lambda e:e[0].update(colorLookUpScales=[1]))
if __name__=='__main__':unittest.main()
