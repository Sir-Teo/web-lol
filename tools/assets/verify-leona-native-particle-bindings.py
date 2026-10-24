#!/usr/bin/env python3
"""Verify bounded retained particle-binding evidence offline, without target execution.

python3 tools/assets/verify-leona-native-particle-bindings.py --check
Uses only standard-library hashes, JSON, Mach-O headers and selected ARM64 bit masks.
Does not import/execute provider helpers, invoke tools, connect to a bridge or write files.
"""
import argparse
import hashlib
import json
import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PIN = ROOT / 'docs/reference/leona-native-particle-bindings.json'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def checked(record):
    path = ROOT / record['path']
    data = path.read_bytes()
    require(len(data) == record['bytes'], f'Length differs: {path}')
    require(digest(data) == record['sha256'], f'SHA256 differs: {path}')
    return data


def number(value):
    return int(value, 16) if isinstance(value, str) else value


def arm64_sections(binary, arch):
    magic, count = struct.unpack_from('>II', binary)
    require(magic == 0xCAFEBABE, 'Expected FAT32 Mach-O')
    entries = [struct.unpack_from('>5I', binary, 8 + i * 20) for i in range(count)]
    rows = [e for e in entries if e[0] == 0x0100000C]
    require(len(rows) == 1, 'Expected one arm64 slice')
    cpu, subtype, offset, size, align = rows[0]
    require((cpu, subtype, offset, size, align) == tuple(arch[k] for k in
            ['cpuType', 'cpuSubtype', 'offset', 'bytes', 'alignPower']), 'Slice table differs')
    data = binary[offset:offset + size]
    require(len(data) == size and digest(data) == arch['sha256'], 'Slice SHA256 differs')
    header = struct.unpack_from('<8I', data)
    require(header[0] == 0xFEEDFACF and header[1] == cpu and header[3] == 2,
            'Unexpected arm64 Mach-O header')
    cursor, end, sections = 32, 32 + header[5], []
    require(end <= size, 'Load commands exceed slice')
    for _ in range(header[4]):
        cmd, length = struct.unpack_from('<II', data, cursor)
        require(length >= 8 and cursor + length <= end, 'Invalid load command')
        if cmd == 0x19:
            nsects = struct.unpack_from('<I', data, cursor + 64)[0]
            require(72 + 80 * nsects <= length, 'Invalid segment sections')
            for i in range(nsects):
                s = cursor + 72 + 80 * i
                name, segment, address, size_, off = struct.unpack_from('<16s16sQQI', data, s)
                flags = struct.unpack_from('<I', data, s + 64)[0]
                sections.append(dict(name=name.rstrip(b'\0').decode(),
                                     segment=segment.rstrip(b'\0').decode(),
                                     address=address, bytes=size_, offset=off, flags=flags))
        cursor += length
    require(cursor == end, 'Load command extent differs')
    return data, sections


def verify():
    pin = json.loads(PIN.read_text())
    require(pin['nativeExecuted'] is False and pin['nativeShaderExecuted'] is False,
            'Evidence must not claim execution')
    checked(pin['verifier'])
    matching = json.loads(checked(pin['matchingNativePin']))
    require(matching['matchingVersion'] == '16.18.8175716', 'Matching version differs')
    target = pin['target']
    require(target['path'] == matching['nativeRoot'] + '/' + matching['executableName'],
            'Target differs from matching pin')
    arch = next(a for a in matching['macho']['architectures'] if a['architecture'] == 'arm64')
    require(target['architecture'] == arch, 'Architecture provenance differs')
    selected = next(f for f in matching['selectedFiles'] if f['path'] == target['path'])
    require(all(target[k] == selected[k] for k in ['path', 'bytes', 'sha256']),
            'Whole executable provenance differs')
    binary = checked(target)
    data, sections = arm64_sections(binary, arch)

    def at(address, length):
        address = number(address)
        rows = [s for s in sections if s['address'] <= address
                and address + length <= s['address'] + s['bytes']]
        require(len(rows) == 1, f'Unmapped/ambiguous address: {address:#x}')
        s = rows[0]
        # S_ZEROFILL/S_GB_ZEROFILL/S_THREAD_LOCAL_ZEROFILL must never be read
        # using file offsets (DATA virtual size extends beyond file-backed data).
        require(s['flags'] & 0xFF not in [1, 12, 18], f'Zerofill is not file evidence: {address:#x}')
        start = s['offset'] + address - s['address']
        require(start + length <= len(data), 'Read exceeds slice')
        return data[start:start + length]

    def word(address):
        return struct.unpack('<I', at(address, 4))[0]

    for record in pin['provider']['retainedInstalledFiles'] + pin['sdkFiles']:
        checked(record)
    package = next(r for r in pin['provider']['retainedInstalledFiles']
                   if Path(r['path']).name == 'package.json')
    pkg = json.loads(checked(package))
    require((pkg['name'], pkg['version']) == ('rea-agents', '6.4.0'), 'Provider version differs')
    for record in pin['rawProviderFiles']:
        obj = json.loads(checked(record))
        require('not REA' in obj['classification'], 'Raw provider classification differs')
        require(obj['method'] in ['analyze_function', 'xrefs'], 'Unexpected retained provider method')
        result = obj['response']['result']
        if obj['method'] == 'analyze_function':
            require(isinstance(result['assembly'], list) and result['assembly'], 'Missing assembly')
            addresses = [int(row.split(':')[0], 16) for row in result['assembly']]
            require(len(addresses) == len(set(addresses)), 'Duplicate assembly addresses')
            for address in addresses:
                at(address, 4)
        else:
            require(all(isinstance(a, str) and re.fullmatch(r'0x[0-9a-f]+', a)
                        for a in result), 'Unexpected xrefs')

    for span in pin['instructionSpans']:
        raw = at(span['address'], span['bytes'])
        require(raw.hex() == span['hex'] and digest(raw) == span['sha256'],
                f'Instruction bytes differ: {span["name"]}')
    for table in pin['immutableTables']:
        require(at(table['address'], table['bytes']).hex() == table['hex'],
                f'Table differs: {table["name"]}')
    for string in pin['strings']:
        expected = string['value'].encode() + b'\0'
        require(at(string['address'], len(expected)) == expected
                and expected.hex() == string['hex'], f'CString differs: {string["address"]}')

    checks = pin['checks']
    for row in checks['blTargets']:
        pc = number(row['address']); w = word(pc)
        require(w & 0xFC000000 == 0x94000000, f'Not BL: {pc:#x}')
        imm = w & 0x3FFFFFF
        if imm & (1 << 25):
            imm -= 1 << 26
        require(pc + imm * 4 == number(row['target']), f'BL target differs: {pc:#x}')
    for row in checks['mov32Constants']:
        pc = number(row['address']); w = word(pc)
        require(w & 0x80000000 == 0 and w & 0x1F800000 == 0x12800000,
                f'Not 32-bit move-wide: {pc:#x}')
        op, shift, imm = (w >> 29) & 3, ((w >> 21) & 3) * 16, (w >> 5) & 0xFFFF
        require(op in [0, 2] and shift < 32, f'Unexpected move-wide form: {pc:#x}')
        value = (imm << shift) if op == 2 else (~(imm << shift) & 0xFFFFFFFF)
        require((w & 31, value) == (row['register'], row['value']),
                f'Move constant differs: {pc:#x}')
    operations = {'STR8': (0x39000000, 1), 'LDR8': (0x39400000, 1),
                  'STR16': (0x79000000, 2), 'LDR16': (0x79400000, 2),
                  'STR32': (0xB9000000, 4), 'LDR32': (0xB9400000, 4),
                  'STR64': (0xF9000000, 8), 'LDR64': (0xF9400000, 8)}
    for row in checks['unsignedImmediateMemory']:
        pc = number(row['address']); w = word(pc); op, scale = operations[row['operation']]
        require(w & 0xFFC00000 == op and w & 31 == row['register']
                and (w >> 5) & 31 == row['baseRegister']
                and ((w >> 10) & 4095) * scale == row['offset'],
                f'Memory instruction differs: {pc:#x}')
    for row in checks.get('unscaledMemory', []):
        pc = number(row['address']); w = word(pc)
        imm = (w >> 12) & 511
        if imm & 256:
            imm -= 512
        require(row['operation'] == 'LDUR8' and w & 0xFFE00C00 == 0x38400000
                and w & 31 == row['register'] and (w >> 5) & 31 == row['baseRegister']
                and imm == row['offset'], f'Unscaled memory differs: {pc:#x}')
    for row in checks.get('conditionalBranches', []):
        pc = number(row['address']); w = word(pc)
        if row['operation'] == 'CBZ32':
            require(w & 0xFF000000 == 0x34000000 and w & 31 == row['register'],
                    f'Not expected CBZ32: {pc:#x}')
        elif row['operation'] == 'CBZ64':
            require(w & 0xFF000000 == 0xB4000000 and w & 31 == row['register'],
                    f'Not expected CBZ64: {pc:#x}')
        else:
            require(row['operation'] == 'B.EQ' and w & 0xFF00001F == 0x54000000,
                    f'Not expected B.EQ: {pc:#x}')
        imm = (w >> 5) & 0x7FFFF
        if imm & (1 << 18):
            imm -= 1 << 19
        require(pc + imm * 4 == number(row['target']), f'Conditional target differs: {pc:#x}')
    for row in checks.get('preindexedMemory', []):
        pc = number(row['address']); w = word(pc); imm = (w >> 12) & 511
        if imm & 256:
            imm -= 512
        require(w & 0xFFE00C00 == 0xF8400C00 and w & 31 == row['register']
                and (w >> 5) & 31 == row['baseRegister'] and imm == row['offset'],
                f'Preindexed load differs: {pc:#x}')
    for row in checks['adrpAddAddresses']:
        pc = number(row['adrp']); w = word(pc); add = word(row['add'])
        require(w & 0x9F000000 == 0x90000000 and add & 0xFFC00000 == 0x91000000,
                f'Not ADRP/ADD: {pc:#x}')
        imm = (((w >> 5) & 0x7FFFF) << 2) | ((w >> 29) & 3)
        if imm & (1 << 20):
            imm -= 1 << 21
        require(w & 31 == (add >> 5) & 31, 'ADRP/ADD register differs')
        resolved = (pc & ~4095) + (imm << 12) + ((add >> 10) & 4095)
        require(resolved == number(row['target']), f'ADRP/ADD target differs: {pc:#x}')

    for row in checks.get('adrpLoadPointers', []):
        pc = number(row['adrp']); w = word(pc); load = word(row['load'])
        require(w & 0x9F000000 == 0x90000000 and load & 0xFFC00000 == 0xF9400000,
                f'Not ADRP/LDR64: {pc:#x}')
        imm = (((w >> 5) & 0x7FFFF) << 2) | ((w >> 29) & 3)
        if imm & (1 << 20):
            imm -= 1 << 21
        require(w & 31 == (load >> 5) & 31, 'ADRP/LDR register differs')
        resolved = (pc & ~4095) + (imm << 12) + ((load >> 10) & 4095) * 8
        require(resolved == number(row['resolvedPointerAddress'])
                and struct.unpack('<Q', at(resolved, 8))[0] == number(row['pointee']),
                f'ADRP/LDR pointer differs: {pc:#x}')

    slot = pin['slotNames']
    for row in slot['entries']:
        pointer = struct.unpack('<Q', at(number(slot['tableAddress']) + row['index'] * 8, 8))[0]
        require(pointer == number(row['address'])
                and at(pointer, len(row['value']) + 1) == row['value'].encode() + b'\0',
                f'Slot-name pointer differs: {row["index"]}')
    require(struct.unpack('<4Q', at(0x1021346D0, 32)) == (2, 0, 3, 5), 'Address map differs')
    require(struct.unpack('<Q', at(0x102134860, 8))[0] == 80, 'Format2 differs')
    require(struct.unpack('<Q', at(0x102134958, 8))[0] == 2, 'TextureType0 differs')
    require(struct.unpack('<Q', at(0x102497568 + 0x108, 8))[0] == 0x101A86BC0,
            'Metal factory virtual slot differs')
    require(struct.unpack('<Q', at(0x102497568 + 0x88, 8))[0] == 0x101A866F4,
            'Metal RHI factory virtual slot differs')
    for record in pin['sdkFiles']:
        text = checked(record).decode()
        name = Path(record['path']).name
        required = {'MTLPixelFormat.h': [('MTLPixelFormatBGRA8Unorm', 80)],
                    'MTLTexture.h': [('MTLTextureType2D', 2)],
                    'MTLSampler.h': [('MTLSamplerAddressModeClampToEdge', 0),
                                     ('MTLSamplerAddressModeRepeat', 2),
                                     ('MTLSamplerAddressModeMirrorRepeat', 3),
                                     ('MTLSamplerAddressModeClampToBorderColor', 5)]}[name]
        for label, value in required:
            require(re.search(r'\b' + label + r'\b[^\n=]*=\s*' + str(value) + r'\s*,', text),
                    f'SDK enum differs: {label}')
    return pin


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', required=True)
    parser.parse_args()
    pin = verify()
    print(f'PASS: {len(pin["rawProviderFiles"])} raw Hopper records, '
          f'{len(pin["instructionSpans"])} byte spans, native whole/arm64 identity, '
          'selected ARM64 checks, tables, slot names and retained SDK enums. Offline/static only.')


if __name__ == '__main__':
    main()
