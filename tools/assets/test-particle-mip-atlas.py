"""Transport invariants, including invisible RGB and rectangular mip chains."""
import copy
import unittest
from particle_mip_atlas import MAX_PIXELS, encode_png, pack, unpack
from masteryi_q_decode import png_rgba8, sha


def levels(width=8, height=2, complete=True):
    # Nonzero RGB under zero alpha must remain byte exact.
    return [(max(1, width >> i), max(1, height >> i),
             bytes((pixel * 37 + i * 11) % 256 if pixel % 4 != 3 else 0
                   for pixel in range(max(1, width >> i) * max(1, height >> i) * 4)))
            for i in range(max(width, height).bit_length() if complete else 1)]


class AtlasTests(unittest.TestCase):
    def test_rectangular_authored_levels_and_transparent_rgb(self):
        source = levels(); png, record = pack(source)
        self.assertEqual((record['width'], record['height']), (8, 5))
        self.assertEqual([r['y'] for r in record['rectangles']], [0, 2, 3, 4])
        self.assertEqual(unpack(png, record), [p for _, _, p in source])
        self.assertTrue(any(unpack(png, record)[0]))

    def test_tall_chain(self):
        source = levels(2, 8); png, record = pack(source)
        self.assertEqual((record['width'], record['height']), (2, 15))
        self.assertEqual(unpack(png, record), [p for _, _, p in source])

    def test_single_authored_level_is_not_expanded(self):
        for size in [(1, 1), (7, 3), (3, 11)]:
            with self.subTest(size=size):
                source = levels(*size, complete=False); png, record = pack(source)
                self.assertEqual(len(record['rectangles']), 1)
                self.assertEqual(unpack(png, record), [source[0][2]])

    def test_non_power_of_two_chain(self):
        source = levels(7, 3); png, record = pack(source)
        self.assertEqual([(r['width'], r['height']) for r in record['rectangles']], [(7, 3), (3, 1), (1, 1)])
        self.assertEqual(unpack(png, record), [p for _, _, p in source])

    def test_no_color_or_alpha_changes(self):
        rgba = bytes([255, 13, 7, 0, 211, 199, 17, 1, 41, 42, 43, 128, 0, 0, 0, 255])
        png, record = pack([(4, 1, rgba)])
        self.assertEqual(unpack(png, record)[0], rgba)
        self.assertEqual(png[12:16], b'IHDR')

    def test_rejects_invalid_dimensions_before_allocation(self):
        for w, h in [(0, 1), (1, 0), (-1, 2), (True, 1), (1.0, 2), (MAX_PIXELS + 1, 1)]:
            with self.subTest(w=w, h=h), self.assertRaises(ValueError):
                encode_png(w, h, b'')

    def test_rejects_missing_or_partial_chain(self):
        for source in [[], levels()[:2]]:
            with self.subTest(source=source), self.assertRaises(ValueError): pack(source)

    def test_rejects_reordered_levels(self):
        source = levels(); source[1], source[2] = source[2], source[1]
        with self.assertRaisesRegex(ValueError, 'dimensions/order'): pack(source)

    def test_rejects_wrong_pixel_extent(self):
        source = levels(); w, h, rgba = source[2]; source[2] = w, h, rgba[:-1]
        with self.assertRaisesRegex(ValueError, 'extent'): pack(source)

    def test_rejects_boolean_and_float_mip_dimensions(self):
        for size in [(True, 1), (1.0, 1), (1, True), (1, 1.0)]:
            source = levels(); source[-1] = (*size, source[-1][2])
            with self.subTest(size=size), self.assertRaisesRegex(ValueError, 'dimensions'): pack(source)

    def test_rejects_layout_corruption(self):
        png, original = pack(levels())
        mutations = [lambda r: r.update(width=7), lambda r: r.update(height=6),
                     lambda r: r['rectangles'].pop(), lambda r: r['rectangles'][1].update(x=1),
                     lambda r: r['rectangles'][1].update(y=0), lambda r: r['rectangles'][1].update(width=8),
                     lambda r: r['rectangles'][1].update(height=2), lambda r: r['rectangles'][1].update(level=0),
                     lambda r: r['rectangles'][0].update(level=False), lambda r: r['rectangles'][0].update(x=0.0),
                     lambda r: r['rectangles'][1].update(rgbaSha256='0' * 64),
                     lambda r: r.update(rgbaSha256='0' * 64)]
        for mutate in mutations:
            record = copy.deepcopy(original); mutate(record)
            with self.subTest(record=record), self.assertRaises(ValueError): unpack(png, record)

    def test_padding_is_checked_even_if_whole_atlas_hash_is_changed(self):
        png, record = pack(levels()); rgba = bytearray(png_rgba8(png, record['width'], record['height']))
        rgba[(2 * record['width'] + 4) * 4] = 17
        record['rgbaSha256'] = sha(rgba); modified = encode_png(record['width'], record['height'], rgba)
        with self.assertRaisesRegex(ValueError, 'padding'): unpack(modified, record)

    def test_rejects_extra_rows(self):
        png, record = pack(levels()); rgba = png_rgba8(png, record['width'], record['height'])
        record['height'] += 1; rgba += bytes(record['width'] * 4); record['rgbaSha256'] = sha(rgba)
        modified = encode_png(record['width'], record['height'], rgba)
        with self.assertRaisesRegex(ValueError, 'rows'): unpack(modified, record)

    def test_rejects_crc_and_trailing_bytes(self):
        png, record = pack(levels())
        modified = bytearray(png); modified[-1] ^= 1
        for raw in [bytes(modified), png + b'\0']:
            with self.subTest(raw=raw[-12:]), self.assertRaises(ValueError): unpack(raw, record)


if __name__ == '__main__': unittest.main()
