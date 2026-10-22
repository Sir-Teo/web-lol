"""Strict Troybin v2 reader with original storage types retained.

Layout cross-checked against moonshadow565/lolpytools cd778cb1b2ace6557bbf9f7c3395b3f6f2f5a2b9.
Labels are finite SDBM(section + '*' + field) matches, not runtime semantics.
"""
import math
import re
import struct


def ihash(section, field):
    value = 0
    for char in (section + '*' + field).lower():
        value = (ord(char) + 65599 * value) & 0xffffffff
    return f'{value:08x}'


def semantic(value):
    if not isinstance(value, str):
        return value
    if value.lower() in ['true', 'false']:
        return int(value.lower() == 'true')
    number = r'[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?'
    tokens = value.split()
    if tokens and all(re.fullmatch(number, token) for token in tokens):
        values = [int(t) if re.fullmatch(r'[+-]?\d+', t) else float(t) for t in tokens]
        return values[0] if len(values) == 1 else values
    return value


def read(data):
    cursor = 0

    def unpack(fmt):
        nonlocal cursor
        count = struct.calcsize('<' + fmt)
        assert cursor + count <= len(data), 'Truncated legacy particle data'
        result = struct.unpack_from('<' + fmt, data, cursor)
        cursor += count
        return result[0] if len(result) == 1 else list(result)

    version, string_bytes, flags = unpack('B'), unpack('H'), unpack('H')
    assert version == 2, 'Unsupported Troybin version'
    if flags == 0 and cursor != len(data):
        flags = unpack('H')
    assert flags < (1 << 14), 'Unsupported Troybin layout'
    formats = {
        0: ('i32', 'i', 1, 1), 1: ('f32', 'f', 1, 1),
        2: ('u8_tenths', 'B', 1, 0.1), 3: ('i16', 'h', 1, 1),
        4: ('u8', 'B', 1, 1), 6: ('u8_vec3_tenths', 'B', 3, 0.1),
        7: ('f32_vec3', 'f', 3, 1), 8: ('u8_vec2_tenths', 'B', 2, 0.1),
        9: ('f32_vec2', 'f', 2, 1), 10: ('u8_vec4_tenths', 'B', 4, 0.1),
        11: ('f32_vec4', 'f', 4, 1), 13: ('i64', 'q', 1, 1),
    }
    rows, seen = [], set()
    for bit in range(14):
        if not flags & (1 << bit):
            continue
        count = unpack('H')
        keys = [unpack('I') for _ in range(count)]
        assert not seen.intersection(keys) and len(set(keys)) == count, 'Duplicate Troybin key'
        seen.update(keys)
        if bit == 5:
            packed = [unpack('B') for _ in range((count + 7) // 8)]
        elif bit == 12:
            offsets = [unpack('H') for _ in range(count)]
            strings = data[cursor:cursor + string_bytes]
            assert len(strings) == string_bytes
            cursor += string_bytes
        for index, key in enumerate(keys):
            if bit == 5:
                storage, raw = 'bool', int(bool(packed[index // 8] & (1 << (index % 8))))
                value = raw
            elif bit == 12:
                offset = offsets[index]
                assert offset < len(strings)
                end = strings.index(0, offset)
                storage, raw = 'string', strings[offset:end].decode('ascii')
                value = semantic(raw)
            else:
                storage, fmt, size, factor = formats[bit]
                values = [unpack(fmt) for _ in range(size)]
                assert all(math.isfinite(v) for v in values)
                raw = values[0] if size == 1 else values
                scaled = [v * factor for v in values]
                value = scaled[0] if size == 1 else scaled
            rows.append(dict(hash=f'{key:08x}', storage=storage, raw=raw, value=value))
    assert cursor == len(data), 'Unconsumed legacy particle bytes'
    return dict(version=version, stringBytes=string_bytes, flags=flags, rows=rows)


def decode(parsed, labels):
    values, unknown = {}, {}
    for row in parsed['rows']:
        label = labels.get(row['hash'])
        if label:
            section, field = label
            assert ihash(section, field) == row['hash'], 'Legacy label hash mismatch'
            values.setdefault(section, {})[field] = row['value']
        else:
            unknown[row['hash']] = row['value']
    return dict(values=values, unknown=unknown)
