"""Meditate's exact mip closure, independent replay and explicit SCB layouts."""
from pathlib import Path
import builtins
import copy
import json
import runpy
import struct
import sys
import tempfile
import unittest
from unittest.mock import patch
from masteryi_w_particles import SOURCE_ROOT, cache_path, load
from masteryi_q_decode import scb_bytes, scb_mesh, sha

MODULE = runpy.run_path(str(Path(__file__).with_name('decode-masteryi-w-particles.py')))
Q_CONTROLS = runpy.run_path(str(Path(__file__).with_name('test-masteryi-q-decode.py')))
LAYOUTS = ((1, 0), (5, 24))


class MeshLayouts(unittest.TestCase):
    def torus_control(self):
        raw = bytearray(Q_CONTROLS['mesh']()[:-24])
        struct.pack_into('<I', raw, 148, 1)
        return bytes(raw)

    def test_flag_one_without_tail_retains_every_original_byte(self):
        raw = self.torus_control()
        mesh = scb_mesh(raw, allowed_layouts=LAYOUTS)
        self.assertEqual(mesh['flags'], 1); self.assertEqual(mesh['tailHex'], '')
        self.assertEqual(scb_bytes(json.loads(json.dumps(mesh))), raw)
        self.assertEqual(mesh['sourceFaceRgbHex'], bytes(range(1, 10)).hex())
        self.assertEqual(struct.pack('<f', mesh['sourcePoints'][0][0]), b'\0\0\0\x80')

    def test_original_q_profile_still_rejects_flag_one(self):
        with self.assertRaisesRegex(ValueError, 'flags'): scb_mesh(self.torus_control())

    def test_flag_one_does_not_accept_a_fabricated_tail(self):
        with self.assertRaisesRegex(ValueError, 'extent'):
            scb_mesh(self.torus_control() + bytes(24), allowed_layouts=LAYOUTS)

    def test_flag_five_does_not_drop_its_tail(self):
        with self.assertRaisesRegex(ValueError, 'extent'):
            scb_mesh(Q_CONTROLS['mesh']()[:-24], allowed_layouts=LAYOUTS)

    def test_unreviewed_flag_profile_is_rejected(self):
        raw = bytearray(self.torus_control()); struct.pack_into('<I', raw, 148, 3)
        with self.assertRaisesRegex(ValueError, 'flags'): scb_mesh(bytes(raw), allowed_layouts=LAYOUTS)


class ActualDecode(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.record = json.loads(MODULE['RECORD'].read_text())

    def test_all_assets_check_without_pillow_or_cdtb(self):
        original = builtins.__import__
        def guard(name, *args, **kwargs):
            if name.split('.')[0] in {'PIL', 'cdtb'}:
                raise AssertionError('Independent replay imported producer dependency')
            return original(name, *args, **kwargs)
        with patch('builtins.__import__', guard): record = MODULE['check_record']()
        self.assertEqual(len(record['textures']), 18)
        self.assertEqual(sum(len(t['levels']) for t in record['textures']), 153)
        self.assertEqual(len(record['meshes']), 2)
        self.assertEqual(sum(m['width'] * m['height'] * 4 for t in record['textures'] for m in t['levels']), 7231144)

    def test_both_original_meshes_round_trip_byte_for_byte(self):
        pin, _ = load(); by_path = {r['path']: r for r in pin['extraction']['files']}
        for mesh in self.record['meshes']:
            raw = cache_path(SOURCE_ROOT, by_path[mesh['source']['path']]).read_bytes()
            value = json.loads(Path(mesh['path']).read_text())
            self.assertEqual(scb_bytes(value), raw)
            self.assertEqual(scb_mesh(raw, allowed_layouts=LAYOUTS), value)
        self.assertEqual([(m['sourceVertices'], m['triangles'], m['flags']) for m in self.record['meshes']],
                         [(180, 320, 1), (403, 733, 5)])

    def test_shared_q_textures_keep_identical_compressed_blocks_pixels_and_pngs(self):
        q = json.loads(Path('docs/reference/masteryi/q-particles-decoded.json').read_text())
        by_path = {t['source']['path']: t for t in q['textures']}
        shared = [t for t in self.record['textures'] if t['source']['path'] in by_path]
        self.assertGreaterEqual(len(shared), 5)
        for t in shared:
            other = by_path[t['source']['path']]
            self.assertEqual(t['source'], other['source'])
            self.assertEqual([{k:v for k,v in m.items() if k != 'path'} for m in t['levels']],
                             [{k:v for k,v in m.items() if k != 'path'} for m in other['levels']])

    def invalid_record(self, change, pattern):
        value = copy.deepcopy(self.record); change(value)
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)/'record.json'; raw = (json.dumps(value) + '\n').encode(); path.write_bytes(raw)
            with self.assertRaisesRegex(ValueError, pattern):
                MODULE['check_record'](path, SOURCE_ROOT, sha(raw))

    def test_missing_texture_rejects(self): self.invalid_record(lambda r: r['textures'].pop(), 'closure')
    def test_missing_mesh_rejects(self): self.invalid_record(lambda r: r['meshes'].pop(), 'closure')
    def test_missing_mip_rejects(self): self.invalid_record(lambda r: r['textures'][0]['levels'].pop(), 'mips')
    def test_shifted_compressed_range_rejects(self): self.invalid_record(lambda r: r['textures'][0]['levels'][0].update(sourceOffset=12), 'source range')
    def test_fabricated_source_pin_rejects(self): self.invalid_record(lambda r: r.update(sourcePinSha256='0'*64), 'source/layout')
    def test_wrong_pixel_digest_rejects(self): self.invalid_record(lambda r: r['textures'][0]['levels'][0].update(rgbaSha256='0'*64), 'pixels')
    def test_wrong_alpha_statistics_rejects(self): self.invalid_record(lambda r: r['textures'][0]['levels'][0].update(transparentPixels=-1), 'alpha statistics')

    def test_unreviewed_record_hash_rejects(self):
        with self.assertRaisesRegex(ValueError, 'Frozen particle input'):
            MODULE['check_record'](record_sha256='0'*64)

    def test_all_output_conflicts_are_checked_before_any_missing_file_is_written(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); missing = root/'new.png'; conflict = root/'old.png'
            record_path = root/'record.json'; conflict.write_bytes(b'original')
            before = conflict.stat().st_mtime_ns
            generate = lambda *args: ([(missing, b'new'), (conflict, b'expected')], self.record)
            with patch.dict(MODULE['main'].__globals__, {'generate': generate}), \
                 patch.object(sys, 'argv', ['decode', '--record', str(record_path)]):
                with self.assertRaisesRegex(ValueError, 'Conflicting decoded output'): MODULE['main']()
            self.assertFalse(missing.exists()); self.assertFalse(record_path.exists())
            self.assertEqual(conflict.read_bytes(), b'original')
            self.assertEqual(conflict.stat().st_mtime_ns, before)


if __name__ == '__main__': unittest.main()
