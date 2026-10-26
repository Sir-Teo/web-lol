"""Guard both authored Passive trail systems, omissions and rendered event clocks."""
from pathlib import Path
import copy,json,runpy,unittest
from masteryi_attack_trails import load,checked,GLB,GLB_SHA256
from masteryi_passive_trail_particles import profiles,SYSTEMS,BINDINGS
MODULE=runpy.run_path(str(Path(__file__).with_name('export-masteryi-primary-trails.py')))
class PassiveSource(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.pin,cls.model=load();cls.glb=checked(GLB,GLB_SHA256);cls.defaults=json.loads(checked('docs/reference/garen-spin-defaults.json','51aaa77125b84ae77e05586d31c7e45de3037028345222a0addd1ed188debefb'))['defaults'];cls.urls={r['path']:r['path']for r in cls.pin['extraction']['files']if r['path'].endswith('.tex')}
 def test_both_complete_profiles_retain_authored_blend_and_raw_frame_omissions(self):
  rows=profiles(self.pin,self.urls,'shared.glb',self.defaults);self.assertEqual([r['system']for r in rows],list(SYSTEMS))
  for r in rows:
   self.assertEqual(r['role'],'double-strike-trail');self.assertEqual(r['rawFlags'],{'blendMode':4,'isLocalOrientation':None,'particleIsLocalOrientation':None});self.assertEqual(r['blend'],4);self.assertIs(r['noCull'],True);self.assertEqual(r['mesh'],'shared.glb');self.assertNotIn('birthScale0',r['explicitFields']);self.assertEqual(r['size']['values'],[self.defaults['birthScale']]);self.assertEqual(r['position']['values'],[[0.,-40.,-20.]])
  self.assertEqual([r['life']['values'][0][0]for r in rows],[.2199999988079071,.1899999976158142]);self.assertNotEqual(rows[0]['texture'],rows[1]['texture'])
 def test_two_events_share_exact_rendered_default_and_event_clocks(self):
  rows=MODULE['markers'](self.model,self.glb,BINDINGS);self.assertEqual([r['sourceFrame']for r in rows],[6.,9.]);self.assertEqual([r['renderedSeconds']for r in rows],[.20000001788139343,.30000001192092896]);self.assertEqual([r['profileIndex']for r in rows],[0,1]);self.assertEqual({r['parent']for r in rows},{'Passive'});self.assertEqual({r['sampleCount']for r in rows},{56});self.assertEqual({r['renderedDuration']for r in rows},{1.8333333730697632});self.assertEqual({r['glbNode']for r in rows},{85})
 def invalid_profiles(self,change):
  for system in SYSTEMS:
   with self.subTest(system=system):
    pin=copy.deepcopy(self.pin);change(pin['resources'][system]['definition']['complexEmitterDefinitionData'][0])
    with self.assertRaises(ValueError):profiles(pin,self.urls,'shared.glb',self.defaults)
 def invalid_markers(self,change):
  model=copy.deepcopy(self.model);change(model['animations']['data']['Characters/MasterYi/Animations/Skin0']['mClipDataMap'])
  with self.assertRaises(ValueError):MODULE['markers'](model,self.glb,BINDINGS)
 def test_missing_authored_blend_rejects(self):self.invalid_profiles(lambda e:e.pop('blendMode'))
 def test_changed_blend_zero_rejects(self):self.invalid_profiles(lambda e:e.update(blendMode=0))
 def test_boolean_blend_rejects(self):self.invalid_profiles(lambda e:e.update(blendMode=True))
 def test_inferred_local_flag_rejects(self):self.invalid_profiles(lambda e:e.update(isLocalOrientation=1))
 def test_inferred_particle_local_flag_rejects(self):self.invalid_profiles(lambda e:e.update(particleIsLocalOrientation=1))
 def test_unknown_second_or_first_field_rejects(self):self.invalid_profiles(lambda e:e.update(invented=True))
 def test_partial_bind_rejects(self):self.invalid_profiles(lambda e:e['bindWeight'].update(constantValue=.5))
 def test_integer_bind_rejects(self):self.invalid_profiles(lambda e:e['bindWeight'].update(constantValue=1))
 def test_boolean_single_rejects(self):self.invalid_profiles(lambda e:e.update(isSingleParticle=True))
 def test_integer_no_cull_rejects(self):self.invalid_profiles(lambda e:e.update(disableBackfaceCull=1))
 def test_nonfinite_offset_rejects(self):self.invalid_profiles(lambda e:e['EmitterPosition'].update(constantValue=[0.,float('inf'),0.]))
 def test_changed_mesh_rejects(self):self.invalid_profiles(lambda e:e['primitive']['mMesh'].update(mSimpleMeshName='guessed.scb'))
 def test_life_outside_supported_bound_rejects(self):self.invalid_profiles(lambda e:e['particleLifetime'].update(constantValue=.5))
 def test_sound_callback_inference_rejects(self):
  for system in SYSTEMS:
   pin=copy.deepcopy(self.pin);pin['resources'][system]['definition']['soundOnCreateDefault']='guessed-event'
   with self.assertRaises(ValueError):profiles(pin,self.urls,'shared.glb',self.defaults)
 def test_first_frame_integer_rejects(self):self.invalid_markers(lambda g:g['{c722c9e7}']['mEventDataMap']['{cf40bfff}'].update(mStartFrame=6))
 def test_second_frame_change_rejects(self):self.invalid_markers(lambda g:g['{c722c9e7}']['mEventDataMap']['{d040c192}'].update(mStartFrame=8.))
 def test_first_event_loop_rejects(self):self.invalid_markers(lambda g:g['{c722c9e7}']['mEventDataMap']['{cf40bfff}'].update(mIsLoop=True))
 def test_second_event_loop_integer_rejects(self):self.invalid_markers(lambda g:g['{c722c9e7}']['mEventDataMap']['{d040c192}'].update(mIsLoop=0))
 def test_inferred_tick_duration_rejects(self):self.invalid_markers(lambda g:g['{c722c9e7}'].update(mTickDuration=1/30))
 def test_wrong_default_resource_rejects(self):self.invalid_markers(lambda g:g['{85dac0b3}']['mAnimationResourceData'].update(mAnimationFilePath='guessed.anm'))
 def test_nonparallel_parent_rejects(self):self.invalid_markers(lambda g:g['Passive'].update(__type='SequencerClipData'))
 def test_missing_second_event_rejects(self):self.invalid_markers(lambda g:g['{c722c9e7}']['mEventDataMap'].pop('{d040c192}'))
 def test_missing_first_joint_rejects(self):self.invalid_markers(lambda g:g['{c722c9e7}']['mEventDataMap']['{cf40bfff}']['mParticleEventDataPairList'][0].update(mBoneName='Missing'))
 def test_extra_second_pair_rejects(self):self.invalid_markers(lambda g:g['{c722c9e7}']['mEventDataMap']['{d040c192}']['mParticleEventDataPairList'].append({'mBoneName':'Root'}))
 def test_event_dictionary_order_does_not_change_source_marker_order(self):
  model=copy.deepcopy(self.model);g=model['animations']['data']['Characters/MasterYi/Animations/Skin0']['mClipDataMap'];g['{c722c9e7}']['mEventDataMap']=dict(reversed(list(g['{c722c9e7}']['mEventDataMap'].items())))
  self.assertEqual(MODULE['markers'](model,self.glb,BINDINGS),MODULE['markers'](self.model,self.glb,BINDINGS))
if __name__=='__main__':unittest.main()
