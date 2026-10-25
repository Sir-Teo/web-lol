"""Offline Alpha Strike projection guards; no runtime/native acceptance."""
import copy
import json
import runpy
import unittest
from pathlib import Path

module = runpy.run_path(str(Path(__file__).with_name('export-masteryi-q.py')))
generate = module['generate']
source = generate.__globals__['source']
load = source['load']


class AlphaStrikeProjectionTests(unittest.TestCase):
    def tearDown(self):
        source['load'] = load

    def reject(self, change):
        pin, dd = copy.deepcopy(load())
        change(pin['records'][module['SPELL']]['mSpell'], dd, pin['records'])
        source['load'] = lambda: (pin, dd)
        with self.assertRaises(ValueError):
            generate()

    def test_rank_slices_and_omissions(self):
        output = generate().decode().split('export const MASTER_YI_Q = ', 1)[1]
        data = json.loads(output.removesuffix(' as const;\n'))
        self.assertEqual(data['bonusMonsterDamageByRank'], [60, 85, 110, 135, 160])
        self.assertEqual(data['manaByRank'], [50, 55, 60, 65, 70])
        self.assertEqual(data['cooldownSecondsByRank'], [20, 19.5, 19, 18.5, 18])
        for key in ['sourceAnimationName', 'sourceTargetingType', 'sourceDamageStatFormula']:
            self.assertIsNone(data[key])

    def test_damage_stat_omission(self):
        self.reject(lambda s, d, r: s['mSpellCalculations']['TotalDamage']
                    ['mFormulaParts'][1].__setitem__('mStatFormula', 1))

    def test_animation_omission(self):
        self.reject(lambda s, d, r: s.__setitem__('mAnimationName', 'Spell1'))

    def test_targeting_omission(self):
        self.reject(lambda s, d, r: s.__setitem__('mTargetingTypeData', {'__type': 'Target'}))

    def test_secondary_radius(self):
        self.reject(lambda s, d, r: s['castRadiusSecondary'].__setitem__(0, 600))

    def test_root_boolean(self):
        self.reject(lambda s, d, r: s.__setitem__('cantCastWhileRooted', 1))

    def test_public_resource(self):
        self.reject(lambda s, d, r: d['spells'][0]['cost'].__setitem__(0, 0))

    def test_standard_damage(self):
        self.reject(lambda s, d, r: s['DataValues'][1]['values'].__setitem__(1, 25))

    def test_standard_on_hit(self):
        self.reject(lambda s, d, r: s['DataValues'][7]['values'].__setitem__(0, 1))

    def test_child_movement(self):
        self.reject(lambda s, d, r: r[module['ABILITY'] + '/AlphaStrikeBounce']['mSpell']
                    ['mMissileSpec']['movementComponent'].__setitem__('mTravelTime', 0.2))

    def test_cooldown_multiplier(self):
        self.reject(lambda s, d, r: s['mSpellCalculations']['BasicAttackCDR']
                    ['mFormulaParts'][0]['mPart1'].__setitem__('__type', 'NumberCalculationPart'))


if __name__ == '__main__':
    unittest.main()
