"""Byte-exact SCB 3.2 flag-2 transport; no rendering transforms are applied."""
import math
import struct
from ahri_q_particles import require


def scb_mesh(raw):
    require(len(raw) >= 192 and raw[:8] == b'r3d2Mesh' and struct.unpack_from('<HH', raw, 8) == (3, 2), 'Unsupported Ahri SCB header/version')
    vertices, faces, flags = struct.unpack_from('<III', raw, 140)
    colors = struct.unpack_from('<I', raw, 176)[0]
    require(0 < vertices <= 65536 and 0 < faces <= 100000 and flags == 2 and colors in (0, 1), 'Unsupported Ahri SCB counts/flags/colors')
    require(len(raw) == 180 + vertices * (12 + 4 * colors) + 12 + faces * 100, 'Ahri SCB extent differs')
    points = [list(struct.unpack_from('<3f', raw, 180 + i * 12)) for i in range(vertices)]
    cursor = 180 + vertices * 12
    bgra = raw[cursor:cursor + vertices * 4 * colors]; cursor += len(bgra)
    rgba = bytes(channel for i in range(0, len(bgra), 4) for channel in (bgra[i + 2], bgra[i + 1], bgra[i], bgra[i + 3]))
    pivot = list(struct.unpack_from('<3f', raw, cursor)); cursor += 12
    indices, uv, material_indices, slots, lookup = [], [], [], [], {}
    for _ in range(faces):
        face = list(struct.unpack_from('<3I', raw, cursor))
        require(all(i < vertices and i <= 65535 for i in face), 'Ahri SCB source index outside supported range')
        material = raw[cursor + 12:cursor + 76]; key = material.hex()
        if key not in lookup:
            lookup[key] = len(slots); slots.append(dict(bytesHex=key, name=material.split(b'\0')[0].decode('ascii')))
        material_indices.append(lookup[key]); indices.extend(face)
        uv.append(list(struct.unpack_from('<6f', raw, cursor + 76))); cursor += 100
    bounds = list(struct.unpack_from('<6f', raw, 152))
    require(cursor == len(raw) and all(math.isfinite(v) for group in [*points, *uv, pivot, bounds] for v in group), 'Invalid Ahri SCB coordinates/tail')
    measured = [min(p[i] for p in points) for i in range(3)] + [max(p[i] for p in points) for i in range(3)]
    record = dict(headerHex=raw[:180].hex(), version=[3, 2], flags=flags,
                  sourceName=raw[12:140].split(b'\0')[0].decode('ascii'), sourceVertices=vertices,
                  triangles=faces, sourcePoints=points, sourceIndices=indices, faceUv=uv,
                  materialSlots=slots, faceMaterialIndices=material_indices,
                  hasVertexColors=bool(colors), sourceVertexBgraHex=bgra.hex(), vertexRgbaHex=rgba.hex(),
                  sourceFaceRgbHex='', centralPoint=pivot, sourceBounds=bounds, measuredMinMax=measured,
                  tailHex='', unusedSourceVertices=sorted(set(range(vertices)) - set(indices)))
    require(scb_bytes(record) == raw, 'Ahri SCB decode/re-encode is not byte exact')
    return record


def scb_bytes(record):
    header = bytearray.fromhex(record['headerHex'])
    require(len(header) == 180, 'Invalid Ahri SCB retained header')
    vertices, faces, flags = struct.unpack_from('<III', header, 140)
    colors = struct.unpack_from('<I', header, 176)[0]
    require(type(record['hasVertexColors']) is bool and colors in (0, 1) and record['flags'] == flags == 2 and
            record['sourceVertices'] == vertices and record['triangles'] == faces and len(record['sourcePoints']) == vertices and
            len(record['faceUv']) == faces and len(record['sourceIndices']) == faces * 3 and
            len(record['faceMaterialIndices']) == faces and record['hasVertexColors'] == bool(colors), 'Ahri SCB retained extent differs')
    out = header
    for point in record['sourcePoints']: out.extend(struct.pack('<3f', *point))
    bgra = bytes.fromhex(record['sourceVertexBgraHex'])
    require(len(bgra) == vertices * 4 * colors, 'Ahri SCB retained colors differ')
    rgba = bytes(channel for i in range(0, len(bgra), 4) for channel in (bgra[i + 2], bgra[i + 1], bgra[i], bgra[i + 3]))
    require(rgba.hex() == record['vertexRgbaHex'], 'Ahri SCB color conversion differs')
    out.extend(bgra); out.extend(struct.pack('<3f', *record['centralPoint']))
    for i, uv in enumerate(record['faceUv']):
        out.extend(struct.pack('<3I', *record['sourceIndices'][i * 3:i * 3 + 3]))
        material = bytes.fromhex(record['materialSlots'][record['faceMaterialIndices'][i]]['bytesHex'])
        require(len(material) == 64, 'Ahri SCB material width differs')
        out.extend(material); out.extend(struct.pack('<6f', *uv))
    require(record['sourceFaceRgbHex'] == '' and record['tailHex'] == '', 'Unexpected Ahri SCB face colors or tail')
    return bytes(out)
