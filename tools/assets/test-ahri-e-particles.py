"""Offline native closure and omission guards; also run under Python optimization."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
import subprocess
import sys
import ahri_e_particles as source

class ParticleGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.pin, cls.model = source.load()

    def invalid(self, change):
        pin = copy.deepcopy(self.pin); change(pin)
        with self.assertRaises((ValueError, KeyError)): source.validate(pin, self.model)

    def test_exact_closure(self):
        bins, assets = source.validate(self.pin, self.model)
        self.assertEqual((len(bins), len(assets)), (3, 22))
        self.assertEqual(sum(p.endswith('.tex') for p in assets), 20)
        self.assertEqual(sum(p.endswith('.scb') for p in assets), 2)
        self.assertEqual(source.verify_native(self.pin, self.model, source.SOURCE_ROOT),
                         dict(systems=4, emitters=26, bins=3, textures=20, meshes=2))

    def test_missing_extra_and_changed_identities_reject(self):
        mutations = [
            lambda p: p['resources'].pop('Ahri_E_buf'),
            lambda p: p['resources'].update(invented=p['resources']['Ahri_E_cas']),
            lambda p: p['resources']['Ahri_E_cas'].update(record='Characters/Ahri/Invented'),
            lambda p: p['resources']['Ahri_E_cas'].update(sourceBin='data/characters/ahri/invented.bin'),
            lambda p: p['resources']['Ahri_E_cas']['definition'].update(objectPath='wrong'),
            lambda p: p['resources']['Ahri_E_cas']['definition'].update(__type='Invented'),
            lambda p: p['resources']['Ahri_E_cas'].update(nativeSha256='0'*64),
            lambda p: p['extraction']['files'].pop(),
            lambda p: p['extraction']['files'].append(copy.deepcopy(p['extraction']['files'][0])),
            lambda p: p['extraction'].update(referenceVersion='latest'),
            lambda p: p['resources']['Ahri_E_cas']['definition'].update(unresolved='{0123456789abcdef}'),
            lambda p: p['resources']['Ahri_E_cas']['definition']['complexEmitterDefinitionData'].pop(),
        ]
        for mutation in mutations:
            with self.subTest(mutation=mutations.index(mutation)): self.invalid(mutation)

    def test_changed_pin_or_model_reject_before_native_parser(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/'changed.json'; path.write_text('{}')
            with self.assertRaisesRegex(ValueError, 'Frozen particle input'): source.load(path)
            with self.assertRaisesRegex(ValueError, 'Frozen particle input'): source.load(model_path=path)

    def test_native_reparse_rejects_invented_default(self):
        pin = copy.deepcopy(self.pin)
        row = pin['resources']['Ahri_E_cas']['definition']
        self.assertNotIn('inventedDefault', row); row['inventedDefault'] = 0
        with self.assertRaisesRegex(ValueError, 'Complete native particle record differs'):
            source.verify_native(pin, self.model, source.SOURCE_ROOT)

    def test_native_reparse_preserves_boolean_number_distinction(self):
        pin = copy.deepcopy(self.pin)
        def replace(value):
            if isinstance(value, dict):
                for key, child in value.items():
                    if isinstance(child, bool): value[key] = int(child); return True
                    if replace(child): return True
            elif isinstance(value, list):
                for child in value:
                    if replace(child): return True
            return False
        self.assertTrue(replace(pin['resources']['Ahri_E_cas']['definition']))
        with self.assertRaisesRegex(ValueError, 'Complete native particle record differs'):
            source.verify_native(pin, self.model, source.SOURCE_ROOT)

    def test_conflicting_native_file_is_not_repaired(self):
        row = self.pin['extraction']['files'][0]
        with tempfile.TemporaryDirectory() as tmp:
            path = source.cache_path(tmp, row); path.write_bytes(b'wrong')
            before = path.stat().st_mtime_ns
            with self.assertRaisesRegex(ValueError, 'Frozen particle input'): source.checked(path, row['sha256'], row['bytes'])
            self.assertEqual(path.read_bytes(), b'wrong'); self.assertEqual(path.stat().st_mtime_ns, before)

    def test_leaf_and_parent_symlinks_reject(self):
        row = self.pin['extraction']['files'][0]
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp); target = source.cache_path(base, row)
            target.symlink_to(source.cache_path(source.SOURCE_ROOT, row).resolve())
            with self.assertRaisesRegex(ValueError, 'symlink'): source.cache_path(base, row)
            target.unlink(); redirect = base/'redirect'; redirect.symlink_to(source.SOURCE_ROOT.resolve(), target_is_directory=True)
            with self.assertRaisesRegex(ValueError, 'symlink'): source.cache_path(redirect, row)

    def test_omitted_simple_arrays_are_not_invented(self):
        for resource, row in self.pin['resources'].items():
            self.assertNotIn('simpleEmitterDefinitionData', row['definition'])
            pin = copy.deepcopy(self.pin)
            pin['resources'][resource]['definition']['simpleEmitterDefinitionData'] = []
            with self.assertRaisesRegex(ValueError, 'Complete native particle record differs'):
                source.verify_native(pin, self.model, source.SOURCE_ROOT)

    def test_restore_refuses_conflicting_cache_before_any_output_write(self):
        row = self.pin['extraction']['files'][0]
        with tempfile.TemporaryDirectory() as tmp:
            path = source.cache_path(tmp, row)
            path.write_bytes(b'conflicting native source')
            before = path.stat().st_mtime_ns
            result = subprocess.run(
                [sys.executable, *(['-O'] if sys.flags.optimize else []),
                 'tools/assets/extract-ahri-e-particles.py', '--sources', tmp],
                capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Frozen particle input differs', result.stderr)
            self.assertEqual(list(Path(tmp).iterdir()), [path])
            self.assertEqual(path.read_bytes(), b'conflicting native source')
            self.assertEqual(path.stat().st_mtime_ns, before)

if __name__ == '__main__': unittest.main()
