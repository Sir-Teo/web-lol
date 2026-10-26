"""Offline Meditate closure, omission and complete native identity regressions."""
from pathlib import Path
import copy
import tempfile
import unittest
import masteryi_w_particles as source


class MeditateGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.pin, cls.model = source.load()

    def invalid(self, change):
        pin = copy.deepcopy(self.pin); change(pin)
        with self.assertRaises((ValueError, KeyError)): source.validate(pin, self.model)

    def test_all_four_systems_and_twenty_assets_are_retained(self):
        bins, assets = source.validate(self.pin, self.model)
        self.assertEqual(len(bins), 4); self.assertEqual(len(assets), 20)
        self.assertEqual(sum(p.endswith('.tex') for p in assets), 18)
        self.assertEqual(sum(p.endswith('.scb') for p in assets), 2)

    def test_changed_pin_fails_before_json_or_parser(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)/'pin.json'; path.write_text('{}')
            with self.assertRaisesRegex(ValueError, 'Frozen particle input'): source.load(path)

    def test_changed_model_fails_before_parser(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)/'model.json'; path.write_text('{}')
            with self.assertRaisesRegex(ValueError, 'Frozen particle input'): source.load(model_path=path)

    def test_omitted_system_rejects(self): self.invalid(lambda p: p['resources'].pop('MasterYi_W_Tenacity'))
    def test_extra_system_rejects(self): self.invalid(lambda p: p['resources'].update({'invented': p['resources']['MasterYi_W_Buf']}))
    def test_wrong_binding_rejects(self): self.invalid(lambda p: p['resources']['MasterYi_W_Buf'].update(record='Invented'))
    def test_unlinked_bin_rejects(self): self.invalid(lambda p: p['resources']['MasterYi_W_Buf'].update(sourceBin='data/invented.bin'))
    def test_wrong_identity_rejects(self): self.invalid(lambda p: p['resources']['MasterYi_W_Buf']['definition'].update(objectPath='wrong'))
    def test_wrong_record_type_rejects(self): self.invalid(lambda p: p['resources']['MasterYi_W_Buf']['definition'].update(__type='Invented'))
    def test_missing_emitter_rejects(self): self.invalid(lambda p: p['resources']['MasterYi_W_Cas']['definition']['complexEmitterDefinitionData'].pop())
    def test_missing_dependency_rejects(self): self.invalid(lambda p: p['extraction']['files'].pop())
    def test_duplicate_dependency_rejects(self): self.invalid(lambda p: p['extraction']['files'].append(copy.deepcopy(p['extraction']['files'][0])))
    def test_wrong_native_bin_rejects(self): self.invalid(lambda p: p['resources']['MasterYi_W_Buf'].update(nativeSha256='0'*64))
    def test_wrong_patch_rejects(self): self.invalid(lambda p: p['extraction'].update(referenceVersion='latest'))
    def test_unresolved_path_rejects(self): self.invalid(lambda p: p['resources']['MasterYi_W_Buf']['definition'].update(unresolved='{0123456789abcdef}'))
    def test_sound_cannot_be_inferred_from_system_name(self): self.invalid(lambda p: p['resources']['MasterYi_W_Cas']['definition'].update(soundOnCreateDefault='Play_sfx_MasterYi_Meditate_OnBuffActivate'))

    def test_native_roundtrip_preserves_all_definitions_and_opaque_types(self):
        self.assertEqual(source.verify_native(self.pin, self.model, source.SOURCE_ROOT),
                         {'systems':4, 'emitters':15, 'bins':4, 'textures':18, 'meshes':2})
        opaque = {s for r in self.pin['resources'].values() for s in source.strings(r['definition']) if s.startswith('{')}
        self.assertEqual(opaque, {'{0a94f3d4}', '{1a7617fd}', '{ee39916f}'})

    def test_native_check_rejects_invented_omitted_default(self):
        pin = copy.deepcopy(self.pin)
        pin['resources']['MasterYi_W_Cas']['definition']['flags'] = 0
        with self.assertRaisesRegex(ValueError, 'Complete native particle record differs'):
            source.verify_native(pin, self.model, source.SOURCE_ROOT)

    def test_native_check_distinguishes_bool_from_int(self):
        pin = copy.deepcopy(self.pin)
        def change(value):
            if isinstance(value, dict):
                for key, child in value.items():
                    if child is True: value[key] = 1; return True
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


if __name__ == '__main__': unittest.main()
