"""Complete primary profiles, raw omissions and exact rendered-marker guards."""
from pathlib import Path
import copy,json,runpy,struct,unittest
from masteryi_attack_trails import load,checked,GLB,GLB_SHA256
from masteryi_primary_trail_particles import profiles,SYSTEMS
MODULE=runpy.run_path(str(Path(__file__).with_name('export-masteryi-primary-trails.py')))
class PrimarySource(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.pin,cls.model=load();cls.glb=checked(GLB,GLB_SHA256);cls.defaults=json.loads(checked('docs/reference/garen-spin-defaults.json','51aaa77125b84ae77e05586d31c7e45de3037028345222a0addd1ed188debefb'))['defaults'];cls.urls={r['path']:r['path']for r in cls.pin['extraction']['files']if r['path'].endswith('.tex')}
 def test_both_complete_profiles_preserve_raw_local_and_blend_omissions(self):
  p=profiles(self.pin,self.urls,'mesh.glb',self.defaults);self.assertEqual(len(p),2)
  for row in p:self.assertEqual(row['rawFlags'],{'blendMode':None,'isLocalOrientation':None,'particleIsLocalOrientation':None});self.assertIs(row['local'],True);self.assertIs(row['particleLocal'],True);self.assertTrue(row['noCull']);self.assertEqual(row['blend'],0)
  self.assertEqual(p[1]['rotation']['values'],[[0.,0.,100.]])
 def test_markers_are_exact_rendered_default_and_event_sample_indices(self):
  m=MODULE['markers'](self.model,self.glb);self.assertEqual([x['sourceFrame']for x in m],[5.,8.]);self.assertEqual([x['sampleCount']for x in m],[55,56]);self.assertEqual([x['glbNode']for x in m],[85,85]);self.assertEqual(m[0]['renderedSeconds'],.1666666716337204);self.assertEqual(m[1]['renderedSeconds'],.2666666805744171)
 def invalid_profile(self,change):
  p=copy.deepcopy(self.pin);change(p['resources'][SYSTEMS[0]]['definition']['complexEmitterDefinitionData'][0])
  with self.assertRaises(ValueError):profiles(p,self.urls,'mesh.glb',self.defaults)
 def invalid_marker(self,change):
  m=copy.deepcopy(self.model);change(m['animations']['data']['Characters/MasterYi/Animations/Skin0']['mClipDataMap'])
  with self.assertRaises(ValueError):MODULE['markers'](m,self.glb)
 def test_unknown_source_field_rejects(self):self.invalid_profile(lambda e:e.update(invented=True))
 def test_inferred_local_orientation_rejects(self):self.invalid_profile(lambda e:e.update(isLocalOrientation=1))
 def test_inferred_particle_local_rejects(self):self.invalid_profile(lambda e:e.update(particleIsLocalOrientation=1))
 def test_no_cull_integer_rejects(self):self.invalid_profile(lambda e:e.update(disableBackfaceCull=1))
 def test_single_boolean_rejects(self):self.invalid_profile(lambda e:e.update(isSingleParticle=True))
 def test_bind_integer_rejects(self):self.invalid_profile(lambda e:e.update(bindWeight={'constantValue':1,'__type':'ValueFloat'}))
 def test_bind_not_full_rejects(self):self.invalid_profile(lambda e:e['bindWeight'].update(constantValue=.5))
 def test_lifetime_boolean_rejects(self):self.invalid_profile(lambda e:e.update(lifetime=True))
 def test_life_too_long_rejects(self):self.invalid_profile(lambda e:e['particleLifetime'].update(constantValue=1.))
 def test_rate_different_rejects(self):self.invalid_profile(lambda e:e['rate'].update(constantValue=2.))
 def test_unsupported_blend_rejects(self):self.invalid_profile(lambda e:e.update(blendMode=1))
 def test_mesh_substitution_rejects(self):self.invalid_profile(lambda e:e['primitive']['mMesh'].update(mSimpleMeshName='assets/guess.scb'))
 def test_varying_size_probability_rejects(self):self.invalid_profile(lambda e:e['birthScale0'].update(dynamics={'probabilityTables':[{'keyTimes':[0.,1.],'keyValues':[.5,1.]}]}))
 def test_unknown_value_field_rejects(self):self.invalid_profile(lambda e:e['birthScale0'].update(invented=1))
 def test_nonfinite_value_rejects(self):self.invalid_profile(lambda e:e['EmitterPosition'].update(constantValue=[0.,float('inf'),0.]))
 def test_frame_integer_substitution_rejects(self):self.invalid_marker(lambda g:g['{ab887b52}']['mEventDataMap']['{2d55b65c}'].update(mStartFrame=5))
 def test_frame_change_rejects(self):self.invalid_marker(lambda g:g['{ab887b52}']['mEventDataMap']['{2d55b65c}'].update(mStartFrame=6.))
 def test_event_loop_integer_rejects(self):self.invalid_marker(lambda g:g['{ab887b52}']['mEventDataMap']['{2d55b65c}'].update(mIsLoop=0))
 def test_inferred_tick_duration_rejects(self):self.invalid_marker(lambda g:g['{ab887b52}'].update(mTickDuration=1/30))
 def test_changed_event_resource_rejects(self):self.invalid_marker(lambda g:g['{ab887b52}']['mAnimationResourceData'].update(mAnimationFilePath='assets/guess.anm'))
 def test_parent_not_parallel_rejects(self):self.invalid_marker(lambda g:g['Attack1'].update(__type='SequencerClipData'))
 def test_missing_named_joint_rejects(self):self.invalid_marker(lambda g:g['{ab887b52}']['mEventDataMap']['{2d55b65c}']['mParticleEventDataPairList'][0].update(mBoneName='Missing'))
 def test_extra_particle_pair_rejects(self):self.invalid_marker(lambda g:g['{ab887b52}']['mEventDataMap']['{2d55b65c}']['mParticleEventDataPairList'].append({'mBoneName':'Root'}))
if __name__=='__main__':unittest.main()
