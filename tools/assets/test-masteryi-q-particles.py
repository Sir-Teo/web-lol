"""Offline closure/omission/native-identity guards; also run with python -O."""
from pathlib import Path
import copy
import tempfile
import unittest
import masteryi_q_particles as source


class ParticleGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.pin, cls.model = source.load()

    def invalid(self, change):
        pin = copy.deepcopy(self.pin); change(pin)
        with self.assertRaises((ValueError, KeyError)): source.validate(pin, self.model)

    def test_complete_source_has_eight_systems_twenty_emitters_and_exact_assets(self):
        bins, assets = source.validate(self.pin, self.model)
        self.assertEqual(len(bins), 7); self.assertEqual(len(assets), 25)
        self.assertEqual(sum(p.endswith('.tex') for p in assets), 23)
        self.assertEqual(sum(p.endswith('.scb') for p in assets), 2)

    def test_changed_pin_fails_before_json_or_native_parser(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)/'pin.json'; path.write_text('{}')
            with self.assertRaisesRegex(ValueError, 'Frozen particle input'): source.load(path)

    def test_changed_model_fails_before_native_parser(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)/'model.json'; path.write_text('{}')
            with self.assertRaisesRegex(ValueError, 'Frozen particle input'): source.load(model_path=path)

    def test_omitted_q_system_rejects(self): self.invalid(lambda p: p['resources'].pop('MasterYi_Q_AP_Mis'))
    def test_extra_system_rejects(self): self.invalid(lambda p: p['resources'].update({'invented': p['resources']['MasterYi_Q_Tar']}))
    def test_wrong_resource_binding_rejects(self): self.invalid(lambda p: p['resources']['MasterYi_Q_Tar'].update(record='Characters/MasterYi/Invented'))
    def test_unlinked_native_bin_rejects(self): self.invalid(lambda p: p['resources']['MasterYi_Q_Tar'].update(sourceBin='data/characters/masteryi/invented.bin'))
    def test_wrong_object_identity_rejects(self): self.invalid(lambda p: p['resources']['MasterYi_Q_Tar']['definition'].update(objectPath='wrong'))
    def test_wrong_source_type_rejects(self): self.invalid(lambda p: p['resources']['MasterYi_Q_Tar']['definition'].update(__type='Invented'))
    def test_missing_dependency_rejects(self): self.invalid(lambda p: p['extraction']['files'].pop())
    def test_duplicate_dependency_rejects(self): self.invalid(lambda p: p['extraction']['files'].append(copy.deepcopy(p['extraction']['files'][0])))
    def test_wrong_bin_identity_rejects(self): self.invalid(lambda p: p['resources']['MasterYi_Q_Tar'].update(nativeSha256='0'*64))
    def test_wrong_patch_rejects(self): self.invalid(lambda p: p['extraction'].update(referenceVersion='latest'))
    def test_unresolved_native_path_cannot_be_ignored(self): self.invalid(lambda p: p['resources']['MasterYi_Q_Tar']['definition'].update(unresolvedForReview='{0123456789abcdef}'))
    def test_empty_hit_does_not_gain_even_an_empty_emitter_list(self): self.invalid(lambda p: p['resources']['MasterYi_Q_Hit']['definition'].update(complexEmitterDefinitionData=[]))

    def test_unknown_fields_and_empty_records_survive_full_native_reparse(self):
        self.assertEqual(source.verify_native(self.pin, self.model, source.SOURCE_ROOT), {'systems':8,'emitters':20,'bins':7,'textures':23,'meshes':2})
        self.assertNotIn('complexEmitterDefinitionData', self.pin['resources']['MasterYi_Q_Hit']['definition'])
        unknown = [e['{9b111ae4}'] for r in self.pin['resources'].values() for e in r['definition'].get('complexEmitterDefinitionData', []) if '{9b111ae4}' in e]
        self.assertEqual(sorted(unknown), [10.0,10.0,10.0,30.0,30.0])

    def test_native_omission_check_rejects_an_invented_default(self):
        pin = copy.deepcopy(self.pin)
        pin['resources']['MasterYi_Q_Hit']['definition']['flags'] = 0
        with self.assertRaisesRegex(ValueError, 'Complete native particle record differs'): source.verify_native(pin, self.model, source.SOURCE_ROOT)

    def test_native_bool_is_not_interchangeable_with_integer(self):
        pin = copy.deepcopy(self.pin)
        emitter = next(e for r in pin['resources'].values() for e in r['definition'].get('complexEmitterDefinitionData', []) if e.get('disableBackfaceCull') is True)
        emitter['disableBackfaceCull'] = 1
        with self.assertRaisesRegex(ValueError, 'Complete native particle record differs'): source.verify_native(pin, self.model, source.SOURCE_ROOT)

    def test_existing_bad_file_is_rejected_without_repair(self):
        row = self.pin['extraction']['files'][0]
        with tempfile.TemporaryDirectory() as temp:
            path = source.cache_path(temp, row); path.write_bytes(b'wrong')
            before = path.stat().st_mtime_ns
            with self.assertRaisesRegex(ValueError, 'Frozen particle input'): source.checked(path, row['sha256'], row['bytes'])
            self.assertEqual(path.read_bytes(), b'wrong'); self.assertEqual(path.stat().st_mtime_ns, before)

    def test_flat_cache_hash_cannot_escape_its_directory(self):
        row = copy.deepcopy(self.pin['extraction']['files'][0]); row['wadPathHash'] = '../escape'
        with self.assertRaisesRegex(ValueError, 'Invalid flat source hash'): source.cache_path(Path('/tmp/sources'), row)


if __name__ == '__main__': unittest.main()
