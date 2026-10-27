"""Offline guard checks for Meditate source preparation; no runtime acceptance."""
import copy
import runpy
import unittest
from pathlib import Path

module = runpy.run_path(str(Path(__file__).with_name('export-masteryi-w.py')))
generate = module['generate']
source = generate.__globals__['source']
load = source['load']


class MeditateProjectionTests(unittest.TestCase):
    def tearDown(self):
        source['load'] = load

    def reject(self, change):
        pin, dd = copy.deepcopy(load())
        change(pin['records'][module['SPELL']]['mSpell'], dd, pin['records'])
        source['load'] = lambda: (pin, dd)
        with self.assertRaises(ValueError):
            generate()

    def test_projection_retains_omissions(self):
        output = generate().decode()
        self.assertIn('"sourceCooldownSeconds": null', output)
        self.assertIn('"sourceHealStatId": null', output)
        self.assertIn('"graphSequence": [\n    "Spell2_Loop"', output)
        self.assertIn('120.0,\n    200.0,\n    280.0,\n    360.0,\n    440.0', output)

    def test_rank_heal(self):
        self.reject(lambda s, d, r: s['DataValues'][0]['values'].__setitem__(1, 200))

    def test_heal_formula_default_not_injected(self):
        self.reject(lambda s, d, r: s['mSpellCalculations']['TotalHeal']['mFormulaParts'][1]
                    .__setitem__('mStat', 0))

    def test_source_cooldown_not_injected(self):
        self.reject(lambda s, d, r: s.__setitem__('cooldownTime', [10]*7))

    def test_public_cooldown(self):
        self.reject(lambda s, d, r: d['spells'][1]['cooldown'].__setitem__(0, 9))

    def test_numeric_boolean(self):
        self.reject(lambda s, d, r: s.__setitem__('mCantCancelWhileWindingUp', 1))

    def test_own_animation(self):
        self.reject(lambda s, d, r: s.__setitem__('mAnimationName', 'Spell3'))

    def test_attack_reset_trait(self):
        self.reject(lambda s, d, r: s['mSpellTags'].remove('Trait_AttackReset'))


if __name__ == '__main__':
    unittest.main()
