"""Complete primary-hit control projection, omissions and unsupported-field guards."""
from pathlib import Path
import copy,json,runpy,tempfile,unittest
from masteryi_primary_hits import load
from masteryi_primary_hit_profiles import profiles,CANDIDATES,binhash
MODULE=runpy.run_path(str(Path(__file__).with_name('prepare-masteryi-primary-hit-profiles.py')))
class HitProfileGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.pin,_,_=load();cls.outputs,cls.reading=MODULE['generate_outputs']();cls.profiles=cls.reading['profiles'];cls.textures={r['source']['path']:r['source']['path']for r in cls.reading['privateTextures']};cls.defaults=json.loads(Path('docs/reference/garen-spin-defaults.json').read_text())['defaults']
 def invalid(self,change):
  pin=copy.deepcopy(self.pin);change(pin['resources']['MasterYi_BA_Tar_01']['definition']['complexEmitterDefinitionData'])
  with self.assertRaises((ValueError,KeyError)):profiles(pin,self.textures,self.defaults)
 def test_complete_eleven_profiles(self):
  self.assertEqual(len(self.profiles),11);self.assertEqual([p['role']for p in self.profiles],['attack1']*4+['attack2']*4+['crit']*3)
  self.assertEqual([p['explicitFields']for p in self.profiles],[sorted(e)for r in self.pin['resources'].values()for e in r['definition']['complexEmitterDefinitionData']])
 def test_actual_output_is_exact_and_private(self):
  for path,raw in self.outputs:self.assertEqual(path.read_bytes(),raw);self.assertTrue(str(path).startswith('docs/reference/'))
  self.assertEqual(self.reading['historyTicks'],75);self.assertEqual(sum(len(t['rectangles'])for t in self.reading['privateTextures']),93)
 def test_none_blend_kept_separate_from_additive(self):self.assertEqual([p['blend']for p in self.profiles],[3,0,1,1,3,0,1,1,4,4,0]);self.assertIsNone(self.profiles[1]['rawBlend'])
 def test_bind_and_local_defaults_do_not_fill_authored_fields(self):
  self.assertEqual([p['bind']['values'][0][0]for p in self.profiles],[0,1,0,0,0,1,0,0,1,0,0])
  self.assertTrue(all(p['rawLocal']is None and p['rawParticleLocal']is None for p in self.profiles));self.assertTrue(all(p['local']and not p['particleLocal']for p in self.profiles))
 def test_random_fluid_does_not_invent_four_frames(self):
  p=self.profiles[0];self.assertTrue(p['uv']['randomStart']);self.assertEqual(p['uv']['divisions'],[2,2]);self.assertEqual(p['uv']['frames'],1);self.assertNotIn('numFrames',p['explicitFields'])
 def test_blood_keeps_last_start_frame_and_source_rate(self):
  p=self.profiles[2];self.assertEqual((p['uv']['startFrame'],p['uv']['frames'],p['uv']['frameRate']),(15,16,1));self.assertEqual(p['uv']['divisions'],[4,4]);self.assertFalse(p['uv']['randomStart'])
 def test_directional_fluid_keeps_drag_and_world_acceleration(self):
  p=self.profiles[0];self.assertTrue(p['directionOriented']);self.assertEqual(p['birthDrag']['values'],[[1,1,1]]);self.assertEqual(p['worldAcceleration']['values'],[[0,-10,0]]);self.assertIsNone(p['fields']['drag'])
 def test_blood_and_soft_preserve_both_field_controls(self):
  for p in [self.profiles[2],self.profiles[3]]:
   self.assertEqual(p['fields']['acceleration']['values'],[[0,-500,0]]);d=p['fields']['drag'];self.assertEqual(d['position']['values'],[[0,300,0]]);self.assertEqual(d['radius']['values'],[[1000]]);self.assertEqual(d['strength']['values'],[[2]])
 def test_censor_and_importance_do_not_remove_emitters(self):self.assertEqual(self.profiles[0]['rawCensorModulateValue'],[0,0,0,1]);self.assertEqual(self.profiles[2]['rawImportance'],1)
 def test_candidate_hashes_and_raw_identifiers(self):
  for name,hashed in CANDIDATES.items():self.assertEqual(binhash(name),hashed)
  self.assertIn('{08b52819}',self.profiles[0]['explicitFields']);self.assertNotIn('censorModulateValue',self.profiles[0]['explicitFields'])
 def test_ground_glow_remains_target_quad(self):self.assertEqual(self.profiles[8]['kind'],'quad');self.assertFalse(self.profiles[8]['ground']);self.assertEqual(self.reading['bindings'][2]['rawFields']['mHitBoneName'],'C_BUFFBONE_GLB_CHEST_LOC')
 def test_life_probability_endpoint_keeps_float32_value(self):self.assertEqual(self.profiles[3]['life']['probabilities'][0]['values'][-1],1.2000000476837158)
 def test_wrong_transport_pin_fails_before_decode(self):
  with tempfile.TemporaryDirectory()as temp:
   p=Path(temp)/'pin';p.write_bytes(b'{}')
   with self.assertRaisesRegex(ValueError,'Frozen particle input'):MODULE['generate_outputs'](p)

mutations={
 'extra_emitter':lambda e:e.append(copy.deepcopy(e[0])),
 'missing_emitter':lambda e:e.pop(),
 'new_field':lambda e:e[0].update(unhandled=1),
 'new_primitive':lambda e:e[0].update(primitive={'__type':'unknown'}),
 'new_shape_control':lambda e:e[0]['SpawnShape'].update(radius=5),
 'unpaired_shape_rotation':lambda e:e[0]['SpawnShape']['emitRotationAxes'].pop(),
 'unsupported_blend':lambda e:e[0].update(blendMode=2),
 'render_flags':lambda e:e[0].update(meshRenderFlags=8),
 'misc_flags':lambda e:e[0].update(miscRenderFlags=4),
 'new_bound_control':lambda e:e[0]['FlexShapeDefinition'].update(scaleBirthScaleByBoundObjectSize=1),
 'changed_censor':lambda e:e[0].update({'{08b52819}':[1,1,1,1]}),
 'new_field_kind':lambda e:e[2]['fieldCollectionDefinition'].update(noise=[]),
 'local_field_acceleration':lambda e:e[2]['fieldCollectionDefinition']['{5d60e987}'][0].update(isLocalSpace=True),
 'extra_drag_field':lambda e:e[2]['fieldCollectionDefinition']['{b639c899}'].append({}),
 'unknown_drag_control':lambda e:e[2]['fieldCollectionDefinition']['{b639c899}'][0].update(falloff=1),
 'unknown_drag_class':lambda e:e[2]['fieldCollectionDefinition']['{b639c899}'][0].update(__type='unknown'),
 'invalid_atlas_extent':lambda e:e[2].update(numFrames=17),
 'probability_dimensions':lambda e:e[0]['particleLifetime']['dynamics']['probabilityTables'].append({'singleValue':1}),
 'negative_time_order':lambda e:e[0]['particleLifetime']['dynamics'].update(times=[1,0],values=[1,1]),
}
for name,change in mutations.items():
 def test(self,change=change):self.invalid(change)
 setattr(HitProfileGuards,'test_rejects_'+name,test)
if __name__=='__main__':unittest.main()
