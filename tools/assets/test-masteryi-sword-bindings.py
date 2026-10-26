"""Authored sword condition/joint bridge and complete private transport guards."""
from pathlib import Path
import copy,json,runpy,struct,unittest
from masteryi_e_particles import load,SOURCE_ROOT
MODULE=runpy.run_path(str(Path(__file__).with_name('prepare-masteryi-sword-bindings.py')))
PACK=runpy.run_path(str(Path(__file__).with_name('pack-masteryi-e-textures.py')))
class SwordGuards(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.pin,cls.model=load();cls.character=json.loads(MODULE['CHARACTER'].read_text());cls.glb=MODULE['GLB'].read_bytes();cls.outputs,cls.reading=MODULE['generate_outputs']();cls.transport=json.loads(Path('docs/reference/masteryi/e-texture-transport.json').read_text())
 def test_exact_source_conditions_and_output(self):
  self.assertEqual(self.reading['conditions'],self.model['skin']['data']['Characters/MasterYi/Skins/Skin0']['PersistentEffectConditions'])
  for p,b in self.outputs:self.assertEqual(p.read_bytes(),b)
 def test_active_and_highlander_declarations_are_distinct(self):
  self.assertEqual([c['OwnerCondition']['Spell']for c in self.reading['conditions']],['Characters/MasterYi/Spells/WujuStyleAbility/WujuStyleSuperCharged','Characters/MasterYi/Spells/HighlanderAbility/Highlander']);self.assertEqual([b['effectKey']for b in self.reading['bindings']],['MasterYi_E_SuperChraged_buf','MasterYi_E_SuperChraged_Sword1_buf','MasterYi_E_SuperChraged_Sword1_buf','MasterYi_E_SuperChraged_Sword4_buf','MasterYi_E_buff'])
 def test_all_five_instances_retain_four_actual_joint_names(self):
  b=self.reading['bindings'];self.assertEqual([x['glbNode']for x in b],[87,88,89,90,87]);self.assertEqual(sum(x['emitters']for x in b),13);self.assertEqual(len({x['effectKey']for x in b}),4)
 def test_scale_and_unbound_resources_stay_separate(self):self.assertEqual((self.reading['sourceSkinScale'],self.reading['glbBakedUnitScale']),(1.5,.015));self.assertEqual(self.reading['declaredEKeysNotBoundByThisTable'],['MasterYi_E_Sword1_buf','MasterYi_E_Sword4_buf'])
 def test_complete_transport_replays_source_pixels(self):
  PACK['verify'](self.transport,SOURCE_ROOT);self.assertEqual((len(self.transport['textures']),sum(len(t['rectangles'])for t in self.transport['textures'])),(9,78));self.assertEqual((PACK['OUTPUT']/'textures.json').read_bytes(),Path('docs/reference/masteryi/e-texture-transport.json').read_bytes())
 def invalid_model(self,change):
  model=copy.deepcopy(self.model);change(model['skin']['data']['Characters/MasterYi/Skins/Skin0'])
  with self.assertRaises((ValueError,KeyError)):MODULE['project'](self.pin,model,self.character,self.glb)
 def test_missing_condition(self):self.invalid_model(lambda s:s['PersistentEffectConditions'].pop())
 def test_inferred_exclusivity(self):self.invalid_model(lambda s:s['PersistentEffectConditions'][0].update(exclusive=True))
 def test_swapped_buff(self):self.invalid_model(lambda s:s['PersistentEffectConditions'][1]['OwnerCondition'].update(Spell='Characters/MasterYi/Spells/WujuStyleAbility/WujuStyle'))
 def test_missing_attachment(self):self.invalid_model(lambda s:s['PersistentEffectConditions'][0]['PersistentVfxs'].pop())
 def test_replaced_resource(self):self.invalid_model(lambda s:s['PersistentEffectConditions'][1]['PersistentVfxs'][0].update(effectKey='MasterYi_E_Sword1_buf'))
 def test_changed_source_bone(self):self.invalid_model(lambda s:s['PersistentEffectConditions'][0]['PersistentVfxs'][0].update(boneName='root'))
 def test_changed_skin_scale(self):self.invalid_model(lambda s:s['skinMeshProperties'].update(skinScale=1.))
 def invalid_glb(self,change):
  size=struct.unpack_from('<I',self.glb,12)[0];doc=json.loads(self.glb[20:20+size]);change(doc);raw=json.dumps(doc,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4);tail=self.glb[20+size:];glb=b'glTF'+struct.pack('<II',2,20+len(raw)+len(tail))+struct.pack('<I',len(raw))+b'JSON'+raw+tail
  with self.assertRaisesRegex(ValueError,'attachment'):MODULE['project'](self.pin,self.model,self.character,glb)
 def test_missing_joint_name(self):self.invalid_glb(lambda d:d['nodes'][87].update(name='missing'))
 def test_ambiguous_joint_name(self):self.invalid_glb(lambda d:d['nodes'].append(copy.deepcopy(d['nodes'][87])))
 def test_non_joint_name(self):self.invalid_glb(lambda d:[s['joints'].remove(87)for s in d['skins']if 87 in s['joints']])
 def test_lost_active_child(self):
  c=copy.deepcopy(self.character);c['records']['Characters/MasterYi/Spells/WujuStyleAbility']['mChildSpells'].pop()
  with self.assertRaisesRegex(ValueError,'child'):MODULE['project'](self.pin,self.model,c,self.glb)
 def test_lost_full_bind(self):
  p=copy.deepcopy(self.pin);p['resources']['MasterYi_E_buff']['definition']['complexEmitterDefinitionData'][0]['bindWeight']['constantValue']=.5
  with self.assertRaisesRegex(ValueError,'full-bind'):MODULE['project'](p,self.model,self.character,self.glb)
 def test_lost_local_orientation(self):
  p=copy.deepcopy(self.pin);p['resources']['MasterYi_E_buff']['definition']['complexEmitterDefinitionData'][0].pop('particleIsLocalOrientation')
  with self.assertRaisesRegex(ValueError,'local-orientation'):MODULE['project'](p,self.model,self.character,self.glb)
 def test_missing_texture_rejected(self):
  t=copy.deepcopy(self.transport);t['textures'].pop()
  with self.assertRaisesRegex(ValueError,'closure'):PACK['verify'](t,SOURCE_ROOT)
 def test_missing_mip_rejected(self):
  t=copy.deepcopy(self.transport);t['textures'][0]['rectangles'].pop()
  with self.assertRaises(ValueError):PACK['verify'](t,SOURCE_ROOT)
 def test_boolean_is_not_native_integer_orientation(self):
  p=copy.deepcopy(self.pin);p['resources']['MasterYi_E_buff']['definition']['complexEmitterDefinitionData'][0]['particleIsLocalOrientation']=True
  with self.assertRaisesRegex(ValueError,'local-orientation'):MODULE['project'](p,self.model,self.character,self.glb)
 def test_integer_is_not_native_float_bind(self):
  p=copy.deepcopy(self.pin);p['resources']['MasterYi_E_buff']['definition']['complexEmitterDefinitionData'][0]['bindWeight']['constantValue']=1
  with self.assertRaisesRegex(ValueError,'full-bind'):MODULE['project'](p,self.model,self.character,self.glb)
if __name__=='__main__':unittest.main()
