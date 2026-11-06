"""Offline format guards for the Baron's vertex-colored SCB and authored TEX mips."""
import json
import struct
import unittest

from baron_attack_decode import scb_bytes, scb_mesh
from masteryi_q_decode import single_mip_tex, tex_levels


def mesh_fixture():
    header = bytearray(180)
    header[:8] = b'r3d2Mesh'
    struct.pack_into('<HH', header, 8, 3, 2)
    header[12:25] = b'baron-fixture'
    struct.pack_into('<III', header, 140, 3, 1, 2)
    struct.pack_into('<6f', header, 152, 0, 0, 0, 1, 1, 0)
    struct.pack_into('<I', header, 176, 1)
    points = struct.pack('<9f', -0.0, 0, 0, 1, 0, 0, 0, 1, 0)
    colors = bytes([1, 2, 3, 4, 50, 60, 70, 80, 100, 110, 120, 130])
    pivot = struct.pack('<3f', 2, 3, 4)
    face = struct.pack('<3I', 0, 1, 2) + b'material\0' + bytes(55) + struct.pack('<6f', 0, 1, 0, 0, 0, 1)
    return bytes(header) + points + colors + pivot + face


class DecodeTests(unittest.TestCase):
    def test_colored_mesh_json_round_trip_keeps_bgra_signed_zero_uv_and_pivot(self):
        raw = mesh_fixture()
        decoded = scb_mesh(raw)
        self.assertEqual(decoded['sourceVertexBgraHex'], '01020304323c4650646e7882')
        self.assertEqual(decoded['sourceFaceRgbHex'], '')
        self.assertEqual(decoded['centralPoint'], [2, 3, 4])
        self.assertEqual(decoded['faceUv'], [[0, 1, 0, 0, 0, 1]])
        self.assertEqual(decoded['sourceIndices'], [0, 1, 2])
        self.assertEqual(scb_bytes(json.loads(json.dumps(decoded))), raw)

    def test_mesh_rejects_truncation_and_unparsed_tails(self):
        raw = mesh_fixture()
        for candidate in [raw[:-1], raw + b'\0', raw[:220] + raw[224:]]:
            with self.subTest(size=len(candidate)), self.assertRaises(ValueError):
                scb_mesh(candidate)

    def test_mesh_rejects_other_versions_flags_and_color_layouts(self):
        for offset, data in [(8, struct.pack('<HH', 4, 2)),
                             (148, struct.pack('<I', 1)), (176, struct.pack('<I', 0))]:
            raw = bytearray(mesh_fixture())
            raw[offset:offset + len(data)] = data
            with self.subTest(offset=offset), self.assertRaises(ValueError):
                scb_mesh(raw)

    def test_mesh_rejects_invalid_indices_and_nonfinite_positions(self):
        for offset, data in [(240, struct.pack('<I', 3)), (180, struct.pack('<f', float('nan')))]:
            raw = bytearray(mesh_fixture())
            raw[offset:offset + len(data)] = data
            with self.subTest(offset=offset), self.assertRaises(ValueError):
                scb_mesh(raw)

    def test_native_mips_keep_smallest_first_blocks_and_non_square_sizes(self):
        dimensions = [(16, 8), (8, 4), (4, 2), (2, 1), (1, 1)]
        blocks = [bytes([i]) * (((w + 3) // 4) * ((h + 3) // 4) * 16)
                  for i, (w, h) in enumerate(dimensions)]
        raw = b'TEX\0' + struct.pack('<HH', 16, 8) + bytes([1, 12, 0, 1]) + b''.join(reversed(blocks))
        levels = tex_levels(raw)['levels']
        self.assertEqual([(r['width'], r['height']) for r in levels], dimensions)
        for row, block in zip(levels, blocks):
            self.assertEqual(raw[row['sourceOffset']:row['sourceOffset'] + row['sourceBytes']], block)
            single = single_mip_tex(raw, row)
            self.assertEqual(single[12:], block)
            self.assertEqual(len(tex_levels(single)['levels']), 1)

    def test_native_mips_reject_unsupported_formats_and_incomplete_blocks(self):
        raw = b'TEX\0' + struct.pack('<HH', 4, 4) + bytes([1, 12, 0, 0]) + bytes(16)
        changed = bytearray(raw)
        changed[9] = 99
        for candidate in [raw[:-1], raw + b'\0', bytes(changed)]:
            with self.subTest(size=len(candidate)), self.assertRaises(ValueError):
                tex_levels(candidate)


if __name__ == '__main__':
    unittest.main()
