"""Persistent binding, loop declaration and unresolved RTPC source guards."""
import copy,json,unittest
from pathlib import Path
import masteryi_r_trail_audio as source
class TrailGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.args=source.inputs();cls.record=source.project(*cls.args)
 def invalid(self,change):
  args=copy.deepcopy(self.args);change(args)
  with self.assertRaises((ValueError,KeyError)):source.project(*args)
 def parameter(self,args,node,ending,value):
  n=next(n for n in args[1]['nodes']if n['id']==node);p=[p for p in n['parameters']if p[0].endswith('/'+ending)];self.assertEqual(len(p),1);p[0][2]=str(value)
 def event(self,args):return next(e for e in args[1]['events']if e['name']==source.EVENT)
 def test_exact_binding_and_omission_closure(self):self.assertEqual([b['system']for b in self.record['bindings']if b['persistentPresent']],['MasterYi_R_Buf','MasterYi_R_Buf_Lvl2','MasterYi_R_Buf_Lvl3']);self.assertTrue(all(not b['onCreatePresent']for b in self.record['bindings']))
 def test_loop_property_is_separate_from_encoded_loop_points(self):self.assertEqual(self.record['leafProperties'],{'Loop':0});self.assertIsNone(self.record['master']['decoderMetadata']['loopingInfo'])
 def test_rtpc_keeps_unknown_input_and_raw_controls(self):
  r=self.record['volumeRtpc'];self.assertEqual((r['RTPCID'],r['rtpcCurveID'],r['eScaling'],r['rtpcAccum']),(745018932,751387390,2,2));self.assertFalse(r['gameParameterDefinitionPresent']);self.assertIsNone(r['inputMeaning']);self.assertEqual([p['interpolation']for p in r['points']],[5,9,5,9,4])
 def test_exact_headroom_and_private_master(self):
  m=self.record['master'];self.assertEqual((m['frames'],m['wavBytes'],m['sampleRate'],m['channels']),(336807,1347272,44100,1));self.assertEqual(m['samplesOutsideUnitRange'],4);self.assertEqual(m['peak'],1.0218539237976074);self.assertTrue(m['privatePath'].startswith('.cache/'))
 def test_projection_does_not_mutate_source(self):
  before=json.dumps(self.args);source.project(*self.args);self.assertEqual(json.dumps(self.args),before)
 def test_missing_binding(self):self.invalid(lambda a:a[0]['resources']['MasterYi_R_Buf']['definition'].pop('soundPersistentDefault'))
 def test_wrong_binding(self):self.invalid(lambda a:a[0]['resources']['MasterYi_R_Buf']['definition'].update(soundPersistentDefault='invented'))
 def test_inferred_cast_binding(self):self.invalid(lambda a:a[0]['resources']['MasterYi_R_Cas']['definition'].update(soundPersistentDefault=source.EVENT))
 def test_inferred_on_create(self):self.invalid(lambda a:a[0]['resources']['MasterYi_R_Buf']['definition'].update(soundOnCreateDefault=source.EVENT))
 def test_lost_system(self):self.invalid(lambda a:a[0]['resources'].pop('MasterYi_R_OnBuffKill'))
 def test_duplicate_event(self):self.invalid(lambda a:a[1]['events'].append(copy.deepcopy(self.event(a))))
 def test_wrong_event_hash(self):self.invalid(lambda a:self.event(a).update(id=0))
 def test_extra_stop_event(self):self.invalid(lambda a:a[1]['events'].append({'name':'Stop_sfx_MasterYi_Highlander_trail','id':0,'actions':[]}))
 def test_lost_action(self):self.invalid(lambda a:self.event(a)['actions'].clear())
 def test_wrong_target(self):self.invalid(lambda a:self.event(a)['actions'][0].update(target=9114))
 def test_wrong_media(self):self.invalid(lambda a:self.event(a)['actions'][0].update(affectedMediaIds=[1]))
 def test_wrong_gain(self):self.invalid(lambda a:self.parameter(a,9115,'AkPropBundle:0/pValue',-12))
 def test_changed_loop(self):self.invalid(lambda a:self.parameter(a,802209755,'AkPropBundle:0/pValue',1))
 def test_changed_cap(self):self.invalid(lambda a:self.parameter(a,9115,'u16MaxNumInstance',5))
 def test_changed_overload_policy(self):self.invalid(lambda a:self.parameter(a,9115,'bKillNewest',1))
 def test_changed_parent_routing(self):self.invalid(lambda a:self.parameter(a,9114,'OverrideBusId',1))
 def test_changed_rtpc_input(self):self.invalid(lambda a:self.parameter(a,9115,'RTPC:0/RTPCID',1))
 def test_changed_rtpc_scaling(self):self.invalid(lambda a:self.parameter(a,9115,'RTPC:0/eScaling',0))
 def test_changed_rtpc_extent(self):self.invalid(lambda a:self.parameter(a,9115,'RTPC:0/ulSize',4))
 def test_changed_curve_value(self):self.invalid(lambda a:self.parameter(a,9115,'AkRTPCGraphPoint:0/To',0))
 def test_changed_curve_interpolation(self):self.invalid(lambda a:self.parameter(a,9115,'AkRTPCGraphPoint:0/Interp',4))
 def test_new_parameter_definition_requires_review(self):self.invalid(lambda a:a[1]['nodes'].append({'id':745018932,'type':'CAkGameParameter','parameters':[]}))
if __name__=='__main__':unittest.main()
