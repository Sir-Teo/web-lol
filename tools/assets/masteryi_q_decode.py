"""Bounded source-preserving TEX mip and SCB 3.2 inspection for frozen particle sources."""
import binascii
import hashlib
import math
import struct
import zlib
from masteryi_q_particles import require


def sha(raw): return hashlib.sha256(raw).hexdigest()


def tex_levels(raw):
    require(len(raw) >= 12 and raw[:4] == b'TEX\0', 'Invalid TEX header')
    width, height = struct.unpack_from('<HH', raw, 4)
    require(width > 0 and height > 0 and raw[8] == 1 and raw[10] == 0 and raw[11] in (0, 1), 'Unsupported TEX dimensions/header')
    format = raw[9]; require(format in (10, 12), 'Unsupported source TEX format')
    block_bytes = 8 if format == 10 else 16
    count = max(width, height).bit_length() if raw[11] else 1
    cursor = len(raw); levels = []
    # Pinned LeagueToolkit Texture.LoadTex explicitly reads smallest-first
    # storage backwards, returning the largest mip first.
    for level in range(count):
        w, h = max(1, width >> level), max(1, height >> level)
        size = ((w + 3) // 4) * ((h + 3) // 4) * block_bytes
        cursor -= size; require(cursor >= 12, 'Truncated TEX mip chain')
        block = raw[cursor:cursor + size]
        levels.append({'level': level, 'width': w, 'height': h, 'sourceOffset': cursor, 'sourceBytes': size, 'sourceSha256': sha(block)})
    require(cursor == 12, 'Unexpected TEX mip bytes')
    return {'width': width, 'height': height, 'format': format, 'hasMipmaps': bool(raw[11]), 'headerHex': raw[:12].hex(), 'levels': levels}


def single_mip_tex(raw, level):
    header = bytearray(raw[:12]); struct.pack_into('<HH', header, 4, level['width'], level['height']); header[11] = 0
    return bytes(header) + raw[level['sourceOffset']:level['sourceOffset'] + level['sourceBytes']]


def png_rgba8(raw, expected_width, expected_height):
    """Independent stdlib PNG replay; checks CRC, extents and all five filters."""
    require(raw[:8] == b'\x89PNG\r\n\x1a\n', 'Invalid PNG signature')
    cursor = 8; compressed = []; header = None; ended = False
    while cursor < len(raw):
        require(cursor + 12 <= len(raw), 'Truncated PNG chunk')
        size = struct.unpack_from('>I', raw, cursor)[0]; tag = raw[cursor + 4:cursor + 8]
        require(cursor + 12 + size <= len(raw), 'PNG chunk exceeds file')
        data = raw[cursor + 8:cursor + 8 + size]
        require(binascii.crc32(tag + data) & 0xffffffff == struct.unpack_from('>I', raw, cursor + 8 + size)[0], 'PNG CRC differs')
        if tag == b'IHDR':
            require(header is None and cursor == 8 and size == 13, 'Invalid PNG IHDR')
            header = struct.unpack('>IIBBBBB', data)
            require(header == (expected_width, expected_height, 8, 6, 0, 0, 0), 'PNG format/dimensions differ')
        elif tag == b'IDAT':
            require(header is not None and not ended, 'Invalid PNG data ordering'); compressed.append(data)
        elif tag == b'IEND':
            require(size == 0 and header is not None and compressed, 'Invalid PNG end'); ended = True
            require(cursor + 12 == len(raw), 'Trailing PNG bytes')
        else: raise ValueError('Unexpected PNG chunk')
        cursor += size + 12
    require(ended and expected_width > 0 and expected_height > 0, 'Missing PNG end')
    stride = expected_width * 4; expected = (stride + 1) * expected_height
    stream = zlib.decompressobj(); filtered = stream.decompress(b''.join(compressed), expected + 1)
    require(len(filtered) == expected and stream.eof and not stream.unused_data and not stream.unconsumed_tail, 'PNG decompressed extent differs')
    out = bytearray(); previous = bytearray(stride)
    for y in range(expected_height):
        base = y * (stride + 1); kind = filtered[base]; require(kind <= 4, 'Unsupported PNG filter')
        row = bytearray(filtered[base + 1:base + 1 + stride])
        for x in range(stride):
            left = row[x - 4] if x >= 4 else 0; up = previous[x]; corner = previous[x - 4] if x >= 4 else 0
            if kind == 1: predictor = left
            elif kind == 2: predictor = up
            elif kind == 3: predictor = (left + up) // 2
            elif kind == 4:
                p = left + up - corner; a, b, c = abs(p - left), abs(p - up), abs(p - corner)
                predictor = left if a <= b and a <= c else up if b <= c else corner
            else: predictor = 0
            row[x] = (row[x] + predictor) & 255
        out.extend(row); previous = row
    return bytes(out)


def scb_mesh(raw, *, allowed_layouts=((5, 24),)):
    require(len(raw) >= 180 and raw[:8] == b'r3d2Mesh' and struct.unpack_from('<HH', raw, 8) == (3, 2), 'Unsupported SCB header/version')
    vertices, faces, flags = struct.unpack_from('<III', raw, 140)
    require(vertices > 0 and faces > 0 and flags in dict(allowed_layouts) and struct.unpack_from('<I', raw, 176)[0] == 0, 'Unsupported SCB counts/flags/colors')
    require(len(raw) == 180 + vertices * 12 + 12 + faces * 109 + dict(allowed_layouts)[flags], 'SCB extent differs')
    points = [list(struct.unpack_from('<3f', raw, 180 + i * 12)) for i in range(vertices)]
    cursor = 180 + vertices * 12; pivot = list(struct.unpack_from('<3f', raw, cursor)); cursor += 12
    indices, uv, material_indices, slots, lookup = [], [], [], [], {}
    for _ in range(faces):
        face = list(struct.unpack_from('<3I', raw, cursor)); require(all(i < vertices and i <= 65535 for i in face), 'SCB source index outside supported range')
        material = raw[cursor + 12:cursor + 76]; key = material.hex()
        if key not in lookup:
            lookup[key] = len(slots); slots.append({'bytesHex': key, 'name': material.split(b'\0')[0].decode('ascii')})
        material_indices.append(lookup[key]); indices.extend(face); uv.append(list(struct.unpack_from('<6f', raw, cursor + 76))); cursor += 100
    rgb = raw[cursor:cursor + faces * 9]; cursor += faces * 9
    bounds = list(struct.unpack_from('<6f', raw, 152))
    require(all(math.isfinite(v) for group in [*points, *uv, pivot, bounds] for v in group), 'Non-finite SCB coordinate')
    measured = [min(p[i] for p in points) for i in range(3)] + [max(p[i] for p in points) for i in range(3)]
    record = {'headerHex': raw[:180].hex(), 'version': [3,2], 'flags': flags, 'sourceName': raw[12:140].split(b'\0')[0].decode('ascii'), 'sourceVertices': vertices, 'triangles': faces, 'sourcePoints': points, 'sourceIndices': indices, 'faceUv': uv, 'materialSlots': slots, 'faceMaterialIndices': material_indices, 'sourceFaceRgbHex': rgb.hex(), 'centralPoint': pivot, 'sourceBounds': bounds, 'measuredMinMax': measured, 'tailHex': raw[cursor:].hex(), 'unusedSourceVertices': sorted(set(range(vertices)) - set(indices))}
    require(scb_bytes(record) == raw, 'SCB decode/re-encode is not byte exact')
    return record


def scb_bytes(record):
    out = bytearray.fromhex(record['headerHex'])
    for point in record['sourcePoints']: out.extend(struct.pack('<3f', *point))
    out.extend(struct.pack('<3f', *record['centralPoint']))
    for i, uv in enumerate(record['faceUv']):
        out.extend(struct.pack('<3I', *record['sourceIndices'][i * 3:i * 3 + 3]))
        out.extend(bytes.fromhex(record['materialSlots'][record['faceMaterialIndices'][i]]['bytesHex']))
        out.extend(struct.pack('<6f', *uv))
    out.extend(bytes.fromhex(record['sourceFaceRgbHex'])); out.extend(bytes.fromhex(record['tailHex']))
    return bytes(out)
