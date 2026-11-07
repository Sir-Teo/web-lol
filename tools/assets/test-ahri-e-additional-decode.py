"""Native SCB/color, complete mip and publication guards without changing source artifacts."""
import copy
import json
from pathlib import Path
import runpy
import struct
import tempfile
import unittest
from ahri_e_additional_particles import SOURCE_ROOT, cache_path, load
from ahri_q_decode import scb_mesh, scb_bytes
from masteryi_q_decode import png_rgba8

class DecodeGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pin, _ = load()
        cls.raw = [cache_path(SOURCE_ROOT, r).read_bytes() for r in cls.pin['extraction']['files'] if r['path'].endswith('.scb')]
        cls.decoder = runpy.run_path(str(Path(__file__).with_name('decode-ahri-e-additional-particles.py')))

    def test_complete_frozen_record_checks_every_authored_mip_and_native_mesh(self):
        record=self.decoder['check_record'](self.decoder['RECORD'],SOURCE_ROOT)
        self.assertEqual((len(record['textures']),sum(len(t['levels']) for t in record['textures']),len(record['meshes'])),(2,17,0))

    def test_changed_record_and_png_crc_reject_without_repair(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'record.json';path.write_text('{}')
            with self.assertRaisesRegex(ValueError,'Frozen particle input'): self.decoder['check_record'](path,SOURCE_ROOT)
        record=json.loads(self.decoder['RECORD'].read_text());level=record['textures'][0]['levels'][0];raw=bytearray(Path(level['path']).read_bytes());raw[40]^=1
        with self.assertRaises(ValueError): png_rgba8(raw,level['width'],level['height'])

    def test_whole_publication_preflight_prevents_partial_earlier_writes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);first=root/'first.png';last=root/'last.json';last.write_bytes(b'conflict')
            with self.assertRaisesRegex(ValueError,'Conflicting'): self.decoder['publish']([(first,b'new'),(last,b'expected')])
            self.assertFalse(first.exists());self.assertEqual(last.read_bytes(),b'conflict')

    def test_publication_rejects_leaf_and_parent_symlinks(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);target=root/'real';target.write_bytes(b'expected');link=root/'link';link.symlink_to(target)
            with self.assertRaisesRegex(ValueError,'symlink'): self.decoder['publish']([(link,b'expected')])
            directory=root/'redirect';directory.symlink_to(root,target_is_directory=True)
            with self.assertRaisesRegex(ValueError,'symlink'): self.decoder['publish']([(directory/'new',b'new')])
            self.assertFalse((root/'new').exists())

if __name__=='__main__':unittest.main()
