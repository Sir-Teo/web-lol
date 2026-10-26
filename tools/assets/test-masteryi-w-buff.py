"""Complete W_Buf delivery and fail-closed field/atlas/shape guards."""
from pathlib import Path
import copy,json,runpy,unittest
from masteryi_w_particles import load
from masteryi_w_buff import profiles
EXPORT=runpy.run_path(str(Path(__file__).with_name('export-masteryi-w-buff-particles.py')))
class BuffGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.pin,_=load();cls.outputs,cls.content,cls.reading=EXPORT['generate_outputs']()
  cls.textures={t['source']['path']:t['url'] for t in cls.content['textures']}
  cls.defaults=json.loads(Path('docs/reference/garen-spin-defaults.json').read_text())['defaults']
 def invalid(self,change):
  pin=copy.deepcopy(self.pin);change(pin['resources']['MasterYi_W_Buf']['definition']['complexEmitterDefinitionData'])
  with self.assertRaises((ValueError,KeyError)):profiles(pin,self.textures,self.content['mesh']['url'],self.defaults)
 def test_complete_closure(self):
  self.assertEqual(len(self.content['profiles']),4);self.assertEqual(len(self.content['textures']),6)
  self.assertEqual(sum(len(t['rectangles'])for t in self.content['textures']),54)
  self.assertEqual(self.reading['historyTicks'],361);self.assertEqual(self.reading['tailTicks'],121)
  native=self.pin['resources']['MasterYi_W_Buf']['definition']['complexEmitterDefinitionData']
  self.assertEqual([p['explicitFields']for p in self.content['profiles']],[sorted(e)for e in native])
 def test_exact_delivery(self):
  for path,raw in self.outputs:self.assertEqual(path.read_bytes(),raw)
  self.assertEqual(sum('masteryi-w-cast-' in t['url']for t in self.content['textures']),2)
 def test_source_atlas(self):
  ray,orb,*_=self.content['profiles'];self.assertEqual(ray['uv']['startFrame'],3)
  self.assertEqual(ray['uv']['divisions'],[2,2]);self.assertFalse(ray['local'])
  self.assertEqual(orb['uv']['frames'],8);self.assertTrue(orb['uv']['randomStart'])
 def test_source_fields(self):
  p=self.content['profiles'][-1];self.assertEqual(p['attraction']['position']['values'],[[0,150,0]])
  self.assertEqual(p['attraction']['radius']['values'],[[200]])
  self.assertEqual(p['attraction']['strength']['values'],[[100]])
  self.assertEqual(p['orbitalField'],{'axis':[0,1,0],'localSpace':False,'directionAuthored':False})
  self.assertEqual(p['shape']['axes'],[[0,1.0000001192092896,0]])
 def test_lost_emitter(self):self.invalid(lambda e:e.pop())
 def test_unknown_field(self):self.invalid(lambda e:e[0].update(unknown=1))
 def test_unknown_primitive(self):self.invalid(lambda e:e[0].update(primitive={'__type':'Unknown'}))
 def test_wrong_mesh(self):self.invalid(lambda e:e[1]['primitive']['mMesh'].update(mSimpleMeshName='Wrong.scb'))
 def test_unknown_shape(self):self.invalid(lambda e:e[-1]['SpawnShape'].update(radius=1))
 def test_rotation_extent(self):self.invalid(lambda e:e[-1]['SpawnShape']['emitRotationAxes'].pop())
 def test_zero_atlas(self):self.invalid(lambda e:e[0].update(texDiv=[0,2]))
 def test_fractional_atlas(self):self.invalid(lambda e:e[0].update(texDiv=[1.5,2]))
 def test_frame_outside_atlas(self):self.invalid(lambda e:e[0].update(startFrame=4))
 def test_frames_outside_atlas(self):self.invalid(lambda e:e[1].update(numFrames=9))
 def test_unknown_multiplier(self):self.invalid(lambda e:e[1]['textureMult'].update(unknown=1))
 def test_unknown_field_collection(self):self.invalid(lambda e:e[-1]['fieldCollectionDefinition'].update(unknown=1))
 def test_unknown_attraction(self):self.invalid(lambda e:e[-1]['fieldCollectionDefinition']['{c3e452a8}'][0].update(unknown=1))
 def test_authored_orbital_axis(self):self.invalid(lambda e:e[-1]['fieldCollectionDefinition']['fieldOrbitalDefinitions'][0].update(direction=[1,0,0]))
 def test_local_orbital(self):self.invalid(lambda e:e[-1]['fieldCollectionDefinition']['fieldOrbitalDefinitions'][0].update(isLocalSpace=True))
if __name__=='__main__':unittest.main()
