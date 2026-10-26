"""Reject inferred frame timing, altered source bindings and modified foley masters."""
from pathlib import Path
import copy,json,os,unittest
from masteryi_w_foley import load,project,cache_path,checked,AUDIO,AUDIO_SHA256,GRAPH,GRAPH_SHA256,DECODED,DECODED_SHA256,KEY
PIN=Path(os.environ.get('MASTER_YI_FOLEY_TEST_PIN','docs/reference/masteryi/w-foley-particles.json'))
class FoleySource(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  pin,model=load(PIN);audio=json.loads(checked(AUDIO,AUDIO_SHA256));graph=json.loads(checked(GRAPH,GRAPH_SHA256));decoded=json.loads(checked(DECODED,DECODED_SHA256))
  v=next(p for p in audio['profiles']if p['kind']=='unbound-foley')['variants'][0]
  cls.inputs=(pin,model,audio,graph,decoded,checked(v['privatePath'],v['wavSha256'],v['wavBytes']))
 def test_literal_chain_and_omissions(self):
  r=project(*copy.deepcopy(self.inputs));clip=r['animation']['definition'];event=clip['mEventDataMap']['{875c32d5}']
  self.assertEqual(event['mStartFrame'],1.0);self.assertIs(type(event['mStartFrame']),float);self.assertIs(event['mIsLoop'],False)
  self.assertNotIn('mTickDuration',clip);self.assertEqual(r['animation']['tickDuration'],{'present':False})
  self.assertEqual(r['particle']['definition']['soundPersistentDefault'],r['bankProfile']['eventName']);self.assertNotIn('soundOnCreateDefault',r['particle']['definition'])
  self.assertEqual(r['floatMaster']['frames'],30827);self.assertEqual(r['floatMaster']['wavBytes'],123352)
  self.assertEqual(r['retainedSpellSuffixes']['18'],'Stop_sfx_MasterYi_Meditate_OnBuffActivate\n')
 def test_cache_path_remains_flat(self):
  row=copy.deepcopy(self.inputs[0]['extraction']['files'][0]);self.assertEqual(cache_path('/tmp/foley',row),Path('/tmp/foley/80298427f6efc3a4.anm'))
  for bad in ['../escape','0'*15,'0'*15+'g',True]:
   row['wadPathHash']=bad
   with self.assertRaises(ValueError):cache_path('/tmp/foley',row)
 def test_unknown_cache_extension(self):
  row=copy.deepcopy(self.inputs[0]['extraction']['files'][0]);row['path']='assets/a.json'
  with self.assertRaises(ValueError):cache_path('/tmp/foley',row)

def clip(v):return v[1]['animations']['data']['Characters/MasterYi/Animations/Skin0']['mClipDataMap']['Spell2_In']
def event(v):return clip(v)['mEventDataMap']['{875c32d5}']
def definition(v):return v[0]['resources'][KEY]['definition']
def profile(v):return next(p for p in v[2]['profiles']if p['kind']=='unbound-foley')
def node(v,identity):return next(n for n in v[3]['nodes']if n['id']==identity)
mutations={
 'frame_seconds_inference':lambda v:clip(v).update(mTickDuration=1/60),
 'frame_integer_substitution':lambda v:event(v).update(mStartFrame=1),
 'frame_boolean_substitution':lambda v:event(v).update(mStartFrame=True),
 'animation_loop_inference':lambda v:event(v).update(mIsLoop=True),
 'animation_loop_integer':lambda v:event(v).update(mIsLoop=0),
 'animation_event_omission':lambda v:clip(v).update(mEventDataMap={}),
 'different_animation_file':lambda v:clip(v)['mAnimationResourceData'].update(mAnimationFilePath='assets/guessed.anm'),
 'different_effect_key':lambda v:event(v).update(mEffectKey='MasterYi_W_Buf'),
 'oncreate_sound_inference':lambda v:definition(v).update(soundOnCreateDefault='Play_sfx_MasterYi_Meditate_foley'),
 'missing_persistent_declaration':lambda v:definition(v).pop('soundPersistentDefault'),
 'linger_used_as_recording_duration':lambda v:definition(v)['complexEmitterDefinitionData'][0].update(particleLinger=.699),
 'numeric_flag_boolean':lambda v:definition(v).update(flags=True),
 'missing_native_file':lambda v:v[0]['extraction']['files'].pop(),
 'native_file_identity':lambda v:v[0]['extraction']['files'][0].update(sha256='0'*64),
 'different_patch':lambda v:v[0]['extraction'].update(referenceVersion='latest'),
 'different_skin_binding':lambda v:v[1]['skin']['data']['Characters/MasterYi/Skins/Skin0/Resources']['resourceMap'].update({KEY:'Characters/Invented'}),
 'changed_gain':lambda v:profile(v).update(gainDb=0),
 'changed_voice_cap':lambda v:profile(v)['policy'].update(u16MaxNumInstance=4),
 'leaf_loop_inference':lambda v:profile(v)['variants'][0].update(leafProperties={'Loop':0}),
 'master_truncated':lambda v:v.__setitem__(5,v[5][:-1]),
 'master_sample_changed':lambda v:v.__setitem__(5,v[5][:-1]+bytes([v[5][-1]^1])),
}
def rejection(mutate):
 def test(self):
  values=list(copy.deepcopy(self.inputs));mutate(values)
  with self.assertRaises(ValueError):project(*values)
 return test
for name,mutate in mutations.items():setattr(FoleySource,'test_reject_'+name,rejection(mutate))
if __name__=='__main__':unittest.main()
