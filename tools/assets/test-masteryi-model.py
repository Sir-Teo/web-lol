"""Exercise complete model-source and omission-preserving parser boundaries."""
import copy
import json
import runpy
import shutil
import tempfile
import unittest
from pathlib import Path

module = runpy.run_path(str(Path(__file__).with_name('verify-masteryi-model.py')))
ROOT = module['ROOT']
SOURCE = ROOT / '.cache/masteryi-model-research-20261023/archive'
PIN = json.loads((ROOT / 'docs/reference/masteryi-model.json').read_bytes())


class MasterYiModelTests(unittest.TestCase):
    def test_all_sources_and_complete_model_records(self):
        self.assertEqual(module['verify'](SOURCE), dict(files=29, records=[2, 1],
                         atomicClips=47, uniqueAnimations=24, nativeEquivalent=False))

    def test_complete_skin_rejects_numeric_boolean_and_record_mutations(self):
        raw = (SOURCE / 'data/characters/masteryi/skins/skin0.bin').read_bytes()
        for kind in ['number', 'boolean', 'record']:
            with self.subTest(kind=kind):
                records = copy.deepcopy(PIN['skin']['data'])
                skin = records['Characters/MasterYi/Skins/Skin0']['skinMeshProperties']
                if kind == 'number':
                    skin['skinScale'] = 1.4
                elif kind == 'boolean':
                    skin['reflectionFresnelColor'][0] = False
                else:
                    del records['Characters/MasterYi/Skins/Skin0/Resources']
                with self.assertRaisesRegex(ValueError, 'Complete model BIN closure differs'):
                    module['parse'](raw, records)

    def test_authored_links_are_retained_and_changed_links_reject(self):
        raw = (SOURCE / 'data/characters/masteryi/skins/skin0.bin').read_bytes()
        records = PIN['skin']['data']
        self.assertTrue(records['__linked'])
        decoded = module['parse'](raw, records)
        self.assertEqual(decoded['__linked'], records['__linked'])
        changed = copy.deepcopy(records)
        changed['__linked'] = []
        with self.assertRaisesRegex(ValueError, 'Complete model BIN closure differs'):
            module['parse'](raw, changed)

    def test_animation_map_mutation_rejected(self):
        raw = (SOURCE / 'data/characters/masteryi/animations/skin0.bin').read_bytes()
        records = copy.deepcopy(PIN['animations']['data'])
        graph = next(v for v in records.values() if isinstance(v, dict) and 'mClipDataMap' in v)
        del graph['mClipDataMap']['Spell3']
        with self.assertRaisesRegex(ValueError, 'Complete model BIN closure differs'):
            module['parse'](raw, records)

    def test_all_29_source_hashes_guarded(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for row in PIN['extraction']['files']:
                target = root / row['path']
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(SOURCE / row['path'], target)
            for row in PIN['extraction']['files']:
                with self.subTest(path=row['path']):
                    target = root / row['path']
                    original = target.read_bytes()
                    target.write_bytes(original + b' ')
                    with self.assertRaisesRegex(ValueError, 'Model source differs: ' + row['path']):
                        module['verify'](root)
                    target.write_bytes(original)


if __name__ == '__main__':
    unittest.main()
