from pathlib import Path
import copy,json,unittest
import masteryi_w_audio as module

def setparam(graph,identity,ending,value):
 node=next(n for n in graph['nodes']if n['id']==identity)
 rows=[p for p in node['parameters']if p[0].endswith('/'+ending)]
 if len(rows)!=1:raise ValueError('Bad test parameter')
 rows[0][2]=str(value)
def setprop(graph,identity,name,value):
 node=next(n for n in graph['nodes']if n['id']==identity)
 field=next(p for p in node['parameters']if p[0].endswith('/pID')and p[3]and p[3].endswith('['+name+']'))
 next(p for p in node['parameters']if p[0]==field[0][:-3]+'pValue')[2]=str(value)
class Guards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  character,_=module.source['load']();particles,_=module.particle_source()
  graph=json.loads(module.checked_bytes(module.GRAPH,module.GRAPH_SHA256));decoded=json.loads(module.checked_bytes(module.DECODED,module.DECODED_SHA256))
  cls.base=character,particles,graph,decoded
 def invalid(self,change):
  values=copy.deepcopy(self.base);change(*values)
  with self.assertRaises((ValueError,KeyError)):module.project(*values)
 def test_closure_and_explicit_stop_binding(self):
  r=module.project(*self.base)
  self.assertEqual((r['media'],r['wavBytes'],r['peaksAboveOne']),(6,2373652,2));self.assertEqual(len(r['profiles']),5)
  self.assertEqual(r['finiteTailTicks'],{'cast':151,'deactivate':155});self.assertEqual(len(r['stops']),2);self.assertTrue(r['rawSpellSuffixes']['18'].startswith('Stop_'))
  self.assertEqual([p['kind']for p in r['profiles']],['cast','deactivate','unbound-activate','unbound-activate','unbound-foley'])
  self.assertEqual([p['gainDb']for p in r['profiles']],[-9,-13,-12,-19,-10])
 def test_loop_metadata_is_separate_from_leaf_policy(self):
  r=module.project(*self.base);loops=[p for p in r['profiles']if p['kind']=='unbound-activate']
  self.assertEqual(sum(len(p['variants'])for p in loops),3)
  for p in loops:
   self.assertEqual(p['actionProperties'],{'TransitionTime':2000});self.assertEqual(p['fadeCurve'],5)
   for v in p['variants']:self.assertEqual(v['leafProperties'],{'Loop':0});self.assertIsNone(v['encodedLoopingInfo'])
  for stop in r['stops']:self.assertEqual(stop['properties'],{'TransitionTime':500});self.assertEqual(stop['parameters']['eFadeCurve'],4)
 def test_play_cannot_replace_bound_stop(self):self.invalid(lambda c,p,g,d:c['records']['Characters/MasterYi/Spells/MeditateAbility/Meditate']['mSpell']['SpellEventToAudioEventSuffix'].update({'18':'Play_sfx_MasterYi_Meditate_OnBuffActivate\n'}))
 def test_extra_suffix(self):self.invalid(lambda c,p,g,d:c['records']['Characters/MasterYi/Spells/MeditateAbility/Meditate']['mSpell']['SpellEventToAudioEventSuffix'].update({'21':'new'}))
 def test_particle_cannot_gain_audio(self):self.invalid(lambda c,p,g,d:p['resources']['MasterYi_W_Buf']['definition'].update(soundOnCreateDefault=''))
 def test_missing_event(self):self.invalid(lambda c,p,g,d:g['events'].remove(next(e for e in g['events']if e['name'].endswith('Meditate_OnCast'))))
 def test_duplicate_event(self):self.invalid(lambda c,p,g,d:g['events'].append(copy.deepcopy(next(e for e in g['events']if e['name'].endswith('Meditate_OnCast')))))
 def test_duplicate_stop(self):self.invalid(lambda c,p,g,d:g['events'].append(copy.deepcopy(next(e for e in g['events']if e['name'].startswith('Stop_sfx_MasterYi_Meditate')))))
 def test_additional_meditate_event(self):self.invalid(lambda c,p,g,d:g['events'].append({'name':'Play_sfx_MasterYi_Meditate_Unreviewed','id':0,'actions':[]}))
 def test_wrong_event_hash(self):self.invalid(lambda c,p,g,d:next(e for e in g['events']if e['name'].endswith('Meditate_OnCast')).update(id=0))
 def test_wrong_action_target(self):self.invalid(lambda c,p,g,d:next(e for e in g['events']if e['name'].endswith('Meditate_OnCast'))['actions'][0].update(target=9223))
 def test_linear_cannot_replace_scurve(self):self.invalid(lambda c,p,g,d:setparam(g,220196976,'eFadeCurve',4))
 def test_scurve_cannot_replace_stop_linear(self):self.invalid(lambda c,p,g,d:setparam(g,29521780,'eFadeCurve',5))
 def test_play_fade_duration(self):self.invalid(lambda c,p,g,d:setprop(g,220196976,'TransitionTime',0))
 def test_stop_fade_duration(self):self.invalid(lambda c,p,g,d:setprop(g,29521780,'TransitionTime',0))
 def test_loop_count(self):self.invalid(lambda c,p,g,d:setprop(g,666860738,'Loop',1))
 def test_container_gain(self):self.invalid(lambda c,p,g,d:setprop(g,9222,'MakeUpGain',0))
 def test_voice_cap(self):self.invalid(lambda c,p,g,d:setparam(g,9223,'u16MaxNumInstance',5))
 def test_kill_newest(self):self.invalid(lambda c,p,g,d:setparam(g,9223,'bKillNewest',1))
 def test_playlist_weight(self):self.invalid(lambda c,p,g,d:setparam(g,449614214,'AkPlaylistItem:0/weight',1))
 def test_playlist_extent(self):self.invalid(lambda c,p,g,d:setparam(g,449614214,'ulPlayListItem',1))
 def test_leaf_source(self):self.invalid(lambda c,p,g,d:setparam(g,478738253,'sourceID',0))
 def test_leaf_parent(self):self.invalid(lambda c,p,g,d:setparam(g,478738253,'DirectParentID',9224))
 def test_inherited_bus(self):self.invalid(lambda c,p,g,d:setparam(g,1056413114,'OverrideBusId',0))
 def test_stop_action_scope(self):self.invalid(lambda c,p,g,d:setparam(g,29521780,'ulActionType',258))
 def test_stop_exceptions(self):self.invalid(lambda c,p,g,d:setparam(g,29521780,'ulExceptionListSize',1))
 def test_stop_media_closure(self):self.invalid(lambda c,p,g,d:next(e for e in g['events']if e['name'].startswith('Stop_sfx_MasterYi_Meditate'))['actions'][0]['affectedMediaIds'].pop())
 def test_master_rate(self):self.invalid(lambda c,p,g,d:next(m for m in d['media']if m['id']==637673445).update(sampleRate=48000))
 def test_master_channels(self):self.invalid(lambda c,p,g,d:next(m for m in d['media']if m['id']==637673445).update(channels=2))
 def test_encoded_loop_points(self):self.invalid(lambda c,p,g,d:next(m for m in d['media']if m['id']==610915723)['decoderMetadata'].update(loopingInfo={'start':1,'end':2}))
 def test_master_identity(self):self.invalid(lambda c,p,g,d:next(m for m in d['media']if m['id']==637673445).update(wavSha256='0'*64))
if __name__=='__main__':unittest.main()
