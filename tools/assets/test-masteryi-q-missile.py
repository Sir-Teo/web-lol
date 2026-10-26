"""Frozen ordinary/AP definitions and exact private transport identity guards."""
from pathlib import Path
import copy,json,runpy,unittest
from masteryi_q_particles import load
PREP=runpy.run_path(str(Path(__file__).with_name('prepare-masteryi-q-missile.py')))
class MissileSource(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.pin,_=load();cls.outputs,cls.reading=PREP['generate_outputs']();cls.transport=json.loads(Path('docs/reference/masteryi/q-missile-texture-transport.json').read_text())
 def test_complete_selected_closure(self):
  self.assertEqual([len(d['complexEmitterDefinitionData'])for d in self.reading['systems'].values()],[5,3]);self.assertEqual(len(self.transport['textures']),11);self.assertEqual(sum(len(t['rectangles'])for t in self.transport['textures']),99)
 def test_source_outputs_are_exact_and_private(self):
  for p,raw in self.outputs:self.assertEqual(p.read_bytes(),raw);self.assertTrue(str(p).startswith('docs/reference/'))
 def test_ap_frame_count_is_distinct_from_atlas_cells(self):
  e=self.reading['systems']['MasterYi_Q_AP_Mis']['complexEmitterDefinitionData'][0];self.assertEqual(e['numFrames'],2);self.assertEqual(e['texDiv'],[1,4])
 def test_three_independent_frame_rates_remain_raw(self):self.assertEqual([f['value']for f in self.reading['frameRateCandidate']['fields']],[10,30,30])
 def test_omitted_system_sound_and_flags_stay_omitted(self):
  for d in self.reading['systems'].values():self.assertNotIn('soundOnCreateDefault',d);self.assertNotIn('flags',d)
 def test_complete_primitive_closure(self):
  kinds=[e['primitive']['__type']for d in self.reading['systems'].values()for e in d['complexEmitterDefinitionData']];self.assertEqual(kinds.count('VfxPrimitiveMesh'),3);self.assertEqual(kinds.count('VfxPrimitiveArbitraryQuad'),4);self.assertEqual(kinds.count('VfxPrimitiveRay'),1)
 def test_mesh_has_exact_source_metadata_without_invented_tint(self):
  m=self.reading['mesh'];self.assertEqual((m['sourceVertices'],m['triangles'],m['exportedCorners'],m['flags']),(27,24,72,5));self.assertEqual(len(bytes.fromhex(m['tailHex'])),24);self.assertFalse(m['normalsGenerated']);self.assertFalse(m['sourceFaceRgbAppliedAsMaterial'])
 def invalid(self,change):
  pin=copy.deepcopy(self.pin);change(pin['resources'])
  with self.assertRaises((ValueError,KeyError)):PREP['selected'](pin)
 def test_missing_system(self):self.invalid(lambda r:r.pop('MasterYi_Q_AP_Mis'))
 def test_missing_emitter(self):self.invalid(lambda r:r['MasterYi_Q_Mis']['definition']['complexEmitterDefinitionData'].pop())
 def test_added_emitter(self):self.invalid(lambda r:r['MasterYi_Q_Mis']['definition']['complexEmitterDefinitionData'].append({}))
 def test_added_field(self):self.invalid(lambda r:r['MasterYi_Q_Mis']['definition']['complexEmitterDefinitionData'][0].update(unhandled=1))
 def test_missing_field(self):self.invalid(lambda r:r['MasterYi_Q_Mis']['definition']['complexEmitterDefinitionData'][0].pop('birthVelocity'))
 def test_boolean_number_substitution(self):self.invalid(lambda r:r['MasterYi_Q_Mis']['definition']['complexEmitterDefinitionData'][0]['particleLifetime'].update(constantValue=True))
 def test_changed_frame_rate(self):self.invalid(lambda r:r['MasterYi_Q_Mis']['definition']['complexEmitterDefinitionData'][0].update({'{9b111ae4}':30}))
 def test_normalized_ap_frame_count(self):self.invalid(lambda r:r['MasterYi_Q_AP_Mis']['definition']['complexEmitterDefinitionData'][0].update(numFrames=4))
 def test_normalized_ap_grid(self):self.invalid(lambda r:r['MasterYi_Q_AP_Mis']['definition']['complexEmitterDefinitionData'][0].update(texDiv=[2,1]))
 def test_changed_normal_texture(self):self.invalid(lambda r:r['MasterYi_Q_AP_Mis']['definition']['complexEmitterDefinitionData'][2]['distortionDefinition'].update(normalMapTexture='invented.tex'))
 def test_changed_bind(self):self.invalid(lambda r:r['MasterYi_Q_AP_Mis']['definition']['complexEmitterDefinitionData'][2]['bindWeight'].update(constantValue=1))
 def test_invented_flags(self):self.invalid(lambda r:r['MasterYi_Q_Mis']['definition'].update(flags=198))
 def test_invented_sound(self):self.invalid(lambda r:r['MasterYi_Q_Mis']['definition'].update(soundOnCreateDefault='invented'))
if __name__=='__main__':unittest.main()
