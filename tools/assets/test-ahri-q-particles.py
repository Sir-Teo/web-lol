"""Offline native closure and omission guards; also run under Python optimization."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
import ahri_q_particles as source

class ParticleGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.pin, cls.model = source.load()

    def invalid(self, change):
        pin = copy.deepcopy(self.pin); change(pin)
        with self.assertRaises((ValueError, KeyError)): source.validate(pin, self.model)

    def test_exact_closure(self):
        bins, assets = source.validate(self.pin, self.model)
        self.assertEqual((len(bins), len(assets)), (5, 41))
        self.assertEqual(sum(p.endswith('.tex') for p in assets), 37)
        self.assertEqual(sum(p.endswith('.scb') for p in assets), 4)
        self.assertEqual(source.verify_native(self.pin, self.model, source.SOURCE_ROOT),
                         dict(systems=7, emitters=61, bins=5, textures=37, meshes=4))

    def test_missing_extra_and_changed_identities_reject(self):
        mutations = [
            lambda p: p['resources'].pop('Ahri_Q_mis_02'),
            lambda p: p['resources'].update(invented=p['resources']['Ahri_Q_Cas']),
            lambda p: p['resources']['Ahri_Q_Cas'].update(record='Characters/Ahri/Invented'),
            lambda p: p['resources']['Ahri_Q_Cas'].update(sourceBin='data/characters/ahri/invented.bin'),
            lambda p: p['resources']['Ahri_Q_Cas']['definition'].update(objectPath='wrong'),
            lambda p: p['resources']['Ahri_Q_Cas']['definition'].update(__type='Invented'),
            lambda p: p['resources']['Ahri_Q_Cas'].update(nativeSha256='0'*64),
            lambda p: p['extraction']['files'].pop(),
            lambda p: p['extraction']['files'].append(copy.deepcopy(p['extraction']['files'][0])),
            lambda p: p['extraction'].update(referenceVersion='latest'),
            lambda p: p['resources']['Ahri_Q_Cas']['definition'].update(unresolved='{0123456789abcdef}'),
            lambda p: p['resources']['Ahri_Q_Cas']['definition']['complexEmitterDefinitionData'].pop(),
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
        row = pin['resources']['Ahri_Q_Cas']['definition']
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
        self.assertTrue(replace(pin['resources']['Ahri_Q_Cas']['definition']))
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

if __name__ == '__main__': unittest.main()
