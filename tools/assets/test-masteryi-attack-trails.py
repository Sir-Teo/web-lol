"""Reject changed native trails, inferred event clocks and false rig bridges."""
from pathlib import Path
import copy,json,os,struct,unittest
from masteryi_attack_trails import load,project,checked,GLB,GLB_SHA256,cache_path
PIN=Path(os.environ.get('MASTER_YI_TRAIL_TEST_PIN','docs/reference/masteryi/attack-trail-particles.json'))
class AttackTrails(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  pin,model=load(PIN);cls.inputs=(pin,model,checked(GLB,GLB_SHA256))
 def test_complete_literal_events_and_omissions(self):
  r=project(*copy.deepcopy(self.inputs));self.assertEqual([b['event']['mStartFrame']for b in r['bindings']],[5.,5.,8.,6.,9.]);self.assertEqual({p['glbNode']for b in r['bindings']for p in b['pairs']},{85})
  self.assertEqual(r['omittedBlendMode'],['MasterYi_BA1_Trail','MasterYi_Crit_Trail'])
  for row in r['resources'].values():
   d=row['definition'];self.assertNotIn('soundOnCreateDefault',d);self.assertNotIn('soundPersistentDefault',d)
  for b in r['bindings']:
   self.assertNotIn('mTickDuration',b['clipDefinition']);self.assertIs(b['event']['mIsLoop'],False)
 def test_cache_names_are_flat(self):
  row=copy.deepcopy(self.inputs[0]['extraction']['files'][0]);self.assertEqual(cache_path('/tmp/trails',row).parent,Path('/tmp/trails'))
  for bad in ['../escape','0'*15,'x'*16,True]:
   row['wadPathHash']=bad
   with self.assertRaises(ValueError):cache_path('/tmp/trails',row)
 def test_unknown_cache_suffix(self):
  row=copy.deepcopy(self.inputs[0]['extraction']['files'][0]);row['path']='assets/guess.json'
  with self.assertRaises(ValueError):cache_path('/tmp/trails',row)

def clips(v):return v[1]['animations']['data']['Characters/MasterYi/Animations/Skin0']['mClipDataMap']
def event(v):return clips(v)['{ab887b52}']['mEventDataMap']['{2d55b65c}']
def emitter(v,key='MasterYi_BA1_Trail'):return v[0]['resources'][key]['definition']['complexEmitterDefinitionData'][0]
mutations={
 'missing_resource':lambda v:v[0]['resources'].pop('MasterYi_P_Trail_2'),
 'source_sound_default':lambda v:v[0]['resources']['MasterYi_BA1_Trail']['definition'].update(soundOnCreateDefault='Play_invented'),
 'source_persistent_default':lambda v:v[0]['resources']['MasterYi_BA1_Trail']['definition'].update(soundPersistentDefault='Play_invented'),
 'blend_default_inference':lambda v:emitter(v).update(blendMode=4),
 'critical_blend_default':lambda v:emitter(v,'MasterYi_Crit_Trail').update(blendMode=4),
 'remove_explicit_blend':lambda v:emitter(v,'MasterYi_BA2_Trail').pop('blendMode'),
 'no_cull_integer':lambda v:emitter(v).update(disableBackfaceCull=1),
 'single_particle_boolean':lambda v:emitter(v).update(isSingleParticle=True),
 'bind_local_default':lambda v:emitter(v).update(particleIsLocalOrientation=1),
 'changed_mesh':lambda v:emitter(v)['primitive']['mMesh'].update(mSimpleMeshName='assets/guess.scb'),
 'changed_uv_scroll':lambda v:emitter(v)['birthUvScrollRate'].update(constantValue=[0.,0.]),
 'changed_offset':lambda v:emitter(v)['EmitterPosition'].update(constantValue=[0.,0.,0.]),
 'changed_native_frame':lambda v:event(v).update(mStartFrame=6.),
 'frame_integer_substitution':lambda v:event(v).update(mStartFrame=5),
 'inferred_frame_seconds':lambda v:clips(v)['{ab887b52}'].update(mTickDuration=1/30),
 'changed_bone':lambda v:event(v)['mParticleEventDataPairList'][0].update(mBoneName='Root'),
 'mask_hash_guess':lambda v:clips(v)['{ab887b52}'].update(mMaskDataName='UpperBody'),
 'track_hash_guess':lambda v:clips(v)['{ab887b52}'].update(mTrackDataName='Weapon'),
 'parent_sequential_guess':lambda v:clips(v)['Attack1'].update(__type='SequencerClipData'),
 'passive_event_drop':lambda v:clips(v)['{c722c9e7}']['mEventDataMap'].pop('{d040c192}'),
 'missing_anm':lambda v:v[0]['extraction']['files'].pop(0),
 'changed_file_identity':lambda v:v[0]['extraction']['files'][0].update(sha256='0'*64),
 'changed_patch':lambda v:v[0]['extraction'].update(referenceVersion='latest'),
 'truncated_glb':lambda v:v.__setitem__(2,v[2][:-1]),
}
def rejection(mutate):
 def test(self):
  values=list(copy.deepcopy(self.inputs));mutate(values)
  with self.assertRaises(ValueError):project(*values)
 return test
for name,mutate in mutations.items():setattr(AttackTrails,'test_reject_'+name,rejection(mutate))
def edited_glb(raw,edit):
 length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length]);edit(doc)
 chunk=json.dumps(doc,separators=(',',':')).encode();chunk+=b' '*((-len(chunk))%4)
 body=struct.pack('<I4s',len(chunk),b'JSON')+chunk+raw[20+length:]
 return b'glTF'+struct.pack('<II',2,len(body)+12)+body

def bone_guard(edit):
 def test(self):
  values=list(copy.deepcopy(self.inputs));values[2]=edited_glb(values[2],edit)
  with self.assertRaisesRegex(ValueError,'attack trail attachment'):project(*values)
 return test
setattr(AttackTrails,'test_reject_missing_joint',bone_guard(lambda d:d['nodes'][85].update(name='Missing')))
setattr(AttackTrails,'test_reject_duplicate_joint',bone_guard(lambda d:d['nodes'].append(copy.deepcopy(d['nodes'][85]))))
setattr(AttackTrails,'test_reject_non_skin_joint',bone_guard(lambda d:[s['joints'].remove(85)for s in d['skins']if 85 in s['joints']]))
if __name__=='__main__':unittest.main()
