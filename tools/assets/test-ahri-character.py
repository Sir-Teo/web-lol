"""Offline source-pipeline regression tests; run normally and with python -O."""
import copy
import runpy
import tempfile
import unittest
from pathlib import Path

verify_module = runpy.run_path(str(Path(__file__).with_name('verify-ahri-character.py')))
exporter = verify_module['exporter']
SOURCE, require = exporter['SOURCE'], exporter['require']


class AhriCharacterTests(unittest.TestCase):
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
                    del records['Characters/Ahri/Spells/AhriQAbility/AhriQReturnMissile']
                elif mutation == 'extraRecord':
                    records['UnexpectedRecord'] = {'__type': 'SpellObject'}
                else:
                    records['Characters/Ahri/Spells/AhriQAbility/AhriQ']['mSpell']['mana'].pop()
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
