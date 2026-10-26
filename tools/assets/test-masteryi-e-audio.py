from pathlib import Path
import copy,json,unittest
import masteryi_e_audio as module

def node(g,n):return next(row for row in g['nodes']if row['id']==n)
def setparam(g,n,name,value):
 rows=[p for p in node(g,n)['parameters']if p[0].endswith('/'+name)]
 if len(rows)!=1:raise ValueError('Bad test parameter')
 rows[0][2]=str(value)
def setprop(g,n,name,value):
 props=node(g,n)['parameters'];field=next(p for p in props if p[0].endswith('/pID')and p[3]and p[3].endswith('['+name+']'))
 next(p for p in props if p[0]==field[0][:-3]+'pValue')[2]=str(value)
class Guards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  c,_=module.source['load']();g=json.loads(module.checked_bytes(module.GRAPH,module.GRAPH_SHA256));d=json.loads(module.checked_bytes(module.DECODED,module.DECODED_SHA256));cls.base=c,g,d
 def invalid(self,change):
  values=copy.deepcopy(self.base);change(*values)
  with self.assertRaises((ValueError,KeyError)):module.project(*values)
 def test_exact_profiles_and_original_playlist_order(self):
  r=module.project(*self.base);self.assertEqual(r['finiteTailTicks'],{'cast':69,'activate':127,'deactivate':67})
  self.assertEqual((r['media'],r['wavBytes'],r['peaksAboveOne']),(6,1468612,1))
  self.assertEqual([[v['id']for v in p['variants']]for p in r['profiles']],[[289182248,975357315],[418795702,209385861],[418782952,63363042]])
  self.assertEqual([p['gainDb']for p in r['profiles']],[-11,-9,-14]);self.assertEqual(r['profiles'][0]['sourceProperties'],{'MakeUpGain':-11,'Priority':60})
 def test_suffix_change(self):self.invalid(lambda c,g,d:c['records']['Characters/MasterYi/Spells/WujuStyleAbility/WujuStyle']['mSpell']['SpellEventToAudioEventSuffix'].update({'18':'Stop_sfx_MasterYi_WujuStyleSuperCharged_OnBuffActivate\n'}))
 def test_extra_suffix(self):self.invalid(lambda c,g,d:c['records']['Characters/MasterYi/Spells/WujuStyleAbility/WujuStyle']['mSpell']['SpellEventToAudioEventSuffix'].update({'22':'new'}))
 def test_missing_event(self):self.invalid(lambda c,g,d:g['events'].remove(next(e for e in g['events']if e['name'].endswith('WujuStyle_OnCast'))))
 def test_duplicate_event(self):self.invalid(lambda c,g,d:g['events'].append(copy.deepcopy(next(e for e in g['events']if e['name'].endswith('WujuStyle_OnCast')))))
 def test_extra_event(self):self.invalid(lambda c,g,d:g['events'].append({'id':0,'name':'Play_sfx_MasterYi_WujuStyle_Unreviewed','actions':[]}))
 def test_wrong_event_hash(self):self.invalid(lambda c,g,d:next(e for e in g['events']if e['name'].endswith('WujuStyle_OnCast')).update(id=0))
 def test_wrong_action_target(self):self.invalid(lambda c,g,d:next(e for e in g['events']if e['name'].endswith('WujuStyle_OnCast'))['actions'][0].update(target=344121187))
 def test_fade_curve(self):self.invalid(lambda c,g,d:setparam(g,120031562,'eFadeCurve',5))
 def test_gain(self):self.invalid(lambda c,g,d:setprop(g,9318,'MakeUpGain',0))
 def test_explicit_priority(self):self.invalid(lambda c,g,d:setprop(g,9318,'Priority',0))
 def test_voice_cap(self):self.invalid(lambda c,g,d:setparam(g,9318,'u16MaxNumInstance',5))
 def test_kill_newest(self):self.invalid(lambda c,g,d:setparam(g,9318,'bKillNewest',1))
 def test_container_loop(self):self.invalid(lambda c,g,d:setparam(g,9318,'sLoopCount',0))
 def test_continuous(self):self.invalid(lambda c,g,d:setparam(g,9318,'bIsContinuous',1))
 def test_global(self):self.invalid(lambda c,g,d:setparam(g,9318,'bIsGlobal',0))
 def test_random_policy(self):self.invalid(lambda c,g,d:setparam(g,9318,'eRandomMode',0))
 def test_playlist_extent(self):self.invalid(lambda c,g,d:setparam(g,9318,'ulPlayListItem',1))
 def test_playlist_order(self):self.invalid(lambda c,g,d:setparam(g,9318,'AkPlaylistItem:0/ulPlayID',288202150))
 def test_playlist_weight(self):self.invalid(lambda c,g,d:setparam(g,9318,'AkPlaylistItem:0/weight',1))
 def test_leaf_parent(self):self.invalid(lambda c,g,d:setparam(g,994148925,'DirectParentID',344121187))
 def test_leaf_source(self):self.invalid(lambda c,g,d:setparam(g,994148925,'sourceID',0))
 def test_leaf_bus(self):self.invalid(lambda c,g,d:setparam(g,994148925,'OverrideBusId',1))
 def test_leaf_limit(self):self.invalid(lambda c,g,d:setparam(g,994148925,'u16MaxNumInstance',1))
 def test_parent_limit(self):self.invalid(lambda c,g,d:setparam(g,210632701,'u16MaxNumInstance',1))
 def test_root_bus(self):self.invalid(lambda c,g,d:setparam(g,1056413114,'OverrideBusId',0))
 def test_media_closure(self):self.invalid(lambda c,g,d:next(e for e in g['events']if e['name'].endswith('WujuStyle_OnCast'))['actions'][0]['affectedMediaIds'].pop())
 def test_master_rate(self):self.invalid(lambda c,g,d:next(m for m in d['media']if m['id']==289182248).update(sampleRate=48000))
 def test_master_channels(self):self.invalid(lambda c,g,d:next(m for m in d['media']if m['id']==289182248).update(channels=2))
 def test_encoded_loop(self):self.invalid(lambda c,g,d:next(m for m in d['media']if m['id']==289182248)['decoderMetadata'].update(loopingInfo={'start':1,'end':2}))
 def test_master_identity(self):self.invalid(lambda c,g,d:next(m for m in d['media']if m['id']==289182248).update(wavSha256='0'*64))
if __name__=='__main__':unittest.main()
