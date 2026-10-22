"""Independent small binary fixtures for the strict legacy reader (stdlib only)."""
import struct
import unittest
from legacy_troy import read, decode, ihash


class LegacyTroyTest(unittest.TestCase):
    def test_strings_keep_original_storage_and_parse_semantics_separately(self):
        text = b'0 80 0\0DATA/Particles/original.dds\0'
        data = struct.pack('<BHHHIIHH', 2, len(text), 1 << 12, 2, 7, 9, 0, 7) + text
        result = read(data)
        self.assertEqual(result['rows'], [
            dict(hash='00000007', storage='string', raw='0 80 0', value=[0, 80, 0]),
            dict(hash='00000009', storage='string', raw='DATA/Particles/original.dds',
                 value='DATA/Particles/original.dds')])

    def test_packed_booleans_cross_byte_boundary_and_compressed_vectors(self):
        keys = list(range(1, 10))
        data = struct.pack('<BHHH9I2BHIBBB', 2, 0, (1 << 5) | (1 << 6),
                           9, *keys, 0b01010101, 1, 1, 100, 3, 10, 255)
        rows = read(data)['rows']
        self.assertEqual([r['raw'] for r in rows[:9]], [1, 0, 1, 0, 1, 0, 1, 0, 1])
        self.assertEqual(rows[9]['raw'], [3, 10, 255])
        self.assertEqual(rows[9]['value'], [0.30000000000000004, 1, 25.5])

    def test_signed_storage_and_verified_label_decode(self):
        key = int(ihash('flash', 'p-life'), 16)
        data = struct.pack('<BHHHIi', 2, 0, 1, 1, key, -42)
        parsed = read(data)
        self.assertEqual(decode(parsed, {f'{key:08x}': ['flash', 'p-life']}),
                         dict(values={'flash': {'p-life': -42}}, unknown={}))
        self.assertEqual(decode(parsed, {})['unknown'][f'{key:08x}'], -42)
        with self.assertRaises(AssertionError):
            decode(parsed, {f'{key:08x}': ['other', 'p-life']})

    def test_rejects_truncation_duplicate_hashes_trailing_bytes_and_unsupported_layouts(self):
        valid = struct.pack('<BHHHIi', 2, 0, 1, 1, 7, 42)
        for length in range(len(valid)):
            with self.assertRaises((AssertionError, ValueError)):
                read(valid[:length])
        for invalid in [valid + b'x', bytes([3]) + valid[1:],
                        struct.pack('<BHHHIIii', 2, 0, 1, 2, 7, 7, 1, 2),
                        struct.pack('<BHH', 2, 0, 1 << 14),
                        struct.pack('<BHHH', 2, 0, 0, 1 << 14)]:
            with self.assertRaises(AssertionError):
                read(invalid)


if __name__ == '__main__':
    unittest.main()
