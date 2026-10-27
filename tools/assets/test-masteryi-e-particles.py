"""Offline WujuStyle closure, omission and complete native identity regressions."""
from pathlib import Path
import copy
import tempfile
import unittest
import masteryi_e_particles as source


class WujuStyleGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.pin, cls.model = source.load()

    def invalid(self, change):
        pin = copy.deepcopy(self.pin); change(pin)
        with self.assertRaises((ValueError, KeyError)): source.validate(pin, self.model)

    def test_all_six_systems_and_nine_textures_are_retained(self):
        bins, assets = source.validate(self.pin, self.model)
        self.assertEqual(len(bins), 4); self.assertEqual(len(assets), 9)
        self.assertEqual(sum(p.endswith('.tex') for p in assets), 9)
        self.assertEqual(sum(p.endswith('.scb') for p in assets), 0)

    def test_changed_pin_fails_before_json_or_parser(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)/'pin.json'; path.write_text('{}')
            with self.assertRaisesRegex(ValueError, 'Frozen particle input'): source.load(path)

    def test_changed_model_fails_before_parser(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)/'model.json'; path.write_text('{}')
            with self.assertRaisesRegex(ValueError, 'Frozen particle input'): source.load(model_path=path)

    def test_omitted_system_rejects(self): self.invalid(lambda p: p['resources'].pop('MasterYi_E_Sword4_buf'))
    def test_extra_system_rejects(self): self.invalid(lambda p: p['resources'].update({'invented': p['resources']['MasterYi_E_buff']}))
    def test_wrong_binding_rejects(self): self.invalid(lambda p: p['resources']['MasterYi_E_buff'].update(record='Invented'))
    def test_unlinked_bin_rejects(self): self.invalid(lambda p: p['resources']['MasterYi_E_buff'].update(sourceBin='data/invented.bin'))
    def test_wrong_identity_rejects(self): self.invalid(lambda p: p['resources']['MasterYi_E_buff']['definition'].update(objectPath='wrong'))
    def test_wrong_record_type_rejects(self): self.invalid(lambda p: p['resources']['MasterYi_E_buff']['definition'].update(__type='Invented'))
    def test_missing_emitter_rejects(self): self.invalid(lambda p: p['resources']['MasterYi_E_SuperChraged_buf']['definition']['complexEmitterDefinitionData'].pop())
    def test_missing_dependency_rejects(self): self.invalid(lambda p: p['extraction']['files'].pop())
    def test_duplicate_dependency_rejects(self): self.invalid(lambda p: p['extraction']['files'].append(copy.deepcopy(p['extraction']['files'][0])))
    def test_wrong_native_bin_rejects(self): self.invalid(lambda p: p['resources']['MasterYi_E_buff'].update(nativeSha256='0'*64))
    def test_wrong_patch_rejects(self): self.invalid(lambda p: p['extraction'].update(referenceVersion='latest'))
    def test_unresolved_path_rejects(self): self.invalid(lambda p: p['resources']['MasterYi_E_buff']['definition'].update(unresolved='{0123456789abcdef}'))
    def test_sound_cannot_be_inferred_from_system_name(self): self.invalid(lambda p: p['resources']['MasterYi_E_SuperChraged_buf']['definition'].update(soundOnCreateDefault='Play_sfx_MasterYi_WujuStyle_OnBuffActivate'))

    def test_native_roundtrip_preserves_all_definitions_and_opaque_types(self):
        self.assertEqual(source.verify_native(self.pin, self.model, source.SOURCE_ROOT),
                         {'systems':6, 'emitters':14, 'bins':4, 'textures':9, 'meshes':0})
        opaque = {s for r in self.pin['resources'].values() for s in source.strings(r['definition']) if s.startswith('{')}
        self.assertEqual(opaque, set())

    def test_native_check_rejects_invented_omitted_default(self):
        pin = copy.deepcopy(self.pin)
        pin['resources']['MasterYi_E_SuperChraged_buf']['definition']['flags'] = 0
        with self.assertRaisesRegex(ValueError, 'Complete native particle record differs'):
            source.verify_native(pin, self.model, source.SOURCE_ROOT)

    def test_native_check_distinguishes_bool_from_int(self):
        pin = copy.deepcopy(self.pin)
        def change(value):
            if isinstance(value, dict):
                for key, child in value.items():
                    if type(child) is int and child in (0,1): value[key] = bool(child); return True
                    if change(child): return True
            elif isinstance(value, list):
                for child in value:
                    if change(child): return True
            return False
        self.assertTrue(change(pin['resources']))
        with self.assertRaisesRegex(ValueError, 'Complete native particle record differs'):
            source.verify_native(pin, self.model, source.SOURCE_ROOT)

    def test_conflicting_file_is_rejected_without_repair(self):
        row = self.pin['extraction']['files'][0]
        with tempfile.TemporaryDirectory() as temp:
            path = source.cache_path(temp, row); path.write_bytes(b'wrong')
            before = path.stat().st_mtime_ns
            with self.assertRaisesRegex(ValueError, 'Frozen particle input'): source.checked(path, row['sha256'], row['bytes'])
            self.assertEqual(path.read_bytes(), b'wrong'); self.assertEqual(path.stat().st_mtime_ns, before)

    def test_flat_cache_cannot_escape_directory(self):
        row = copy.deepcopy(self.pin['extraction']['files'][0]); row['wadPathHash'] = '../escape'
        with self.assertRaisesRegex(ValueError, 'Invalid flat source hash'): source.cache_path(Path('/tmp/sources'), row)

    def test_all_system_sound_and_flag_omissions_are_retained(self):
        for row in self.pin['resources'].values():
            d=row['definition'];self.assertFalse(any(k.lower().startswith('sound')for k in d));self.assertNotIn('flags',d)
    def test_inferred_persistent_sound_rejects(self):self.invalid(lambda p:p['resources']['MasterYi_E_buff']['definition'].update(soundPersistentDefault='invented'))
    def test_omitted_persistent_sound_is_not_null(self):self.invalid(lambda p:p['resources']['MasterYi_E_buff']['definition'].update(soundPersistentDefault=None))
    def test_extra_sound_field_rejects(self):self.invalid(lambda p:p['resources']['MasterYi_E_buff']['definition'].update(soundOnDestroyDefault='invented'))
    def test_omitted_flags_are_not_zero(self):self.invalid(lambda p:p['resources']['MasterYi_E_buff']['definition'].update(flags=0))
    def test_omitted_create_sound_is_not_null(self):self.invalid(lambda p:p['resources']['MasterYi_E_buff']['definition'].update(soundOnCreateDefault=None))


if __name__ == '__main__': unittest.main()
