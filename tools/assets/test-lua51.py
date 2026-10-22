"""Synthetic format checks; no source caches, external tools or Lua runtime."""
import struct
import unittest
from lua51 import HEADER, read_chunk, named_functions, instruction


def string(value):
    raw = value.encode('latin1') + b'\0'
    return struct.pack('<Q', len(raw)) + raw


def proto(words, constants=b'', constant_count=0, children=()):
    return (struct.pack('<QiiBBBBi', 0, 0, 0, 0, 0, 2, 3, len(words)) +
            struct.pack('<' + 'I' * len(words), *words) + struct.pack('<i', constant_count) +
            constants + struct.pack('<i', len(children)) + b''.join(children) + struct.pack('<iii', 0, 0, 0))


class LuaChunkTests(unittest.TestCase):
    def test_nil_boolean_number_and_byte_preserving_string(self):
        values = b'\0\1\1\3' + struct.pack('<d', 135) + b'\4' + string('Gromp\0\xff')
        chunk = read_chunk(HEADER + proto([30 | (1 << 23)], values, 4))
        self.assertEqual(chunk['constants'], [None, True, 135, 'Gromp\0\xff'])
        self.assertEqual(instruction(chunk, 1)['op'], 'RETURN')

    def test_function_binding_requires_adjacent_matching_register(self):
        child = proto([30 | (1 << 23)])
        words = [36, 7]  # CLOSURE R0 child0; SETGLOBAL R0 constant0
        root = read_chunk(HEADER + proto(words, b'\4' + string('CampInit'), 1, [child]))
        self.assertEqual(named_functions(root)['CampInit']['words'], [30 | (1 << 23)])
        root['words'][1] |= 1 << 6
        self.assertNotIn('CampInit', named_functions(root))

    def test_constant_register_and_relative_jump_operands(self):
        root = read_chunk(HEADER + proto([9 | (256 << 23) | (2 << 14),
                                         22 | (131069 << 14)], b'\3' + struct.pack('<d', 700), 1))
        self.assertEqual(instruction(root, 1)['operands'], [0, {'constant': 700}, {'register': 2}])
        self.assertEqual(instruction(root, 2)['operands'], [0, {'targetPc': 1}])

    def test_wrong_abi_truncation_lengths_and_trailing_data(self):
        valid = HEADER + proto([30 | (1 << 23)])
        for bad in [b'', valid[:20], valid + b'\0', valid[:4] + b'\x55' + valid[5:],
                    HEADER + struct.pack('<Q', 2**63),
                    HEADER + proto([], b'\4' + struct.pack('<Q', 2) + b'AB', 1)]:
            with self.subTest(bytes=len(bad)), self.assertRaises(ValueError):
                read_chunk(bad)

    def test_rejects_invalid_constant_tags_and_values(self):
        for value in [b'\2', b'\1\2', b'\3' + struct.pack('<d', float('nan')),
                      b'\4' + struct.pack('<Q', 0)]:
            with self.assertRaises(ValueError):
                read_chunk(HEADER + proto([], value, 1))


if __name__ == '__main__':
    unittest.main()
