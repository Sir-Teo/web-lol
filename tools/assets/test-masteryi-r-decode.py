"""Highlander's complete private mip/mesh closure and independent replay."""
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
from masteryi_r_particles import SOURCE_ROOT, cache_path, load
from masteryi_q_decode import scb_bytes, scb_mesh, sha

MODULE = runpy.run_path(str(Path(__file__).with_name('decode-masteryi-r-particles.py')))
Q_CONTROLS = runpy.run_path(str(Path(__file__).with_name('test-masteryi-q-decode.py')))
LAYOUTS = ((1, 0), (5, 24))


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
        self.assertEqual(len(record['textures']), 20)
        self.assertEqual(sum(len(t['levels']) for t in record['textures']), 177)
        self.assertEqual(len(record['meshes']), 4)
        self.assertEqual(sum(m['width'] * m['height'] * 4 for t in record['textures'] for m in t['levels']), 8104616)

    def test_all_four_original_meshes_round_trip_byte_for_byte(self):
        pin, _ = load(); by_path = {r['path']: r for r in pin['extraction']['files']}
        for mesh in self.record['meshes']:
            raw = cache_path(SOURCE_ROOT, by_path[mesh['source']['path']]).read_bytes()
            value = json.loads(Path(mesh['path']).read_text())
            self.assertEqual(scb_bytes(value), raw)
            self.assertEqual(scb_mesh(raw, allowed_layouts=LAYOUTS), value)
        self.assertEqual([(m['sourceVertices'], m['triangles'], m['flags']) for m in self.record['meshes']],
                         [(1440, 480, 1), (750, 1500, 5), (161, 300, 5), (27, 24, 5)])

    def test_shared_q_textures_keep_identical_compressed_blocks_pixels_and_pngs(self):
        q = json.loads(Path('docs/reference/masteryi/q-particles-decoded.json').read_text())
        by_path = {t['source']['path']: t for t in q['textures']}
        shared = [t for t in self.record['textures'] if t['source']['path'] in by_path]
        self.assertEqual(len(shared), 9)
        for t in shared:
            other = by_path[t['source']['path']]
            self.assertEqual(t['source'], other['source'])
            self.assertEqual([{k:v for k,v in m.items() if k != 'path'} for m in t['levels']],
                             [{k:v for k,v in m.items() if k != 'path'} for m in other['levels']])

    def test_shared_q_meshes_remain_identical(self):
        q=json.loads(Path('docs/reference/masteryi/q-particles-decoded.json').read_text())
        by_path={m['source']['path']:m for m in q['meshes']}
        shared=[m for m in self.record['meshes']if m['source']['path']in by_path]
        self.assertEqual(len(shared),2)
        for m in shared:self.assertEqual(m['sha256'],by_path[m['source']['path']]['sha256'])
    def test_four_mesh_profile_does_not_change_the_shared_two_mesh_default(self):
        with self.assertRaisesRegex(ValueError,'mesh closure'):
            MODULE['engine']['check_record'](MODULE['RECORD'],SOURCE_ROOT,MODULE['RECORD_SHA256'],source_load=load,source_pin_sha256=MODULE['PIN_SHA256'],texture_count=20,mesh_layouts=LAYOUTS)

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
