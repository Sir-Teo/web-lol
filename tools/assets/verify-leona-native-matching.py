#!/usr/bin/env python3
"""Verify retained matching Leona native artifacts offline, without loading a target.

Run: .tools/cdtb-venv/bin/python tools/assets/verify-leona-native-matching.py --check
Only hashes, plist/JSON/RMAN parsing, Zstandard decoding and Mach-O header reads run.
No downloads, extraction writes, subprocesses, compiler, disassembler or target calls.
"""
import argparse
import hashlib
import json
import plistlib
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PIN = ROOT / 'docs/reference/leona-native-matching.json'


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


def rman_header(data):
    require(len(data) >= 28, 'Truncated RMAN header')
    magic, major, minor, flags, offset, length, manifest_id, decoded = struct.unpack_from(
        '<4sBBHIIQI', data)
    require(magic == b'RMAN' and (major, minor) == (2, 1), 'Unexpected RMAN header')
    require(offset == 28 and flags & 0x200, 'Unexpected RMAN body encoding')
    require(offset + length <= len(data), 'RMAN body outside file')
    return dict(version=[major, minor], flags=flags, offset=offset,
                compressedBodyBytes=length, manifestId=f'{manifest_id:016X}',
                decodedBodyBytes=decoded)


def sequence(file):
    return [dict(id=f'{c.chunk_id:016X}', bytes=c.target_size) for c in file.chunks]


def sequence_sha(file):
    return digest(json.dumps(sequence(file), separators=(',', ':')).encode())


def macho(data):
    require(len(data) >= 8, 'Truncated universal header')
    magic, count = struct.unpack_from('>II', data)
    require(magic == 0xCAFEBABE and count == 2, 'Expected two-slice FAT32 Mach-O')
    require(8 + count * 20 <= len(data), 'Truncated architecture table')
    result, spans = [], []
    names = {0x01000007: 'x86_64', 0x0100000C: 'arm64'}
    for index in range(count):
        cpu, subtype, offset, size, align = struct.unpack_from('>IIIII', data, 8 + index * 20)
        require(cpu in names and align <= 31, 'Unknown architecture/alignment')
        require(offset % (1 << align) == 0 and offset >= 8 + count * 20,
                'Misaligned or overlapping architecture header')
        require(size >= 32 and offset + size <= len(data), 'Slice outside executable')
        require(all(offset >= end or offset + size <= start for start, end in spans),
                'Overlapping Mach-O slices')
        spans.append((offset, offset + size))
        header = struct.unpack_from('<8I', data, offset)
        require(header[0] == 0xFEEDFACF and header[1:3] == (cpu, subtype),
                'Mach-O slice/header architecture mismatch')
        require(header[3] == 2 and 32 + header[5] <= size,
                'Not MH_EXECUTE or invalid load-command extent')
        result.append(dict(architecture=names[cpu], cpuType=cpu, cpuSubtype=subtype,
                           offset=offset, bytes=size, alignPower=align,
                           magic=f'{header[0]:08X}', fileType=header[3],
                           loadCommands=header[4], loadCommandBytes=header[5],
                           flags=header[6], reserved=header[7],
                           sha256=digest(data[offset:offset + size])))
    require({a['architecture'] for a in result} == {'arm64', 'x86_64'}, 'Missing architecture')
    return dict(magic='CAFEBABE', format='FAT32 big-endian / Mach-O64 little-endian',
                architectureCount=count, architectures=result)


def verify():
    pin = json.loads(PIN.read_text())
    require(pin['nativeExecuted'] is False, 'Pin must not claim execution')
    for record in pin['readers']['files'] + pin['evidenceFiles']:
        checked(record)
    # Imports use the retained, hash-checked read-only RMAN parser. The collector and
    # extraction scripts are evidence bytes only and are never imported or executed.
    sys.path.insert(0, str(ROOT / '.tools/cdtb'))
    try:
        from cdtb.patcher import PatcherManifest
        from cdtb.tools import zstd_decompress
    except ImportError as error:
        raise RuntimeError('Use the existing .tools/cdtb-venv/bin/python runtime') from error

    manifests = []
    for record in [pin['officialManifest'], pin['frozenAssetsManifest']]:
        data = checked(record)
        header = rman_header(data)
        require(header == record['header'], f'RMAN header differs: {record["path"]}')
        body = zstd_decompress(data[header['offset']:
                                    header['offset'] + header['compressedBodyBytes']])
        require(len(body) == header['decodedBodyBytes'], 'RMAN decoded body size differs')
        manifest = PatcherManifest(str(ROOT / record['path']))
        require(len(manifest.files) == record['fileCount'], 'RMAN file count differs')
        manifests.append(manifest)
    matching, assets = manifests

    inventory = json.loads(checked(pin['inventory']))
    require(inventory['sha256'] == pin['officialManifest']['sha256'], 'Inventory manifest mismatch')
    rows = {f['name']: f for f in inventory['files']}
    require(len(rows) == len(inventory['files']) == len(matching.files), 'Inventory names differ')
    for name, file in matching.files.items():
        require(name in rows and rows[name]['bytes'] == file.size
                and rows[name]['chunks'] == len(file.chunks), f'Inventory differs: {name}')

    chunk_records = {c['id']: c for c in pin['chunks']}
    require(len(chunk_records) == len(pin['chunks']), 'Duplicate pinned chunk IDs')
    decoded = {}
    for key, record in chunk_records.items():
        chunk = matching.chunks[int(key, 16)]
        require(record['url'] == 'https://lol.secure.dyn.riotcdn.net/channels/public/bundles/'
                + f'{chunk.bundle.bundle_id:016X}.bundle', f'Bundle URL differs: {key}')
        require(record['range'] == [chunk.offset, chunk.offset + chunk.size - 1]
                and record['bytes'] == chunk.size and record['decodedBytes'] == chunk.target_size,
                f'RMAN chunk extent differs: {key}')
        raw = checked(record)
        plain = zstd_decompress(raw)
        require(len(plain) == record['decodedBytes'] and digest(plain) == record['decodedSha256'],
                f'Decoded chunk differs: {key}')
        decoded[key] = plain

    used = set()
    for record in pin['selectedFiles']:
        file = matching.files[record['name']]
        keys = [f'{c.chunk_id:016X}' for c in file.chunks]
        require(keys == record['chunks'] and file.size == record['bytes'],
                f'Selected RMAN file differs: {record["name"]}')
        actual = checked(record)
        offset = 0
        rebuilt_hash = hashlib.sha256()
        for key in keys:
            plain = decoded[key]
            require(actual[offset:offset + len(plain)] == plain,
                    f'File/chunk bytes differ: {record["name"]}/{key}')
            rebuilt_hash.update(plain)
            offset += len(plain)
            used.add(key)
        require(offset == len(actual) and rebuilt_hash.hexdigest() == record['sha256'],
                f'Reconstructed file differs: {record["name"]}')
    require(used == set(chunk_records), 'Unreferenced or missing retained chunk')

    for record in pin['matchingContent']:
        name = record['name']
        a, b = matching.files[name], assets.files[name]
        require(a.size == b.size == record['bytes'], f'Content length differs: {name}')
        require(sequence(a) == sequence(b), f'Ordered content chunks differ: {name}')
        require(len(a.chunks) == record['chunkCount'] and sequence_sha(a) == record['sequenceSha256'],
                f'Content sequence digest differs: {name}')

    native_root = ROOT / pin['nativeRoot']
    for name, expected in pin['versions'].items():
        require(json.loads((native_root / name).read_bytes()) == expected, f'Version differs: {name}')
    require(plistlib.loads((native_root / pin['plistName']).read_bytes()) == pin['plist'],
            'Retained plist differs')
    executable = (native_root / pin['executableName']).read_bytes()
    require(macho(executable) == pin['macho'], 'Universal Mach-O static header/slices differ')

    index = checked(pin['collectorIndex']['macos'])
    require(index.decode().strip() == pin['officialManifest']['url'], 'Collector manifest URL differs')
    blob = hashlib.sha1(b'blob ' + str(len(index)).encode() + b'\0' + index).hexdigest()
    require(blob == pin['collectorIndex']['macos']['gitBlobSha1'], 'Collector Git blob differs')
    collector = pin['collectorIndex']['collectorScript']
    source = checked(collector)
    source_blob = hashlib.sha1(b'blob ' + str(len(source)).encode() + b'\0' + source).hexdigest()
    require(source_blob == collector['gitBlobSha1'], 'Collector source Git blob differs')
    print('Verified matching 16.18.8175716: 5 files / 14 official-CDN range chunks; '
          'x86_64 + arm64 Mach-O; Leona 4650 and Metal 5824 ordered content chunks identical.')
    print('Offline only: no downloads, target loading/execution, compiler or binary session calls.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Run all read-only offline checks (default)')
    parser.parse_args()
    try:
        verify()
    except (ValueError, OSError, RuntimeError, KeyError) as error:
        parser.exit(1, f'Native matching verification failed: {error}\n')


if __name__ == '__main__':
    main()
