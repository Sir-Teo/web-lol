from pathlib import Path
import copy,json,unittest
import masteryi_double_strike_audio as module

def node(g,n):return next(row for row in g['nodes']if row['id']==n)
def setparam(g,n,name,value):
 rows=[p for p in node(g,n)['parameters']if p[0].endswith('/'+name)]
 if len(rows)!=1:raise ValueError('Bad test parameter')
 rows[0][2]=str(value)
def setprop(g,n,name,value,ranged=False,suffix='pValue'):
 props=node(g,n)['parameters'];field=next(p for p in props if p[0].endswith('/pID')and p[3]and p[3].endswith('['+name+']')and ('RANGED_MODIFIERS'in p[0])==ranged)
 next(p for p in props if p[0]==field[0][:-3]+suffix)[2]=str(value)
class Guards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  c,_=module.source['load']();g=json.loads(module.checked_bytes(module.GRAPH,module.GRAPH_SHA256));d=json.loads(module.checked_bytes(module.DECODED,module.DECODED_SHA256));cls.base=c,g,d
 def invalid(self,change):
  values=copy.deepcopy(self.base);change(*values)
  with self.assertRaises((ValueError,KeyError)):module.project(*values)
 def test_all_profiles_media_delays_and_binding_omissions(self):
  r=module.project(*self.base);self.assertEqual((len(r['profiles']),r['media'],r['wavBytes']),(9,19,1654340));self.assertEqual(r['finiteTailTicks'],{'cast':43,'hit':63});self.assertEqual(r['peaksAboveOne'],16);self.assertEqual(r['peak'],1.3174407482147217)
  self.assertEqual([(p['actionIndex'],p['delaySeconds'])for p in r['profiles']],[ (0,0),*[(0,0)]*4,*[(1,.2)]*4])
  self.assertTrue(r['bindings'][0]['suffixesPresent']);self.assertFalse(r['bindings'][0]['materialFlagPresent']);self.assertFalse(r['bindings'][1]['suffixesPresent']);self.assertTrue(r['bindings'][1]['materialFlag'])
 def test_shared_hit_containers_and_original_cast_playlist(self):
  r=module.project(*self.base);a,b=r['profiles'][1:5],r['profiles'][5:9]
  self.assertEqual([p['containerId']for p in a],[p['containerId']for p in b]);self.assertEqual([p['policy']for p in a],[p['policy']for p in b]);self.assertEqual([v['id']for v in r['profiles'][0]['variants']],[425476853,271120929,860189031]);self.assertEqual([p['gainDb']for p in a],[-11,-12,-11,-11]);self.assertEqual(r['attenuation']['priority'],60);self.assertEqual(r['attenuation']['unresolvedOutputBusId'],1259461568)
 def test_parent_suffix_change(self):self.invalid(lambda c,g,d:c['records'][module.PARENT]['mSpell']['SpellEventToAudioEventSuffix'].update({'12':'new'}))
 def test_parent_material_omission(self):self.invalid(lambda c,g,d:c['records'][module.PARENT]['mSpell'].update(mApplyMaterialOnHitSound=False))
 def test_secondary_cannot_gain_suffixes(self):self.invalid(lambda c,g,d:c['records'][module.SECONDARY]['mSpell'].update(SpellEventToAudioEventSuffix={}))
 def test_secondary_material_flag(self):self.invalid(lambda c,g,d:c['records'][module.SECONDARY]['mSpell'].update(mApplyMaterialOnHitSound=False))
 def test_missing_event(self):self.invalid(lambda c,g,d:g['events'].remove(next(e for e in g['events']if e['name'].endswith('DoubleStrike_OnCast'))))
 def test_duplicate_event(self):self.invalid(lambda c,g,d:g['events'].append(copy.deepcopy(next(e for e in g['events']if e['name'].endswith('DoubleStrike_OnCast')))))
 def test_extra_event(self):self.invalid(lambda c,g,d:g['events'].append({'id':0,'name':'Play_sfx_MasterYi_DoubleStrike_Unreviewed','actions':[]}))
 def test_event_hash(self):self.invalid(lambda c,g,d:next(e for e in g['events']if e['name'].endswith('DoubleStrike_OnHit')).update(id=0))
 def test_lost_delayed_action(self):self.invalid(lambda c,g,d:next(e for e in g['events']if e['name'].endswith('DoubleStrike_OnHit'))['actions'].pop())
 def test_delayed_action_cannot_be_immediate(self):self.invalid(lambda c,g,d:setprop(g,743235254,'DelayTime',0))
 def test_delayed_action_value(self):self.invalid(lambda c,g,d:setprop(g,743235254,'DelayTime',250))
 def test_action_order(self):self.invalid(lambda c,g,d:next(e for e in g['events']if e['name'].endswith('DoubleStrike_OnHit'))['actions'].reverse())
 def test_action_target(self):self.invalid(lambda c,g,d:next(e for e in g['events']if e['name'].endswith('DoubleStrike_OnHit'))['actions'][1].update(target=3840))
 def test_action_fade(self):self.invalid(lambda c,g,d:setparam(g,743235254,'eFadeCurve',5))
 def test_switch_group(self):self.invalid(lambda c,g,d:setparam(g,391185571,'ulGroupID',0))
 def test_switch_default(self):self.invalid(lambda c,g,d:setparam(g,391185571,'ulDefaultSwitch',0))
 def test_switch_count(self):self.invalid(lambda c,g,d:setparam(g,391185571,'ulNumSwitchGroups',3))
 def test_switch_branch_identity(self):self.invalid(lambda c,g,d:setparam(g,391185571,'CAkSwitchPackage:0/NodeList/NodeID',139790345))
 def test_switch_branch_extent(self):self.invalid(lambda c,g,d:setparam(g,391185571,'CAkSwitchPackage:0/ulNumItems',2))
 def test_switch_gain(self):self.invalid(lambda c,g,d:setprop(g,391185571,'MakeUpGain',0))
 def test_cast_gain(self):self.invalid(lambda c,g,d:setprop(g,3840,'MakeUpGain',0))
 def test_cast_pitch_range(self):self.invalid(lambda c,g,d:setprop(g,3840,'Pitch',-200,True,'min'))
 def test_metal_gain(self):self.invalid(lambda c,g,d:setprop(g,139790345,'MakeUpGain',0))
 def test_cast_cap(self):self.invalid(lambda c,g,d:setparam(g,3840,'u16MaxNumInstance',4))
 def test_hit_cap(self):self.invalid(lambda c,g,d:setparam(g,1022689189,'u16MaxNumInstance',2))
 def test_kill_newest(self):self.invalid(lambda c,g,d:setparam(g,3840,'bKillNewest',1))
 def test_continuous(self):self.invalid(lambda c,g,d:setparam(g,3840,'bIsContinuous',1))
 def test_loop_count(self):self.invalid(lambda c,g,d:setparam(g,3840,'sLoopCount',0))
 def test_global(self):self.invalid(lambda c,g,d:setparam(g,3840,'bIsGlobal',0))
 def test_playlist_extent(self):self.invalid(lambda c,g,d:setparam(g,3840,'ulPlayListItem',2))
 def test_playlist_order(self):self.invalid(lambda c,g,d:setparam(g,3840,'AkPlaylistItem:0/ulPlayID',962895114))
 def test_playlist_weight(self):self.invalid(lambda c,g,d:setparam(g,3840,'AkPlaylistItem:0/weight',1))
 def test_leaf_source(self):self.invalid(lambda c,g,d:setparam(g,741028075,'sourceID',0))
 def test_leaf_parent(self):self.invalid(lambda c,g,d:setparam(g,741028075,'DirectParentID',391185571))
 def test_leaf_limit(self):self.invalid(lambda c,g,d:setparam(g,741028075,'u16MaxNumInstance',1))
 def test_root_bus(self):self.invalid(lambda c,g,d:setparam(g,1056413114,'OverrideBusId',0))
 def test_node_media_closure(self):self.invalid(lambda c,g,d:next(e for e in g['events']if e['name'].endswith('DoubleStrike_OnHit'))['actions'][0]['affectedMediaIds'].pop())
 def test_master_rate(self):self.invalid(lambda c,g,d:next(m for m in d['media']if m['id']==425476853).update(sampleRate=48000))
 def test_master_channels(self):self.invalid(lambda c,g,d:next(m for m in d['media']if m['id']==425476853).update(channels=2))
 def test_encoded_loop(self):self.invalid(lambda c,g,d:next(m for m in d['media']if m['id']==425476853)['decoderMetadata'].update(loopingInfo={'start':1,'end':2}))
 def test_master_identity(self):self.invalid(lambda c,g,d:next(m for m in d['media']if m['id']==425476853).update(wavSha256='0'*64))
if __name__=='__main__':unittest.main()
