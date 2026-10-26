"""Declared weights, raw omissions and validated clip selection guards."""
from pathlib import Path
import copy,runpy,unittest
from unittest.mock import patch
MODULE=runpy.run_path(str(Path(__file__).with_name('export-masteryi-attack-selection.py')))
class SelectionSource(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.pin,cls.names=MODULE['DECLARATIONS']['load']()
 def changed(self,change):
  pin=copy.deepcopy(self.pin);change(pin['records'])
  with patch.dict(MODULE['DECLARATIONS'],load=lambda:(pin,self.names)):
   with self.assertRaises(ValueError):MODULE['generate']()
 def root(self,change):self.changed(lambda records:change(records['Characters/MasterYi/CharacterRecords/Root']))
 def spell(self,name,change):self.changed(lambda records:change(records['Characters/MasterYi/Spells/'+name]['mSpell']))
 def test_declared_weights_clips_and_omitted_extra_weights_remain_distinct(self):
  outputs,reading=MODULE['generate']();self.assertEqual(len(outputs),2)
  self.assertEqual([r['probability']for r in reading['selection'].values()],[.5,.5])
  self.assertEqual([r['clip']for r in reading['selection'].values()],['entry_d5c55cfd','entry_0d6139b0'])
  self.assertEqual(reading['criticalClip'],'entry_e1798980')
  self.assertNotIn('mAttackName',reading['rawBasicAttack'])
  for row in reading['rawExtraAttacks'][1:]:self.assertNotIn('mAttackProbability',row)
  self.assertEqual([r['sourceFrame']for r in reading['markers']],[5.,5.,8.])
 def test_default_weight_boolean_rejects(self):self.root(lambda r:r['basicAttack'].update(mAttackProbability=True))
 def test_default_weight_integer_rejects(self):self.root(lambda r:r['basicAttack'].update(mAttackProbability=1))
 def test_default_weight_change_rejects(self):self.root(lambda r:r['basicAttack'].update(mAttackProbability=.25))
 def test_default_name_omission_cannot_be_filled(self):self.root(lambda r:r['basicAttack'].update(mAttackName='MasterYiBasicAttack'))
 def test_second_weight_missing_rejects(self):self.root(lambda r:r['extraAttacks'][0].pop('mAttackProbability'))
 def test_second_weight_string_rejects(self):self.root(lambda r:r['extraAttacks'][0].update(mAttackProbability='0.5'))
 def test_second_weight_change_rejects(self):self.root(lambda r:r['extraAttacks'][0].update(mAttackProbability=.75))
 def test_inferred_ordinary_extra_zero_rejects(self):self.root(lambda r:r['extraAttacks'][1].update(mAttackProbability=0.))
 def test_inferred_passive_extra_weight_rejects(self):self.root(lambda r:r['extraAttacks'][2].update(mAttackProbability=.5))
 def test_extra_slot_removed_rejects(self):self.root(lambda r:r['extraAttacks'].pop())
 def test_second_slot_name_substitution_rejects(self):self.root(lambda r:r['extraAttacks'][0].update(mAttackName='MasterYiDoubleStrike'))
 def test_critical_slot_substitution_rejects(self):self.root(lambda r:r['critAttacks'][0].update(mAttackName='MasterYiBasicAttack'))
 def test_second_animation_name_substitution_rejects(self):self.spell('MasterYiBasicAttack2',lambda s:s.update(mAnimationName='Attack1'))
 def test_default_animation_omission_cannot_be_filled(self):self.spell('MasterYiBasicAttack',lambda s:s.update(mAnimationName='Attack1'))
 def test_critical_animation_substitution_rejects(self):self.spell('MasterYiCritAttack',lambda s:s.update(mAnimationName='Attack2'))
if __name__=='__main__':unittest.main()
