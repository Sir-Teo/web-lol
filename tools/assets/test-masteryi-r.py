"""Offline Highlander projection guards; no runtime/native acceptance."""
import copy
import runpy
import unittest
from pathlib import Path

module = runpy.run_path(str(Path(__file__).with_name('export-masteryi-r.py')))
generate = module['generate']
source = generate.__globals__['source']
load = source['load']


class HighlanderProjectionTests(unittest.TestCase):
    def tearDown(self):
        source['load'] = load

    def reject(self, change):
        pin, dd = copy.deepcopy(load())
        change(pin['records'][module['SPELL']]['mSpell'], dd, pin['records'])
        source['load'] = lambda: (pin, dd)
        with self.assertRaises(ValueError):
            generate()

    def test_omissions_and_rank_slices(self):
        output = generate().decode()
        self.assertIn('"sourceCalculations": null', output)
        self.assertIn('"sourceAnimationName": ""', output)
        self.assertIn('25.0,\n    45.0,\n    65.0', output)
        self.assertIn('40.0,\n    50.0,\n    60.0', output)

    def test_standard_duration(self):
        self.reject(lambda s, d, r: s['DataValues'][0]['values'].__setitem__(0, 5))

    def test_formula_not_fabricated(self):
        self.reject(lambda s, d, r: s.__setitem__('mSpellCalculations', {}))

    def test_empty_animation_not_replaced(self):
        self.reject(lambda s, d, r: s.__setitem__('mAnimationName', 'Spell4'))

    def test_source_cooldown(self):
        self.reject(lambda s, d, r: s['cooldownTime'].__setitem__(1, 80))

    def test_public_resource(self):
        self.reject(lambda s, d, r: d['spells'][3]['cost'].__setitem__(0, 0))

    def test_numeric_boolean(self):
        self.reject(lambda s, d, r: s.__setitem__('mCantCancelWhileWindingUp', 1))

    def test_passive_binding(self):
        self.reject(lambda s, d, r: r['Characters/MasterYi/Spells/HighlanderAbility']
                    ['mChildSpells'].__setitem__(1, 'wrong'))


if __name__ == '__main__':
    unittest.main()
