"""Lossless SCB 3.2 flag-2/vertex-BGRA layout used by both pinned Baron meshes."""
import math
import struct


def require(ok, message):
    if not ok:
        raise ValueError(message)


def scb_mesh(raw):
    require(len(raw) >= 180 and raw[:8] == b'r3d2Mesh' and
            struct.unpack_from('<HH', raw, 8) == (3, 2), 'Unsupported Baron SCB header/version')
    vertices, faces, flags = struct.unpack_from('<III', raw, 140)
    require(vertices > 0 and faces > 0 and flags == 2 and
            struct.unpack_from('<I', raw, 176)[0] == 1, 'Unsupported Baron SCB counts/flags/colors')
    require(len(raw) == 180 + vertices * 16 + 12 + faces * 100, 'Baron SCB extent differs')
    points = [list(struct.unpack_from('<3f', raw, 180 + i * 12)) for i in range(vertices)]
    cursor = 180 + vertices * 12
    colors = raw[cursor:cursor + vertices * 4]
    cursor += vertices * 4
    pivot = list(struct.unpack_from('<3f', raw, cursor))
    cursor += 12
    indices, uv, materials, slots, lookup = [], [], [], [], {}
    for _ in range(faces):
        face = list(struct.unpack_from('<3I', raw, cursor))
        require(all(index < vertices for index in face), 'Baron SCB index outside source vertex array')
        material = raw[cursor + 12:cursor + 76]
        key = material.hex()
        if key not in lookup:
            lookup[key] = len(slots)
            slots.append(dict(bytesHex=key, name=material.split(b'\0')[0].decode('ascii')))
        materials.append(lookup[key])
        indices.extend(face)
        uv.append(list(struct.unpack_from('<6f', raw, cursor + 76)))
        cursor += 100
    bounds = list(struct.unpack_from('<6f', raw, 152))
    require(cursor == len(raw) and
            all(math.isfinite(value) for group in [*points, *uv, pivot, bounds] for value in group),
            'Unparsed or nonfinite Baron SCB data')
    result = dict(headerHex=raw[:180].hex(), version=[3, 2], flags=flags,
                  sourceName=raw[12:140].split(b'\0')[0].decode('ascii'),
                  sourceVertices=vertices, triangles=faces, sourcePoints=points,
                  sourceVertexBgraHex=colors.hex(), sourceIndices=indices, faceUv=uv,
                  materialSlots=slots, faceMaterialIndices=materials,
                  sourceFaceRgbHex='', centralPoint=pivot, sourceBounds=bounds,
                  measuredMinMax=[min(p[i] for p in points) for i in range(3)] +
                                 [max(p[i] for p in points) for i in range(3)],
                  unusedSourceVertices=sorted(set(range(vertices)) - set(indices)), tailHex='')
    require(scb_bytes(result) == raw, 'Baron SCB re-encode differs from original bytes')
    return result


def scb_bytes(record):
    out = bytearray.fromhex(record['headerHex'])
    for point in record['sourcePoints']:
        out.extend(struct.pack('<3f', *point))
    out.extend(bytes.fromhex(record['sourceVertexBgraHex']))
    out.extend(struct.pack('<3f', *record['centralPoint']))
    for i, uv in enumerate(record['faceUv']):
        out.extend(struct.pack('<3I', *record['sourceIndices'][i * 3:i * 3 + 3]))
        out.extend(bytes.fromhex(record['materialSlots'][record['faceMaterialIndices'][i]]['bytesHex']))
        out.extend(struct.pack('<6f', *uv))
    return bytes(out)
