#!/usr/bin/env python3
"""Verify native generic SCB normal math and derived source streams, offline/static."""
import argparse
import hashlib
import importlib.util
import json
import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def require(ok, message):
    if not ok:
        raise ValueError(message)


def sha(data): return hashlib.sha256(data).hexdigest()
def num(value): return int(value, 16) if isinstance(value, str) else value


def checked(record):
    data = (ROOT / record['path']).read_bytes()
    require((len(data), sha(data)) == (record['bytes'], record['sha256']), 'Retained bytes differ: ' + record['path'])
    return data


def module(record, name):
    checked(record); spec = importlib.util.spec_from_file_location(name, ROOT / record['path'])
    result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result)
    return result


def verify(path):
    pin = json.loads(path.read_text()); checked(pin['verifier'])
    require(not pin['nativeExecuted'] and not pin['nativeShaderExecuted'], 'Unexpected execution claim')
    matching = json.loads(checked(pin['matchingNativePin']))
    target = pin['target']; arch = target['architecture']
    require(arch == next(a for a in matching['macho']['architectures'] if a['architecture'] == 'arm64'), 'Architecture differs')
    original = next(f for f in matching['selectedFiles'] if f['path'] == target['path'])
    require(all(target[k] == original[k] for k in ['path', 'bytes', 'sha256']), 'Matching native identity differs')
    parser = module(pin['sectionParser'], 'retained_scb_section_parser')
    data, sections = parser.arm64_sections(checked(target), arch)

    def at(address, size):
        address = num(address); rows = [s for s in sections if s['address'] <= address
                                       and address + size <= s['address'] + s['bytes']]
        require(len(rows) == 1 and rows[0]['flags'] & 255 not in [1, 12, 18], 'Unmapped/zerofill native read')
        s = rows[0]; offset = s['offset'] + address - s['address']
        require(offset + size <= len(data), 'Native span exceeds slice')
        return data[offset:offset + size]

    def word(address): return struct.unpack('<I', at(address, 4))[0]
    cursor = 32; link = None
    for _ in range(struct.unpack_from('<I', data, 16)[0]):
        command, length = struct.unpack_from('<II', data, cursor)
        if command == 0x26: link = struct.unpack_from('<II', data, cursor + 8)
        cursor += length
    info = pin['functionStarts']; require(link == (info['offset'], info['bytes']), 'Function-start command differs')
    encoded = data[link[0]:link[0] + link[1]]; require(sha(encoded) == info['sha256'], 'Function-start bytes differ')
    starts = []; total = 0; value = 0; shift = 0
    for byte in encoded:
        value |= (byte & 127) << shift
        if byte & 128:
            shift += 7; require(shift < 64, 'Invalid ULEB128'); continue
        if value == 0: break
        total += value; starts.append(num(pin['textVmaddr']) + total); value = 0; shift = 0
    require(len(starts) == info['count'] and starts == sorted(set(starts)), 'Function starts differ')
    successors = dict(zip(starts, starts[1:]))
    for row in pin['llvmRecords']:
        start, end = num(row['requestedStart']), num(row['nextFunctionStart'])
        require(successors.get(start) == end, 'Native function-start bounds differ')
        words = [(int(a, 16), int(w, 16)) for a, w in
                 re.findall(r'^([0-9a-f]{9}): ([0-9a-f]{8})\s', checked(row).decode(), re.M)]
        require([a for a, _ in words] == list(range(start, end, 4)), 'Incomplete native word stream')
        for address, value in words: require(word(address) == value, 'LLVM/native word differs')
    for row in pin['retainedInputs']: checked(row)
    for row in pin['instructionSpans']:
        raw = at(row['address'], row['bytes'])
        require((raw.hex(), sha(raw)) == (row['hex'], row['sha256']), 'Native byte span differs')
    for row in pin['directBranches']:
        pc = num(row['address']); w = word(pc); require(w & 0xfc000000 == 0x94000000, 'Expected BL')
        imm = w & 0x3ffffff
        if imm & (1 << 25): imm -= 1 << 26
        require(pc + imm * 4 == num(row['target']), 'BL target differs')
    for row in pin['exactWords']:
        require(word(row['address']) == int(row['word'], 16), 'Selected math/binding instruction differs')
    require(struct.unpack('<I', at(0x102133d60, 4))[0] == 0x00030002, 'Normal declaration differs')
    shader = checked(pin['vertexShaderText']).decode()
    require('!16 = !{i32 1, !"air.vertex_input", !"air.location_index", i32 2, i32 1' in shader,
            'Retained shader attribute2 differs')
    shader_pin = json.loads(checked(pin['reflectionShaderPin']))
    require(any(s['disassembly']['sha256'] == pin['vertexShaderText']['sha256'] for s in shader_pin['selections']),
            'Shader text provenance differs')

    normal = module(pin['normalHelper'], 'retained_scb_normal_math')
    require(normal.self_check() == pin['mathematicalControls'], 'Mathematical control set differs')
    source = json.loads(checked(pin['sourcePin']))
    for row in pin['streams']:
        raw = checked(row['source']); result = json.loads(checked(row['derived']))
        require(any(r == result['source'] for r in source['extraction']['files']), 'SCB declaration differs')
        require((len(raw), sha(raw)) == (result['source']['bytes'], result['source']['sha256']), 'SCB identity differs')
        require(raw[:8] == b'r3d2Mesh' and struct.unpack_from('<HH', raw, 8) == (3, 2), 'Expected SCB3.2')
        vertices, faces, flags = struct.unpack_from('<III', raw, 140); colors = struct.unpack_from('<I', raw, 176)[0]
        require(flags in [1, 2] and colors in [0, 1], 'Unsupported source flags')
        start = 180 + vertices * 12 + colors * vertices * 4 + 12
        require(start + faces * 100 + (faces * 9 if flags & 1 else 0) == len(raw), 'SCB extent differs')
        points = [list(struct.unpack_from('<3f', raw, 180 + i * 12)) for i in range(vertices)]
        indices = [i for f in range(faces) for i in struct.unpack_from('<3I', raw, start + f * 100)]
        require(indices == result['sourceIndices'], 'Source indices differ')
        values, expanded, stats = normal.normals(points, indices)
        require(values == result['sourceVertexNormals'] and expanded == result['expandedCornerNormals']
                and stats == result['statistics'], 'Derived normal stream differs')
        require(sha(struct.pack('<' + 'f' * len(expanded), *expanded)) == row['expandedFloat32Sha256'], 'Packed normals differ')
        require(stats['zeroVertexNormals'] == 0, 'Unsupported source zero normals')
    browser = json.loads(checked(pin['browserResult']))
    require(browser['ready'] and browser['errors'] == [] and len(browser['results']) == 2,
            'Local normal diagnostic failed')
    require(all(r['changedPixels'] > 100 for r in browser['results']), 'Missing causal normal comparison')
    checked(pin['browserScreenshot'])
    return pin


def main():
    cli = argparse.ArgumentParser(description=__doc__); cli.add_argument('--check', action='store_true', required=True)
    cli.add_argument('--pin', type=Path, default=ROOT / 'docs/reference/leona-native-scb-normals.json')
    pin = verify(cli.parse_args().pin)
    print(f'PASS: {len(pin["llvmRecords"])} native word streams, selected normal math/attribute binding, '
          f'{len(pin["streams"])} complete SCB/derived streams, six mathematical controls and local Chrome comparison. Offline/static check.')


if __name__ == '__main__': main()
