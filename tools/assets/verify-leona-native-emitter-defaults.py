#!/usr/bin/env python3
"""Check retained native emitter defaults/registration bytes offline; never run a target."""
import argparse
import bisect
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


def sha(data):
    return hashlib.sha256(data).hexdigest()


def checked(row):
    data = (ROOT / row['path']).read_bytes()
    require((len(data), sha(data)) == (row['bytes'], row['sha256']),
            'Retained bytes differ: ' + row['path'])
    return data


def num(value):
    return int(value, 16) if isinstance(value, str) else value


def fnv(name):
    value = 0x811c9dc5
    for byte in name.lower().encode('ascii'):
        value = ((value ^ byte) * 0x01000193) & 0xffffffff
    return value


def verify(path):
    pin = json.loads(path.read_text())
    require(pin['nativeExecuted'] is False and pin['nativeShaderExecuted'] is False,
            'Unexpected execution claim')
    checked(pin['verifier'])
    helper = pin['sectionParser']; checked(helper)
    spec = importlib.util.spec_from_file_location('retained_particle_section_parser', ROOT / helper['path'])
    parser = importlib.util.module_from_spec(spec); spec.loader.exec_module(parser)
    matching = json.loads(checked(pin['matchingNativePin']))
    binding = json.loads(checked(pin['bindingPin']))
    arch = next(a for a in matching['macho']['architectures'] if a['architecture'] == 'arm64')
    require(pin['target'] == binding['target'], 'Target differs from binding pin')
    require(pin['target']['architecture'] == arch, 'Architecture differs')
    binary = checked(pin['target'])
    data, sections = parser.arm64_sections(binary, arch)
    require(checked(pin['thinSlice']) == data, 'Derived thin slice differs')

    def at(address, count):
        address = num(address)
        rows = [s for s in sections if s['address'] <= address
                and address + count <= s['address'] + s['bytes']]
        require(len(rows) == 1, f'Ambiguous/unmapped span {address:#x}')
        s = rows[0]
        require(s['flags'] & 255 not in [1, 12, 18], 'Zerofill cannot supply bytes')
        offset = s['offset'] + address - s['address']
        require(offset + count <= len(data), 'Span exceeds slice')
        return data[offset:offset + count]

    def word(address):
        return struct.unpack('<I', at(address, 4))[0]

    def branch(address, link=True):
        pc = num(address); w = word(pc)
        require(w & 0xfc000000 == (0x94000000 if link else 0x14000000), 'Expected direct branch')
        immediate = w & 0x3ffffff
        if immediate & (1 << 25): immediate -= 1 << 26
        return pc + 4 * immediate

    def movz(address, register, value):
        w = word(address)
        require(w & 0xff80001f == (0x52800000 | register), 'Expected MOVZ Wn')
        shift = ((w >> 21) & 3) * 16
        require(shift < 32 and (((w >> 5) & 65535) << shift) == value, 'MOVZ constant differs')

    def pair(row):
        a, b = map(num, row['hashPair']); w, z = word(a), word(b)
        require(b == a + 4 and w & 0xffe0001f == 0x52800001
                and z & 0xffe0001f == 0x72a00001, 'Expected adjacent MOVZ/MOVK W1 hash')
        value = ((w >> 5) & 65535) | (((z >> 5) & 65535) << 16)
        require(value == fnv(row['name']) == num(row['hash']), 'BIN hash/name differs')

    # The helper's parser is local project code. It only reads headers; this is
    # deliberately not an import of REA, a target library, or an analysis tool.
    cursor = 32; linkedit = None
    for _ in range(struct.unpack_from('<I', data, 16)[0]):
        cmd, length = struct.unpack_from('<II', data, cursor)
        if cmd == 0x26: linkedit = struct.unpack_from('<II', data, cursor + 8)
        cursor += length
    require(linkedit is not None, 'Missing LC_FUNCTION_STARTS')
    info = pin['functionStarts']
    require(linkedit == (info['offset'], info['bytes']), 'Function-start command differs')
    encoded = data[linkedit[0]:linkedit[0] + linkedit[1]]
    require(sha(encoded) == info['sha256'], 'Function-start bytes differ')
    starts = []; offset = 0; value = 0; shift = 0
    for byte in encoded:
        value |= (byte & 127) << shift
        if byte & 128:
            shift += 7; require(shift < 64, 'Invalid ULEB128'); continue
        if value == 0: break
        offset += value; starts.append(num(pin['textVmaddr']) + offset); value = 0; shift = 0
    require(len(starts) == info['count'] and starts == sorted(set(starts)), 'Function starts differ')
    for row in pin['llvmRecords']:
        text = checked(row).decode()
        require('NOT REA Evidence' in pin['classification'], 'Evidence classification differs')
        begin, end = num(row['requestedStart']), num(row['nextFunctionStart'])
        index = bisect.bisect_left(starts, begin)
        require(starts[index:index + 2] == [begin, end], 'Requested function-start bounds differ')
        decoded = [(int(a, 16), int(w, 16)) for a, w in
                   re.findall(r'^([0-9a-f]{9}): ([0-9a-f]{8})\s', text, re.M)]
        require([a for a, _ in decoded] == list(range(begin, end, 4)), 'Incomplete/out-of-bounds words')
        require(len(decoded) == row['instructions'], 'Instruction count differs')
        for address, value in decoded:
            require(word(address) == value, f'LLVM word differs at {address:#x}')
    retained = {Path(row['path']).name: checked(row) for row in pin['retainedInputs']}
    dictionary = retained['hashes.bintypes.txt'].decode()
    reader = retained['binfile.py'].decode()
    for label, value in [('U8', '3'), ('FLOAT', '10'), ('STRING', '16'), ('STRUCT', '0x82')]:
        require(re.search(r'^    ' + label + r' = ' + value + r'\b', reader, re.M), 'Reader enum differs')
    for row in pin['typeRegistrations']:
        require(re.search(r'^' + f'{num(row["hash"]):08x}' + ' ' + row['name'] + r'$', dictionary, re.M),
                'Type dictionary name differs')
    for row in pin['instructionSpans']:
        raw = at(row['address'], row['bytes'])
        require((raw.hex(), sha(raw)) == (row['hex'], row['sha256']), 'Instruction span differs: ' + row['name'])
    for row in pin['typeRegistrations']:
        pair(row); movz(row['sizeInstruction'], 7, row['size'])
        require(branch(row['call']) == 0x10169e674, 'Type registry call differs')
        for callback in row['callbacks']:
            pc = num(callback['instruction']); w = word(pc)
            require(w & 0x9f00001f == (0x10000000 | callback['register']), 'Expected ADR callback')
            imm = (((w >> 5) & 0x7ffff) << 2) | ((w >> 29) & 3)
            if imm & (1 << 20): imm -= 1 << 21
            require(pc + imm == num(callback['target']), 'Callback target differs')
    for row in pin['fieldRegistrations']:
        pair(row); movz(row['offsetInstruction'], 2, row['offset'])
        require(branch(row['call']) == num(row['wrapper']), 'Field wrapper differs')
    for row in pin['directBranches']:
        require(branch(row['address'], row['link']) == num(row['target']), 'Direct branch target differs')
    for row in pin['exactWords']:
        require(word(row['address']) == num(row['word']), 'Selected instruction differs: ' + row['meaning'])
    require(struct.unpack('<Q', at(0x10246e0c0, 8))[0] == 0x102230369
            and at(0x102230369, 1) == b'\0', 'Empty-string default differs')
    source = json.loads(checked(pin['sourcePin']))
    activate = source['resources']['Leona_R_buf']['definition']['complexEmitterDefinitionData'][3]
    require(activate['emitterName'] == 'Activate' and 'primitive' not in activate and 'texture' not in activate,
            'Activate omitted fields differ')
    require(pin['remainingGates'] and pin['visibleFamilies'] == 41, 'Scope/gates differ')
    return pin


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--check', required=True, action='store_true')
    cli.add_argument('--pin', type=Path, default=ROOT / 'docs/reference/leona-native-emitter-defaults.json')
    pin = verify(cli.parse_args().pin)
    print(f'PASS: {len(pin["llvmRecords"])} bounded LLVM word streams, native whole/slice identity, '
          f'{len(pin["typeRegistrations"])} type registrations, {len(pin["fieldRegistrations"])} fields, '
          'constructor defaults and older generic base-resource chain. Offline/static only.')


if __name__ == '__main__':
    main()
