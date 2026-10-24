"""Verify retained R buff shader slices/readers offline; never run native code.

Default uses the standard library. Optional --hashes also recomputes xxhash
define keys (use .tools/cdtb-venv/bin/python). No compiler/network is used.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct

def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def checked(p):
    raw = Path(p['path']).read_bytes()
    assert len(raw) == p['bytes'] and hashlib.sha256(raw).hexdigest() == p['sha256'], p['path']
    return raw

def toc(data):
    offset = 0
    def take(fmt):
        nonlocal offset
        v = struct.unpack_from('<' + fmt, data, offset)
        offset += struct.calcsize('<' + fmt)
        return v[0] if len(v) == 1 else v
    def string():
        nonlocal offset
        size = take('I')
        out = data[offset:offset+size].decode('ascii')
        offset += size
        return out
    assert string() == 'TOC3.0'
    count, define_count, program_count, stage = take('4I')
    assert stage in [0, 1] and count == 2 ** define_count
    assert string() == 'baseDefines'
    defines = dict((string(), string()) for _ in range(define_count))
    assert len(defines) == define_count and string() == 'shaders'
    hashes = [take('Q') for _ in range(count)]
    ids = [take('I') for _ in range(count)]
    assert offset == len(data) and len(set(hashes)) == count
    assert set(ids) == set(range(program_count))
    return defines, dict(zip(hashes, ids))

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--hashes', action='store_true')
    args = parser.parse_args()
    pin = json.loads(Path('docs/reference/leona-r-skin-shaders.json').read_text())
    readers = json.loads(Path('docs/reference/leona-r-skin-readers.json').read_text())
    reading = json.loads(Path('docs/reference/leona-r-skin-reading.json').read_text())
    for p in pin['sourcePins'] + [pin['tocReader'], pin['retainedExtractor']]:
        checked(p)
    for p in readers['files'] + reading['inputs'] + [reading['localSkinMesh']]:
        checked(p)
    assert len(readers['files']) == 16
    assert len(pin['selections']) == 8
    for p in pin['selections']:
        assert sha(p['table']) == p['tableSha256']
        assert sha(p['bundle']) == p['bundleSha256']
        defines, lookup = toc(Path(p['table']).read_bytes())
        assert p['defines'].items() <= defines.items()
        key = int(p['definesHash'], 16)
        if args.hashes:
            from xxhash import xxh64_intdigest
            assert key == xxh64_intdigest(''.join(k+'='+v for k, v in sorted(p['defines'].items())))
        assert lookup[key] == p['programId']
        raw = checked(p['metallib'])
        bc = checked(p['bitcode'])
        checked(p['disassembly'])
        bundle = Path(p['bundle']).read_bytes()
        at = 0
        for i in range(p['programId'] % 100):
            at += 4 + struct.unpack_from('<I', bundle, at)[0]
        size = struct.unpack_from('<I', bundle, at)[0]
        assert at + 4 == p['bundleProgramOffset']
        assert size == len(raw) and bundle[at+4:at+4+size] == raw
        assert raw[:4] == b'MTLB' and bc[:4] == b'BC\xc0\xde'
        offset = p['bitcode']['offset']
        assert raw[offset:offset+len(bc)] == bc
    glb = checked(reading['localSkinMesh'])
    assert glb[:4] == b'glTF'
    mesh = json.loads(glb[20:20+struct.unpack_from('<I', glb, 12)[0]])
    attrs = [set(p['attributes']) for m in mesh['meshes'] for p in m['primitives']]
    assert attrs and all(p == {'POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0'} for p in attrs)
    assert pin['nativeExecuted'] is False and pin['nativeCpuVerified'] is False
    print(json.dumps(dict(result='passed', readers=16, programs=8, streams=24,
                          defineHashesRecomputed=args.hashes, compilerUsed=False,
                          networkUsed=False, nativeExecuted=False)))

if __name__ == '__main__':
    main()
