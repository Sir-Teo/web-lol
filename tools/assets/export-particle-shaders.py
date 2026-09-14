"""Pin particle shader metadata and selected Metal programs for offline inspection.

Run with PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python.
No shader is executed or shipped to the browser. Variant selection is exploratory,
not evidence of the flags selected by a particular native emitter.
"""
import argparse
import hashlib
import itertools
import json
import struct
from pathlib import Path

from xxhash import xxh64_intdigest
from riot_archive import RiotArchive

ROOT = Path('.cache/particle-shaders')
PIN = Path('docs/reference/particle-shaders.json')
PREFIX = 'assets/shaders/hlsl/particlesystem/'
TOCS = [PREFIX + name for name in (
    'mesh_ps.ps-metal', 'mesh_vs.vs-metal', 'quad_ps.ps-metal', 'quad_vs.vs-metal')]


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
    # Multiple define combinations can share one program (mesh VS does).
    assert count == 2 ** define_count
    assert set(ids) == set(range(bundled_count))
    assert len({k for k, _ in defines}) == define_count
    # Check every combination against the stored hashes, not just chosen samples.
    expected = set()
    for bits in itertools.product((False, True), repeat=define_count):
        selected = sorted(d for d, enabled in zip(defines, bits) if enabled)
        expected.add(xxh64_intdigest(''.join(f'{k}={v}' for k, v in selected)))
    assert expected == set(hashes)
    return defines, dict(zip(hashes, ids)), stage, bundled_count


def programs(data):
    offset, result = 0, []
    while offset < len(data):
        size, = struct.unpack_from('<I', data, offset)
        offset += 4
        program = data[offset:offset + size]
        assert size > 0 and len(program) == size and program[:4] == b'MTLB'
        result.append(program)
        offset += size
    assert offset == len(data) and 1 <= len(result) <= 100
    return result


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--extend-pin', action='store_true', help='Add samples while preserving every existing pinned source and selection')
args = parser.parse_args()
old = json.loads(PIN.read_text()) if PIN.exists() else None
# Shader caches have ordinary entries and no subchunk table. Include all possible
# bundle paths for these four TOCs; only required bundles are actually extracted.
paths = TOCS + [p + f'_{i}' for p in TOCS for i in range(0, 2100, 100)]
archive = RiotArchive({f'{xxh64_intdigest(p):016x}': p for p in paths},
                      old['extraction'] if old and not args.extend_pin else None,
                      archive_name='DATA/FINAL/ShaderCache.metal.wad.client')
archive.extract(TOCS, ROOT)
tables, selections, bundles = [], [], set()
for path in TOCS:
    defines, lookup, stage, bundled_count = decode_toc((ROOT / path).read_bytes())
    tables.append({'path': path, 'stage': stage, 'variantCount': len(lookup),
                   'uniqueProgramCount': bundled_count, 'defines': dict(defines)})
    requested = [[], ['DISABLE_FOW'], ['MULT_PASS']]
    if stage == 1:
        requested += [['PALETTIZE_TEXTURES'], ['PALETTIZE_TEXTURES', 'DISABLE_FOW'],
                      ['PALETTIZE_TEXTURES', 'MULT_PASS'],
                      ['ALPHA_EROSION'], ['ALPHA_EROSION', 'DISABLE_FOW'],
                      ['ALPHA_EROSION', 'MULT_PASS']]
    for names in requested:
        selected = sorted((k, v) for k, v in defines if k in names)
        assert len(selected) == len(names)
        formatted = ''.join(f'{k}={v}' for k, v in selected)
        value = xxh64_intdigest(formatted)
        shader_id = lookup[value]
        bundle = path + f'_{100 * (shader_id // 100)}'
        bundles.add(bundle)
        selections.append({'toc': path, 'defines': dict(selected),
                           'definesHash': f'{value:016x}', 'shaderId': shader_id,
                           'bundle': bundle, 'index': shader_id % 100})
archive.extract(sorted(bundles), ROOT)
decoded = {path: programs((ROOT / path).read_bytes()) for path in sorted(bundles)}
for entry in selections:
    program = decoded[entry['bundle']][entry['index']]
    name = Path(entry['toc']).name + f"-{entry['shaderId']}.metallib"
    (ROOT / name).write_bytes(program)
    entry.update(bytes=len(program), sha256=hashlib.sha256(program).hexdigest(),
                 output=str(ROOT / name))
report = {
    'scope': 'Compiled Metal particle shader inspection; native emitter variant and sampling formula unresolved',
    'reader': {'repository': 'https://github.com/LeagueToolkit/LeagueToolkit',
               'revision': '76bf57bf4fd195343dec610bf0f912a06b910914',
               'files': ['src/LeagueToolkit/Core/Renderer/ShaderToc.cs',
                         'src/LeagueToolkit/Core/Renderer/ShaderLoader.cs']},
    'tables': tables, 'selections': selections,
    'bundlePrograms': {p: len(v) for p, v in decoded.items()},
    'extraction': archive.provenance(),
}
if old and args.extend_pin:
    assert report['reader'] == old['reader'] and report['tables'] == old['tables']
    assert all(sample in report['selections'] for sample in old['selections'])
    for key in ('referenceVersion', 'manifest', 'archive'):
        assert report['extraction'][key] == old['extraction'][key]
    assert all(item in report['extraction']['files'] for item in old['extraction']['files'])
    assert all(report['extraction']['chunks'].get(k) == v for k, v in old['extraction']['chunks'].items())
    assert all(report['bundlePrograms'].get(k) == v for k, v in old['bundlePrograms'].items())
    PIN.write_text(json.dumps(report, indent=2) + '\n')
elif old:
    assert report == old, 'Shader metadata or selected programs changed'
else:
    PIN.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'tables': len(tables), 'verifiedVariantHashes': sum(t['variantCount'] for t in tables),
                  'bundles': len(bundles), 'inspectedPrograms': sum(map(len, decoded.values())),
                  'selectedPrograms': len(selections), 'repeatMatches': old == report}))
