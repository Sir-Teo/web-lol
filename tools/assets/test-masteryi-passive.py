"""Mutation checks for the offline Double Strike declaration projection."""
import copy
import runpy
import unittest
from pathlib import Path

module = runpy.run_path(str(Path(__file__).with_name('export-masteryi-passive.py')))
generate = module['generate']
source = generate.__globals__['source']
load = source['load']


class PassiveProjectionTests(unittest.TestCase):
    def tearDown(self):
        source['load'] = load

    def reject(self, change):
        pin, dd = load()
        pin = copy.deepcopy(pin)
        change(pin['records'])
        source['load'] = lambda: (pin, dd)
        with self.assertRaises(ValueError):
            generate()

    def test_output(self):
        expected = (source['ROOT'] / 'src/content/masteryi-passive.ts').read_bytes()
        self.assertEqual(generate(), expected)

    def test_count(self):
        self.reject(lambda r: r[module['PASSIVE']]['mSpell']['DataValues'][1]['values'].__setitem__(0, 5))

    def test_damage(self):
        self.reject(lambda r: r[module['PASSIVE']]['mSpell']['mSpellCalculations']['TotalDamage']
                    ['mFormulaParts'][0].__setitem__('mCoefficient', 0.75))

    def test_false_permission(self):
        self.reject(lambda r: r[module['CHILD']]['mSpell'].__setitem__('canCastWhileDisabled', False))

    def test_numeric_permission(self):
        self.reject(lambda r: r[module['CHILD']]['mSpell'].__setitem__('canCastWhileDisabled', 1))

    def test_unbound_child(self):
        self.reject(lambda r: r[source['ROOT_RECORD']]['extraSpellsList'].__setitem__(0, 'wrong'))

    def test_foreign_pose(self):
        self.reject(lambda r: r[module['CHILD']]['mSpell'].__setitem__('mAnimationName', 'Attack1'))

    def test_child_calculation(self):
        self.reject(lambda r: r[module['CHILD']]['mSpell'].__setitem__('DataValues', []))


if __name__ == '__main__':
    unittest.main()
