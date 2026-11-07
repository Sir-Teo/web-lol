"""Check the full SpiritRush mip closure and all-or-nothing private staging."""
import copy
import json
from pathlib import Path
import runpy
import sys
import tempfile
import unittest
from unittest.mock import patch
from ahri_r_particles import SOURCE_ROOT

m = runpy.run_path(str(Path(__file__).with_name('pack-ahri-r-textures.py')))

class SpiritRushTextureGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.record = json.loads((m['OUTPUT'] / 'textures.json').read_text())

    def invalid(self, change):
        record = copy.deepcopy(self.record)
        change(record)
        with self.assertRaises((ValueError, KeyError)):
            m['verify'](record, SOURCE_ROOT)

    def test_all_fifty_one_textures_and_428_mips(self):
        m['verify'](self.record, SOURCE_ROOT)
        self.assertEqual(self.record['systems'], ['Ahri_R_Tar', 'Ahri_R_mis', 'Ahri_R_mis_02', 'Ahri_R_Indicator_1', 'Ahri_R_Indicator_2', 'Ahri_R_Indicator_3', 'Ahri_R_Ready_Aura', 'Ahri_R_TextureSwaps', 'Ahri_R_cas', 'Ahri_R_Eyes', 'Ahri_R_Ready_tar'])
        self.assertEqual(len(self.record['textures']), 51)
        self.assertEqual(sum(len(row['rectangles']) for row in self.record['textures']), 428)

    def test_recursive_erosion_and_multiplier_dependencies_cannot_be_dropped(self):
        for name in ['aatrox_base_smokeerode.tex', 'ahri_base_mote_01.tex', 'ahri_base_r_cone_mask.tex', 'ahri_base_w_smoke_2x2.tex', 'tft_ahri_base_q_trail_01.tex']:
            with self.subTest(name=name):
                self.invalid(lambda r: r['textures'].pop(next(i for i,t in enumerate(r['textures']) if t['source']['path'].endswith('/'+name))))

    def test_duplicate_texture_source_and_incomplete_mip_reject(self):
        self.invalid(lambda r: r['textures'].__setitem__(0, copy.deepcopy(r['textures'][1])))
        self.invalid(lambda r: r['textures'][0]['source'].update(sha256='0'*64))
        self.invalid(lambda r: r['textures'][0]['rectangles'].pop())
        self.invalid(lambda r: r['textures'][0]['rectangles'][0].update(width=1))

    def test_producer_and_source_record_pins_reject(self):
        self.invalid(lambda r: r['producer'].update(scriptSha256='0'*64))
        self.invalid(lambda r: r.update(decodedRecordSha256='0'*64))
        self.invalid(lambda r: r.update(systems=['Ahri_R_mis']))

    def test_corrupt_packed_bytes_reject(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/'corrupt.png'
            path.write_bytes(Path(self.record['textures'][0]['path']).read_bytes()[:-1])
            self.invalid(lambda r: r['textures'][0].update(path=str(path)))

    def test_leaf_and_parent_symlinks_reject(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); file=root/'real'; file.write_bytes(b'original'); link=root/'link'; link.symlink_to(file)
            with self.assertRaisesRegex(ValueError, 'symlink'): m['safe_output'](link)
            parent=root/'redirect'; parent.symlink_to(root, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, 'symlink'): m['safe_output'](parent/'new.png')
            self.assertFalse((root/'new.png').exists())

    def test_final_conflict_prevents_all_texture_writes(self):
        with tempfile.TemporaryDirectory() as tmp:
            output=Path(tmp); final=output/'textures.json'; final.write_bytes(b'conflict')
            with patch.object(sys, 'argv', ['packer', '--output', str(output)]):
                with self.assertRaisesRegex(ValueError, 'Conflicting'): m['main']()
            self.assertEqual(list(output.iterdir()), [final])
            self.assertEqual(final.read_bytes(), b'conflict')

if __name__ == '__main__': unittest.main()
