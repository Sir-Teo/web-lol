"""Pin all fifteen native particle-distortion Metal variants without execution.
Run with PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python.
Uses an existing clang to decode AIR bitcode to text with LLVM passes disabled.
Clang retargets the textual module to the host; original Metal/bitcode bytes and
hashes remain canonical. This does not establish native CPU dispatch or samplers.
"""
import itertools, struct, json, hashlib, subprocess
from pathlib import Path
from xxhash import xxh64_intdigest
from riot_archive import RiotArchive

def decode_toc(data):
    """TOC3.0 layout from the pinned LeagueToolkit ShaderToc reader."""
    offset = 0

    def unpack(fmt):
        nonlocal offset
        values = struct.unpack_from('<' + fmt, data, offset)
        offset += struct.calcsize('<' + fmt)
        return values[0] if len(values) == 1 else values

    def string():
        nonlocal offset
        size = unpack('I')
        value = data[offset:offset + size].decode('ascii')
        assert len(data[offset:offset + size]) == size
        offset += size
        return value
    assert string() == 'TOC3.0'
    count, define_count, bundled_count, stage = unpack('4I')
    assert stage in (0, 1)
    assert string() == 'baseDefines'
    defines = [(string(), string()) for _ in range(define_count)]
    assert string() == 'shaders'
    hashes = [unpack('Q') for _ in range(count)]
    ids = [unpack('I') for _ in range(count)]
    assert offset == len(data)
    assert len(set(hashes)) == count
    assert count == 2 ** define_count
    assert set(ids) == set(range(bundled_count))
    assert len({k for k, _ in defines}) == define_count
    expected = set()
    for bits in itertools.product((False, True), repeat=define_count):
        selected = sorted((d for d, enabled in zip(defines, bits) if enabled))
        expected.add(xxh64_intdigest(''.join((f'{k}={v}' for k, v in selected))))
    assert expected == set(hashes)
    return (defines, dict(zip(hashes, ids)), stage, bundled_count)

def programs(data):
    offset, result = (0, [])
    while offset < len(data):
        size, = struct.unpack_from('<I', data, offset)
        offset += 4
        program = data[offset:offset + size]
        assert size > 0 and len(program) == size and (program[:4] == b'MTLB')
        result.append(program)
        offset += size
    assert offset == len(data) and 1 <= len(result) <= 100
    return result
root = Path('.cache/particle-distortion-shaders')
root.mkdir(parents=True, exist_ok=True)
prefix = 'assets/shaders/hlsl/particlesystem/'
paths = [prefix + n for n in ['distortion_ps.ps-metal', 'distortion_vs.vs-metal', 'distortion_mesh_ps.ps-metal', 'distortion_mesh_vs.vs-metal']]
pin_path = Path('docs/reference/particle-distortion-shaders.json')
pin = json.loads(pin_path.read_text()) if pin_path.exists() else None
a = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in paths + [p + '_0' for p in paths]}, pin['provenance'] if pin else None, archive_name='DATA/FINAL/ShaderCache.metal.wad.client')
a.extract(paths + [p + '_0' for p in paths], root / 'native')
records = []
sha = lambda b: hashlib.sha256(b).hexdigest()
for p in paths:
    defines, lookup, stage, count = decode_toc((root / 'native' / p).read_bytes())
    binaries = programs((root / 'native' / (p + '_0')).read_bytes())
    assert len(binaries) == count
    for index, b in enumerate(binaries):
        base = root / f'{Path(p).name}-{index}'
        metallib = Path(str(base) + '.metallib')
        metallib.write_bytes(b)
        i = b.index(bytes.fromhex('dec0170b'))
        _, v, off, size, cpu = struct.unpack_from('<5I', b, i)
        assert v == 0 and off == 20 and (cpu == 4294967295)
        bitcode = b[i + off:i + off + size]
        bc = Path(str(base) + '.bc')
        bc.write_bytes(bitcode)
        ll = Path(str(base) + '.ll')
        proc = subprocess.run(['clang', '-S', '-emit-llvm', '-Xclang', '-disable-llvm-passes', str(bc), '-o', str(ll)], capture_output=True, text=True, check=True)
        selections = []
        for flags in itertools.product([False, True], repeat=len(defines)):
            selected = sorted((d for d, flag in zip(defines, flags) if flag))
            if lookup[xxh64_intdigest(''.join((k + '=' + v for k, v in selected)))] == index:
                selections.append(dict(selected))
        records.append(dict(table=p, index=index, defines=selections, metallib=dict(path=str(metallib), bytes=len(b), sha256=sha(b)), bitcode=dict(path=str(bc), bytes=len(bitcode), offset=i + off, sha256=sha(bitcode)), disassembly=dict(path=str(ll), sha256=sha(ll.read_bytes())), compilerStderr=proc.stderr))
pin_path.write_text(json.dumps(dict(scope='All four native particle distortion TOCs and all fifteen programs; static decoding only.', limits=['The original Metal and AIR bitcode hashes are canonical; clang retargets textual IR to the host with LLVM passes disabled.', 'No native Metal shader or game client was executed. CPU mode mapping, render-phase dispatch, sampler state and source-to-DistortionPower conversion remain unknown.'], disassemblyCommand=['clang', '-S', '-emit-llvm', '-Xclang', '-disable-llvm-passes', 'INPUT.bc', '-o', 'OUTPUT.ll'], provenance=a.provenance(), compiler=subprocess.check_output(['clang', '--version'], text=True), programs=records), indent=2) + '\n')
print('Extracted and statically disassembled', len(records), 'programs; none executed.')
