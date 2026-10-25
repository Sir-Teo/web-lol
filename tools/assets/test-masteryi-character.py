"""Offline source-pipeline regression tests; run normally and with python -O."""
import copy
import runpy
import tempfile
import unittest
from pathlib import Path

verify_module = runpy.run_path(str(Path(__file__).with_name('verify-masteryi-character.py')))
exporter = verify_module['exporter']
SOURCE, require = exporter['SOURCE'], exporter['require']


class MasterYiCharacterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pin, cls.dd = exporter['load']()
        cls.raw = (SOURCE / 'character.bin').read_bytes()

    def test_full_decode_and_exact_generated_bytes(self):
        verify_module['verify'](self.raw, self.pin['records'])
        self.assertEqual(exporter['generate'](), (SOURCE / 'declarations.json').read_bytes())

    def test_raw_tampering_rejected(self):
        raw = bytearray(self.raw)
        raw[-1] ^= 1
        with self.assertRaisesRegex(ValueError, 'BIN differs'):
            verify_module['verify'](bytes(raw), self.pin['records'])

    def test_complete_decode_rejects_semantic_mutations(self):
        for mutation in ['number', 'boolean', 'missingRecord', 'extraRecord', 'array']:
            with self.subTest(mutation=mutation):
                records = copy.deepcopy(self.pin['records'])
                root = records[exporter['ROOT_RECORD']]
                if mutation == 'number':
                    root['damagePerLevelModifiable']['baseValue'] = 0
                elif mutation == 'boolean':
                    root['primaryAbilityResource']['arType'] = False
                elif mutation == 'missingRecord':
                    del records['Characters/MasterYi/Spells/AlphaStrikeAbility/AlphaStrikeMissileReturn']
                elif mutation == 'extraRecord':
                    records['UnexpectedRecord'] = {'__type': 'SpellObject'}
                else:
                    records['Characters/MasterYi/Spells/AlphaStrikeAbility/AlphaStrike']['mSpell']['mana'].pop()
                with self.assertRaisesRegex(ValueError, 'closure differs'):
                    verify_module['verify'](self.raw, records)

    def test_exact_alias_boundary(self):
        same, fnv = verify_module['same'], exporter['fnv']
        alias = '{%08x}' % fnv('RAPCoefficient')
        self.assertTrue(same('rAPCoefficient', alias))
        self.assertFalse(same('OtherCoefficient', alias))
        self.assertFalse(same('rAPCoefficient', alias.upper()))
        self.assertFalse(same(False, 0))
        self.assertFalse(same({'a': 1}, {'a': 1, 'b': 2}))
        self.assertFalse(same([1], [1, 2]))

    def test_rank_disagreement_and_calculation_links_rejected(self):
        altered = copy.deepcopy(self.dd)
        altered['spells'][0]['cost'][0] += 1
        with self.assertRaisesRegex(ValueError, 'Rank array differs'):
            exporter['project'](self.pin, altered)
        altered = copy.deepcopy(self.dd)
        altered['stats']['hp'] += 1
        with self.assertRaisesRegex(ValueError, 'Stat disagreements changed'):
            exporter['project'](self.pin, altered)
        for names in [{}, {'RAPCoefficient': [1], 'rapcoefficient': [1]}]:
            with self.assertRaisesRegex(ValueError, 'Ambiguous or missing'):
                exporter['calculation_links']({'x': {'mDataValue': 'rAPCoefficient'}}, names)

    def test_omissions_are_preserved_without_public_default_injection(self):
        output = exporter['project'](self.pin, self.dd)
        spells = {s['id']: s for s in output['spells']}
        for name, field, public in [('Meditate', 'cooldownTime', [10]*5),
                                    ('WujuStyle', 'mana', [0]*5)]:
            row = spells[name]['rankArrays'][field]
            self.assertFalse(row['present'])
            self.assertIsNone(row['rankValues'])
            self.assertIsNone(row['agreesWithinExactNumericComparison'])
            self.assertNotIn(field, spells[name]['declaration'])
            self.assertEqual(row['dataDragonValues'], public)
            pin = copy.deepcopy(self.pin)
            pin['records'][spells[name]['record']]['mSpell'][field] = public
            with self.assertRaisesRegex(ValueError, 'Rank field presence changed'):
                exporter['project'](pin, self.dd)
        self.assertNotIn('mSpellCalculations', spells['Highlander']['declaration'])
        self.assertEqual(sum(len(s['calculationLinks']) for s in output['spells']), 23)
        self.assertTrue(all(flag is False for flag in output['acceptance'].values()))

    def test_modified_calculation_links_and_reposition_boundary(self):
        for calculations in [
            {'A': {'mModifiedGameCalculation': 'Missing'}},
            {'A': {'mModifiedGameCalculation': 'Total'}, 'Total': {}, 'total': {}},
        ]:
            with self.assertRaisesRegex(ValueError, 'Ambiguous or missing'):
                exporter['calculation_links'](calculations, {})
        links = exporter['calculation_links']({'A': {'mModifiedGameCalculation': 'Total'},
                                               'Total': {}}, {})
        self.assertEqual(links[0]['kind'], 'calculation')
        self.assertEqual(links[0]['target'], 'Total')
        pin = copy.deepcopy(self.pin)
        pin['records']['Characters/MasterYi/Spells/AlphaStrikeAbility']['mChildSpells'].append('{6ae04a15}')
        with self.assertRaisesRegex(ValueError, 'Reposition relation changed'):
            exporter['project'](pin, self.dd)
        pin = copy.deepcopy(self.pin)
        pin['records']['Characters/MasterYi/Spells/HighlanderAbility/Highlander']['mSpell']['mSpellCalculations'] = {}
        with self.assertRaisesRegex(ValueError, 'Highlander calculation omission changed'):
            exporter['project'](pin, self.dd)

    def test_all_input_hashes_guarded(self):
        with tempfile.TemporaryDirectory() as temporary:
            destination = Path(temporary)
            for name in exporter['PINS']:
                (destination / name).write_bytes((SOURCE / name).read_bytes())
            for name in exporter['PINS']:
                original = (destination / name).read_bytes()
                (destination / name).write_bytes(original + b' ')
                with self.assertRaisesRegex(ValueError, 'Frozen source changed: ' + name):
                    exporter['load'](destination)
                (destination / name).write_bytes(original)

    def test_output_checks_and_overwrite_guard(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / 'declarations.json'
            with self.assertRaisesRegex(ValueError, 'missing'):
                exporter['publish'](b'expected', output, check=True)
            self.assertFalse(output.exists())
            exporter['publish'](b'expected', output)
            timestamp = output.stat().st_mtime_ns
            exporter['publish'](b'expected', output, check=True)
            exporter['publish'](b'expected', output)
            self.assertEqual(timestamp, output.stat().st_mtime_ns)
            for check in [False, True]:
                with self.assertRaisesRegex(ValueError, 'refusing overwrite'):
                    exporter['publish'](b'changed', output, check=check)
                self.assertEqual(output.read_bytes(), b'expected')


if __name__ == '__main__':
    unittest.main()
