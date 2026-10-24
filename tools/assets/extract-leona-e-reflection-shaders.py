"""Pin four ordinary-mesh reflection permutations; no native target/shader executes.

Run with PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python.
--check reads retained pins/cache only: no network, compiler or RiotArchive import.
Native sword2 dispatch, CPU uniform/resource bindings and normals are unresolved.
"""
import argparse
import ast
import hashlib
import itertools
import json
from pathlib import Path
import struct
import subprocess

ROOT = Path('.cache/leona-e-reflection-shaders-v1-20261024')
PIN = Path('docs/reference/leona-e-reflection-shaders.json')
READER = Path('tools/assets/export-particle-shaders.py')
SOURCE_PIN = Path('docs/reference/particle-shaders.json')
PREFIX = 'assets/shaders/hlsl/particlesystem/'
REQUESTS = {'mesh_vs.vs-metal': [([], 98), (['DISABLE_FOW'], 33)],
            'mesh_ps.ps-metal': [([], 790), (['DISABLE_FOW'], 54)]}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def retained_check():
    pin = json.loads(PIN.read_text())
    assert sha(READER.read_bytes()) == pin['tocReaderSha256']
    assert sha(SOURCE_PIN.read_bytes()) == pin['sourcePinSha256']
    for selection in pin['selections']:
        for kind in ['metallib', 'bitcode', 'disassembly']:
            item = selection[kind]
            raw = Path(item['path']).read_bytes()
            assert len(raw) == item['bytes'] and sha(raw) == item['sha256'], item['path']
        bundle = (ROOT / 'native' / selection['bundle']).read_bytes()
        raw = Path(selection['metallib']['path']).read_bytes()
        start = selection['bundleProgramOffset']
        assert struct.unpack_from('<I', bundle, start - 4)[0] == len(raw)
        assert bundle[start:start + len(raw)] == raw
        item = selection['bitcode']
        assert raw[item['offset']:item['offset'] + item['bytes']] == Path(item['path']).read_bytes()
    for item in pin['extraction']['files']:
        raw = (ROOT / 'native' / item['path']).read_bytes()
        assert len(raw) == item['bytes'] and sha(raw) == item['sha256'], item['path']
    print(json.dumps(dict(result='passed', programs=len(pin['selections']),
                          networkUsed=False, compilerUsed=False, nativeExecuted=False)))


def extract():
    from xxhash import xxh64_intdigest
    from riot_archive import RiotArchive
    namespace = dict(globals(), xxh64_intdigest=xxh64_intdigest)
    tree = ast.parse(READER.read_text())
    for name in ['decode_toc', 'programs']:
        definition = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == name)
        exec(compile(ast.Module(body=[definition], type_ignores=[]), str(READER), 'exec'), namespace)
    decode_toc, programs = namespace['decode_toc'], namespace['programs']
    source = json.loads(SOURCE_PIN.read_text())
    ROOT.mkdir()  # Never overwrite an existing extraction.
    paths = [PREFIX + name for name in REQUESTS]
    bundles = [PREFIX + 'mesh_vs.vs-metal_0', PREFIX + 'mesh_ps.ps-metal_0',
               PREFIX + 'mesh_ps.ps-metal_700']
    archive = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in paths + bundles},
                          source['extraction'], archive_name=source['extraction']['archive'])
    archive.extract(paths + bundles, ROOT / 'native')
    selections, tables = [], []
    for name, variants in REQUESTS.items():
        path = PREFIX + name
        defines, lookup, stage, count = decode_toc((ROOT / 'native' / path).read_bytes())
        tables.append(dict(path=path, stage=stage, defines=dict(defines),
                           variantCount=len(lookup), uniqueProgramCount=count))
        for extra, expected in variants:
            flags = ['REFLECTIVE'] + extra
            selected = sorted((k, v) for k, v in defines if k in flags)
            assert len(selected) == len(flags)
            key = xxh64_intdigest(''.join(f'{k}={v}' for k, v in selected))
            program_id = lookup[key]
            assert program_id == expected
            bundle = path + '_' + str(program_id // 100 * 100)
            parsed = programs((ROOT / 'native' / bundle).read_bytes())
            index = program_id % 100
            raw = parsed[index]
            start = sum(4 + len(p) for p in parsed[:index]) + 4
            marker = bytes.fromhex('dec0170b')
            i = raw.index(marker)
            assert raw.find(marker, i + 1) == -1
            _, version, offset, size, cpu = struct.unpack_from('<5I', raw, i)
            assert version == 0 and offset == 20 and cpu == 4294967295
            bitcode = raw[i + offset:i + offset + size]
            assert len(bitcode) == size and bitcode[:4] == b'BC\xc0\xde'
            stem = ROOT / (name + '-' + str(program_id))
            metal, bc, ll = (Path(str(stem) + suffix) for suffix in ['.metallib', '.bc', '.ll'])
            metal.write_bytes(raw)
            bc.write_bytes(bitcode)
            proc = subprocess.run(['clang', '-S', '-emit-llvm', '-Xclang', '-disable-llvm-passes',
                                   str(bc), '-o', str(ll)], capture_output=True, text=True, check=True)
            assert '@wrapped_main' in ll.read_text()
            def record(file):
                data = file.read_bytes()
                return dict(path=str(file), bytes=len(data), sha256=sha(data))
            selections.append(dict(table=path, defines=dict(selected), definesHash=f'{key:016x}',
                                   programId=program_id, bundle=bundle, index=index,
                                   bundleProgramOffset=start, metallib=record(metal),
                                   bitcode=dict(record(bc), offset=i + offset),
                                   disassembly=record(ll), compilerStderr=proc.stderr))
    result = dict(scope='Four static ordinary-mesh reflective Metal/AIR permutations; no native target or shader executed.',
                  limits=['Selection does not establish native sword2 CPU dispatch or actual uniform/resource/sampler bindings.',
                          'Native SCB normal generation remains unresolved; no fallback normal or rendering parity is claimed.',
                          'Clang retargets textual IR to the host with LLVM passes disabled; original Metal/AIR bytes are preserved.'],
                  tocReader=str(READER), tocReaderSha256=sha(READER.read_bytes()),
                  sourcePin=str(SOURCE_PIN), sourcePinSha256=sha(SOURCE_PIN.read_bytes()),
                  tables=tables, selections=selections, extraction=archive.provenance(),
                  compiler=subprocess.check_output(['clang', '--version'], text=True),
                  disassemblyCommand=['clang', '-S', '-emit-llvm', '-Xclang', '-disable-llvm-passes', 'INPUT.bc', '-o', 'OUTPUT.ll'],
                  nativeExecuted=False, nativeRenderingVerified=False)
    PIN.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(dict(result='passed', programs=len(selections), sourceFiles=len(archive.outputs), nativeExecuted=False)))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    retained_check() if args.check else extract()
