"""Check complete private cast mip transport and refuse dropped/changed dependencies."""
import copy
from pathlib import Path
import runpy
import tempfile
import unittest
from ahri_q_particles import SOURCE_ROOT
import json
m=runpy.run_path(str(Path(__file__).with_name('pack-ahri-q-cast-textures.py')))
class TextureGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.record=json.loads((m['OUTPUT']/'textures.json').read_text())
    def invalid(self, change):
        r=copy.deepcopy(self.record);change(r)
        with self.assertRaises((ValueError,KeyError)):m['verify'](r,SOURCE_ROOT)
    def test_all_four_textures_and_twenty_eight_mips_verify(self):
        m['verify'](self.record,SOURCE_ROOT)
        self.assertEqual(len(self.record['textures']),4)
        self.assertEqual(sum(len(r['rectangles']) for r in self.record['textures']),28)
    def test_erosion_dependency_cannot_be_dropped(self):
        self.invalid(lambda r:r['textures'].pop(next(i for i,t in enumerate(r['textures']) if 'erode' in t['source']['path'])))
    def test_source_identity_and_mip_geometry_cannot_change(self):
        self.invalid(lambda r:r['textures'][0]['source'].update(sha256='0'*64))
        self.invalid(lambda r:r['textures'][0]['rectangles'][0].update(width=1))
        self.invalid(lambda r:r['textures'][0]['rectangles'].pop())
    def test_packed_symlink_leaf_and_parent_reject(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);file=root/'real';file.write_bytes(b'original');link=root/'link';link.symlink_to(file)
            with self.assertRaisesRegex(ValueError,'symlink'):m['safe_output'](link)
            parent=root/'redirect';parent.symlink_to(root,target_is_directory=True)
            with self.assertRaisesRegex(ValueError,'symlink'):m['safe_output'](parent/'new.png')
            self.assertFalse((root/'new.png').exists())
if __name__=='__main__':unittest.main()
