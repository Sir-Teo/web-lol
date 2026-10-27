"""Private primary hit transport closure and original-pixel corruption guards."""
from pathlib import Path
import copy
import json
import runpy
import unittest

SOURCE = runpy.run_path(str(Path(__file__).with_name('pack-masteryi-primary-hit-textures.py')))


class TransportGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.record = json.loads((SOURCE['OUTPUT'] / 'textures.json').read_text())

    def invalid(self, change, pattern):
        record = copy.deepcopy(self.record); change(record)
        with self.assertRaisesRegex(ValueError, pattern): SOURCE['verify'](record,SOURCE['SOURCE_ROOT'])

    def test_all_eleven_textures_and_93_mips_recover_the_original_pixels(self):
        SOURCE['verify'](self.record,SOURCE['SOURCE_ROOT'])
        self.assertEqual(len(self.record['textures']), 11)
        self.assertEqual(sum(len(t['rectangles']) for t in self.record['textures']), 93)
        self.assertEqual(sum(t['bytes'] for t in self.record['textures']), 605648)

    def test_wrong_decoded_record_rejects(self): self.invalid(lambda r: r.update(decodedRecordSha256='0'*64), 'source binding')
    def test_omitted_system_rejects(self): self.invalid(lambda r: r['systems'].pop(), 'source binding')
    def test_missing_texture_rejects(self): self.invalid(lambda r: r['textures'].pop(), 'closure')
    def test_duplicate_texture_rejects(self): self.invalid(lambda r: r['textures'].append(copy.deepcopy(r['textures'][0])), 'closure')
    def test_changed_native_texture_rejects(self): self.invalid(lambda r: r['textures'][0]['source'].update(sha256='0'*64), 'native source')
    def test_missing_mip_rejects(self): self.invalid(lambda r: r['textures'][0]['rectangles'].pop(), 'mip chain')
    def test_moved_mip_rejects(self): self.invalid(lambda r: r['textures'][0]['rectangles'][0].update(y=1), 'rectangle layout')
    def test_changed_whole_png_rejects(self): self.invalid(lambda r: r['textures'][0].update(sha256='0'*64), 'Frozen particle input')
    def test_changed_mip_pixels_rejects(self): self.invalid(lambda r: r['textures'][0]['rectangles'][0].update(rgbaSha256='0'*64), 'mip pixels')


if __name__ == '__main__': unittest.main()
