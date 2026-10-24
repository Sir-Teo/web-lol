"""Strict SCB 3.2 layout used by the six retained Eclipse meshes.

The separately pinned LeagueToolkit reader establishes field layout. This does
not interpret emitter transforms, vertex-color blending or native rendering.
"""
import math
import struct


def decode_mesh(raw, source):
    assert raw[:8] == b'r3d2Mesh' and struct.unpack_from('<HH', raw, 8) == (3, 2)
    vertices, faces, flags = struct.unpack_from('<III', raw, 140)
    has_colors = struct.unpack_from('<I', raw, 176)[0]
    assert vertices > 0 and faces > 0 and flags in (1, 2) and has_colors in (0, 1)
    cursor = 180
    points = [struct.unpack_from('<3f', raw, cursor + i * 12) for i in range(vertices)]
    cursor += vertices * 12
    vertex_bgra = list(raw[cursor:cursor + vertices * 4]) if has_colors else []
    cursor += len(vertex_bgra)
    assert not has_colors or len(vertex_bgra) == vertices * 4
    pivot = struct.unpack_from('<3f', raw, cursor)
    cursor += 12
    positions, uv, indices, materials, expanded_bgra = [], [], [], set(), []
    for _ in range(faces):
        face = struct.unpack_from('<3I', raw, cursor)
        material = raw[cursor + 12:cursor + 76].split(b'\0')[0].decode('ascii')
        materials.add(material)
        tex = struct.unpack_from('<6f', raw, cursor + 76)
        for corner, index in enumerate(face):
            assert index < vertices
            positions.extend(points[index])
            uv.extend([tex[corner], tex[corner + 3]])
            indices.append(index)
            if has_colors:
                expanded_bgra.extend(vertex_bgra[index * 4:index * 4 + 4])
        cursor += 100
    face_rgb = list(raw[cursor:cursor + faces * 9]) if flags & 1 else []
    cursor += len(face_rgb)
    assert not (flags & 1) or len(face_rgb) == faces * 9
    assert cursor == len(raw), 'Unparsed SCB bytes require explicit handling'
    assert set(indices) == set(range(vertices)), 'Unreferenced vertices require explicit handling'
    assert len(materials) == 1, 'Multiple material groups require explicit handling'
    bounds = struct.unpack_from('<6f', raw, 152)
    assert all(math.isfinite(v) for v in positions + uv + list(pivot) + list(bounds))
    return dict(source=source, sourceName=raw[12:140].split(b'\0')[0].decode('ascii'),
        sourceVertices=vertices, triangles=faces, version=[3, 2], flags=flags,
        positions=positions, uv=uv, sourceIndices=indices, sourceVertexBGRA=vertex_bgra,
        expandedVertexBGRA=expanded_bgra, sourceFaceRGB=face_rgb,
        materials=sorted(materials), centralPoint=pivot, sourceBounds=bounds,
        measuredMinMax=[min(p[i] for p in points) for i in range(3)] +
                       [max(p[i] for p in points) for i in range(3)], tailHex='')
