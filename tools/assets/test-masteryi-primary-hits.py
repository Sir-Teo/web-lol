"""Primary target hit closure, typed omissions and immutable output guards."""
from pathlib import Path
import copy,tempfile,unittest
import masteryi_primary_hits as source
from masteryi_audio_graph import write_outputs

class PrimaryHitGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.pin,cls.model,cls.character=source.load()
 def invalid(self,change):
  pin=copy.deepcopy(self.pin);change(pin)
  with self.assertRaises((ValueError,KeyError)):source.validate(pin,self.model,self.character)
 def test_full_closure(self):
  bins,tex=source.validate(self.pin,self.model,self.character)
  self.assertEqual((len(bins),len(tex)),(2,11));self.assertEqual(sum(len(r['definition']['complexEmitterDefinitionData'])for r in self.pin['resources'].values()),11)
 def test_pin_hash_precedes_parse(self):
  with tempfile.TemporaryDirectory()as temp:
   path=Path(temp)/'pin';path.write_bytes(b'{}')
   with self.assertRaisesRegex(ValueError,'Frozen particle input'):source.load(path)
 def test_model_hash_precedes_parse(self):
  with tempfile.TemporaryDirectory()as temp:
   path=Path(temp)/'model';path.write_bytes(b'{}')
   with self.assertRaisesRegex(ValueError,'Frozen particle input'):source.load(model_path=path)
 def test_target_bone_and_omitted_flags(self):
  for r in self.pin['bindings']:
   self.assertEqual(r['rawFields']['mHitBoneName'],'C_BUFFBONE_GLB_CHEST_LOC');self.assertIs(r['rawFields']['bHaveHitBone'],True)
  for r in self.pin['resources'].values():
   self.assertNotIn('flags',r['definition']);self.assertFalse(any(k.lower().startswith('sound')for k in r['definition']))
 def test_full_native_roundtrip(self):
  self.assertEqual(source.verify(*source.load()),{'systems':3,'emitters':11,'bins':2,'textures':11,'meshes':0,'primarySpells':3,'characterRecords':60,'nativeParticleBytes':974269,'characterBinBytes':27930})
 def test_conflicting_source_preserves_bytes_and_mtime(self):
  row=self.pin['extraction']['files'][0]
  with tempfile.TemporaryDirectory()as temp:
   path=source.cache_path(temp,row);path.write_bytes(b'wrong');before=path.stat().st_mtime_ns
   with self.assertRaisesRegex(ValueError,'Frozen particle input'):source.checked(path,row['sha256'],row['bytes'])
   self.assertEqual(path.read_bytes(),b'wrong');self.assertEqual(path.stat().st_mtime_ns,before)
 def test_output_conflict_preflights_all_writes(self):
  with tempfile.TemporaryDirectory()as temp:
   new=Path(temp)/'new';bad=Path(temp)/'existing';bad.write_bytes(b'original');before=bad.stat().st_mtime_ns
   with self.assertRaises(ValueError):write_outputs([(new,b'new'),(bad,b'changed')])
   self.assertFalse(new.exists());self.assertEqual(bad.read_bytes(),b'original');self.assertEqual(bad.stat().st_mtime_ns,before)
 def test_character_bool_cannot_be_integer(self):
  char=copy.deepcopy(self.character);char['records'][self.pin['bindings'][0]['spell']]['mSpell']['bHaveHitEffect']=1
  with self.assertRaises(ValueError):source.validate(self.pin,self.model,char)

# These independently corrupt source semantics; canonical complete-record checks also
# cover fields omitted by the human-readable summary, including scalar types.
def definition(pin):return pin['resources']['MasterYi_BA_Tar_01']['definition']
def emitter(pin):return definition(pin)['complexEmitterDefinitionData'][0]
mutations={
 'missing_system':lambda p:p['resources'].pop('MasterYi_BA_Tar_02'),
 'extra_system':lambda p:p['resources'].update(invented=p['resources']['MasterYi_Crit_tar']),
 'missing_emitter':lambda p:definition(p)['complexEmitterDefinitionData'].pop(),
 'extra_emitter':lambda p:definition(p)['complexEmitterDefinitionData'].append(copy.deepcopy(emitter(p))),
 'wrong_record':lambda p:p['resources']['MasterYi_BA_Tar_01'].update(record='invented'),
 'wrong_link':lambda p:p['resources']['MasterYi_BA_Tar_01'].update(sourceBin='invented.bin'),
 'wrong_native_sha':lambda p:p['resources']['MasterYi_BA_Tar_01'].update(nativeSha256='0'*64),
 'omitted_flags_zero':lambda p:definition(p).update(flags=0),
 'omitted_sound_null':lambda p:definition(p).update(soundOnCreateDefault=None),
 'inferred_sound':lambda p:definition(p).update(soundPersistentDefault='invented'),
 'fluid_blend':lambda p:emitter(p).update(blendMode=4),
 'invented_bind':lambda p:emitter(p).update(bindWeight=0.0),
 'invented_local':lambda p:emitter(p).update(isLocalOrientation=False),
 'wrong_bone':lambda p:p['bindings'][0]['rawFields'].update(mHitBoneName='center'),
 'binding_bool_as_int':lambda p:p['bindings'][0]['rawFields'].update(bHaveHitBone=1),
 'missing_binding':lambda p:p['bindings'].pop(),
 'wrong_patch':lambda p:p['extraction'].update(referenceVersion='latest'),
 'wrong_manifest':lambda p:p['extraction'].update(manifest='invented'),
 'missing_texture':lambda p:p['extraction']['files'].pop(),
 'duplicate_file':lambda p:p['extraction']['files'].append(copy.deepcopy(p['extraction']['files'][0])),
 'unresolved_path':lambda p:emitter(p).update(texture='{0123456789abcdef}'),
 'changed_character_pin':lambda p:p['characterSource'].update(binSha256='0'*64),
}
for name,change in mutations.items():
 def test(self,change=change):self.invalid(change)
 setattr(PrimaryHitGuards,'test_rejects_'+name,test)
if __name__=='__main__':unittest.main()
