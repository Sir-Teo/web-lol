"""Mutation guards for the standard-mode Wuju Style projection."""
import copy
import runpy
import unittest
from pathlib import Path

module = runpy.run_path(str(Path(__file__).with_name('export-masteryi-e.py')))
generate = module['generate']
source = generate.__globals__['source']
load = source['load']


class WujuProjectionTests(unittest.TestCase):
    def tearDown(self):
        source['load'] = load

    def reject(self, change):
        pin, dd = copy.deepcopy(load())
        change(pin['records'][module['SPELL']]['mSpell'], dd, pin['records'])
        source['load'] = lambda: (pin, dd)
        with self.assertRaises(ValueError):
            generate()

    def test_output(self):
        self.assertEqual(generate(), (source['ROOT'] / 'src/content/masteryi-e.ts').read_bytes())

    def test_damage_rank(self):
        self.reject(lambda s, d, r: s['DataValues'][0]['values'].__setitem__(1, 15))

    def test_bonus_stat(self):
        self.reject(lambda s, d, r: s['mSpellCalculations']['TotalDamage']['mFormulaParts'][1]
                    .__setitem__('mStatFormula', 0))

    def test_invented_mana(self):
        self.reject(lambda s, d, r: s.__setitem__('mana', [0]*7))

    def test_public_mana(self):
        self.reject(lambda s, d, r: d['spells'][2]['cost'].__setitem__(0, 10))

    def test_invented_animation(self):
        self.reject(lambda s, d, r: s.__setitem__('mAnimationName', 'Spell3'))

    def test_boolean_permission(self):
        self.reject(lambda s, d, r: s.__setitem__('mCantCancelWhileWindingUp', 1))

    def test_buff_binding(self):
        self.reject(lambda s, d, r: r['Characters/MasterYi/Spells/WujuStyleAbility']
                    ['mChildSpells'].__setitem__(1, 'wrong'))


if __name__ == '__main__':
    unittest.main()
