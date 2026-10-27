"""Checked target-profile translation and immutable asset preflight controls."""
from pathlib import Path
import importlib.util
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('contact_export', Path(__file__).with_name('export-masteryi-q-contact-particles.py'))
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)


class BirthControls(unittest.TestCase):
    def test_scalar(self): self.assertEqual(module.birth({'constantValue': 3}, 1), {'value': [3], 'probabilities': None})
    def test_vector(self): self.assertEqual(module.birth([1, 2, 3], []), {'value': [1, 2, 3], 'probabilities': None})
    def test_fallback(self): self.assertEqual(module.birth({}, [0, 0, 0])['value'], [0, 0, 0])
    def test_native_correlated_tables(self):
        source = {'constantValue': [1, 1, 1], 'dynamics': {'times': [0], 'values': [[10, -180, 0]],
            'probabilityTables': [{'keyTimes': [0, 1], 'keyValues': [1, 0]}, {'__type': 'VfxProbabilityTableData'}]}}
        self.assertEqual(module.birth(source, [0,0,0]), {'value': [10, -180, 0], 'probabilities': [
            {'times': [0, 1], 'values': [1, 0], 'single': 1}, {'times': [], 'values': [], 'single': 1}]})
    def test_unknown_birth_field(self):
        with self.assertRaises(ValueError): module.birth({'unknown': 1}, 0)
    def test_unknown_birth_dynamics(self):
        with self.assertRaises(ValueError): module.birth({'dynamics': {'unknown': 1}}, 0)
    def test_animated_birth_is_not_collapsed(self):
        with self.assertRaises(ValueError): module.birth({'dynamics': {'times': [0, 1], 'values': [1, 2]}}, 0)
    def test_probability_extent(self):
        with self.assertRaises(ValueError): module.birth({'dynamics': {'times': [0], 'values': [1],
            'probabilityTables': [{'keyTimes': [0], 'keyValues': []}]}}, 0)
    def test_unknown_probability_field(self):
        with self.assertRaises(ValueError): module.birth({'dynamics': {'times': [0], 'values': [1],
            'probabilityTables': [{'unknown': 1}]}}, 0)


class CurveControls(unittest.TestCase):
    def test_default(self): self.assertEqual(module.curve({}, [1,1,1]), {'times': [0], 'values': [[1,1,1]]})
    def test_constant(self): self.assertEqual(module.curve({'constantValue': [2,3,4]}, []), {'times': [0], 'values': [[2,3,4]]})
    def test_empty_native_probability_keeps_curve(self):
        self.assertEqual(module.curve({'dynamics': {'times': [0,1], 'values': [[1,1,1],[2,3,2]],
            'probabilityTables': [{'__type': 'VfxProbabilityTableData'}]}}, []), {'times': [0,1], 'values': [[1,1,1],[2,3,2]]})
    def test_nontrivial_probability_is_not_dropped(self):
        with self.assertRaises(ValueError): module.curve({'dynamics': {'times': [0], 'values': [[1,1,1]],
            'probabilityTables': [{'keyTimes': [0,1], 'keyValues': [0,1]}]}}, [])
    def test_unknown_curve_field(self):
        with self.assertRaises(ValueError): module.curve({'unknown': 1}, [])
    def test_unknown_curve_dynamics(self):
        with self.assertRaises(ValueError): module.curve({'dynamics': {'unknown': 1}}, [])
    def test_curve_extent(self):
        with self.assertRaises(ValueError): module.curve({'dynamics': {'times': [0,1], 'values': [[1,1,1]]}}, [])


class OutputControls(unittest.TestCase):
    def test_immutable_conflict_preflights_before_any_write(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); mutable = root/'generated.json'; existing = root/'native.png'; missing = root/'new.png'
            mutable.write_bytes(b'original'); existing.write_bytes(b'keep')
            outputs = [(mutable, b'new', False), (existing, b'conflict', True), (missing, b'new', True)]
            with patch.object(module, 'build', return_value=(outputs, {})), patch.object(sys, 'argv', ['export']):
                with self.assertRaisesRegex(ValueError, 'Output differs'): module.main()
            self.assertEqual(mutable.read_bytes(), b'original'); self.assertEqual(existing.read_bytes(), b'keep')
            self.assertFalse(missing.exists())
    def test_check_never_rewrites_different_generated_profile(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)/'profile.json'; path.write_bytes(b'old')
            with patch.object(module, 'build', return_value=([(path,b'new',False)], {})), patch.object(sys, 'argv', ['export','--check']):
                with self.assertRaisesRegex(ValueError, 'Output differs'): module.main()
            self.assertEqual(path.read_bytes(), b'old')
    def test_changed_transport_pin_rejected_before_any_asset_output(self):
        with patch.object(module, 'TRANSPORT_SHA256', '0'*64):
            with self.assertRaisesRegex(ValueError, 'Frozen particle input differs'): module.build()


if __name__ == '__main__': unittest.main()
