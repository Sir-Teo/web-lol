#!/usr/bin/env python3
"""Restore frozen Garen/Metal evidence into ignored caches without changing pins."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import struct
import subprocess
import sys
import tempfile
from xxhash import xxh64_intdigest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / '.tools/cdtb'))
from riot_archive import RiotArchive


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def require(ok, message):
    if not ok:
        raise ValueError(message)


def read_json(path):
    return json.loads((ROOT / path).read_text())


def validate(raw, pin, path):
    require(len(raw) == pin['bytes'] and sha(raw) == pin['sha256'], 'Frozen bytes differ: ' + str(path))


def store(path, raw, pin):
    validate(raw, pin, path)
    destination = ROOT / path
    created = not destination.exists()
    if created:
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open('xb') as stream:
            stream.write(raw)
    else:
        require(destination.read_bytes() == raw, 'Existing cache differs; preserve it before recovery: ' + str(path))
    return dict(path=str(path), bytes=len(raw), sha256=sha(raw), created=created)


def extract(pin, output, flat=False, toc=None):
    targets = []
    for entry in pin['files']:
        name = entry['wadPathHash'] + Path(entry['path']).suffix if flat else entry['path']
        path = Path(output) / name
        if (ROOT / path).exists():
            validate((ROOT / path).read_bytes(), entry, path)
        targets.append((path, entry, not (ROOT / path).exists()))
    paths = {entry['wadPathHash']: entry['path'] for entry in pin['files']}
    if toc:
        paths[f'{xxh64_intdigest(toc):016x}'] = toc
    archive = RiotArchive(paths, pin,
                          archive_name=pin['archive'])
    archive.extract([entry['path'] for entry in pin['files']], output, flat=flat)
    require(archive.provenance() == pin, 'Frozen extraction provenance differs')
    result = []
    for path, entry, created in targets:
        validate((ROOT / path).read_bytes(), entry, path)
        result.append(dict(path=str(path), bytes=entry['bytes'], sha256=entry['sha256'], created=created))
    return result


def garen():
    extraction_path = 'docs/reference/garen-audio-extraction.json'
    extraction = read_json(extraction_path)
    toc = 'data/final/champions/garen.wad.subchunktoc'
    files = extract(extraction, '.cache/garen-audio-sources', toc=toc)
    audio = next(row for row in extraction['files'] if row['path'].endswith('_audio.bnk'))
    bank = (ROOT / '.cache/garen-audio-sources' / audio['path']).read_bytes()
    chunks, offset = {}, 0
    while offset < len(bank):
        tag, size = struct.unpack_from('<4sI', bank, offset)
        start = offset + 8
        require(tag not in chunks and start + size <= len(bank), 'Invalid bank chunk')
        chunks[tag] = (start, size)
        offset = start + size
    require(offset == len(bank), 'Incomplete bank')
    start, size = chunks[b'DIDX']
    require(size % 12 == 0, 'Invalid media index')
    entries = {identity: (offset, size) for identity, offset, size in
               struct.iter_unpack('<III', bank[start:start + size])}
    require(len(entries) == size // 12, 'Duplicate media ID')
    for ability, count in [('aa', 34), ('p', 2)]:
        graph_path = f'docs/reference/garen-{ability}-audio.json'
        graph = read_json(graph_path)
        decoded = read_json(f'docs/reference/garen-{ability}-audio-decoded.json')
        require(graph['extractionSha256'] == sha((ROOT / extraction_path).read_bytes()) and
                decoded['sourceGraphSha256'] == sha((ROOT / graph_path).read_bytes()) and
                len(graph['media']) == count, 'Audio reference differs')
        for media in graph['media']:
            relative, size = entries[media['id']]
            start, length = chunks[b'DATA']
            require(relative + size <= length and start + relative == media['bankOffset'] and
                    size == media['bytes'], 'Media index differs')
            raw = bank[start + relative:start + relative + size]
            require(raw[:4] == b'RIFF' and raw[8:12] == b'WAVE' and
                    struct.unpack_from('<I', raw, 4)[0] + 8 == size, 'Invalid encoded WAVE')
            require(media['sha256'] == next(row['encodedSha256'] for row in decoded['media']
                    if row['id'] == media['id']), 'Encoded media pin differs')
            files.append(store(Path(f'.cache/garen-{ability}-audio-media/{media["id"]}.wem'), raw, media))
    files.extend(extract(read_json('docs/reference/garen-passive-particles.json')['extraction'],
                         '.cache/garen-passive-particle-sources', flat=True, toc=toc))
    return dict(profile='garen', encodedMedia=36, files=files)


def distortion(compiler, library_path):
    pin = read_json('docs/reference/particle-distortion-shaders.json')
    files = extract(pin['provenance'], '.cache/particle-distortion-shaders/native')
    blobs = {}
    for table in {row['table'] for row in pin['programs']}:
        raw = (ROOT / '.cache/particle-distortion-shaders/native' / (table + '_0')).read_bytes()
        parts, offset = [], 0
        while offset < len(raw):
            size, = struct.unpack_from('<I', raw, offset)
            offset += 4
            part = raw[offset:offset + size]
            require(size > 0 and len(part) == size and part[:4] == b'MTLB', 'Invalid Metal library')
            parts.append(part)
            offset += size
        require(offset == len(raw), 'Incomplete library bundle')
        blobs[table] = parts
    targets = {re.search(r'module target triple with (\S+) \[', row['compilerStderr']).group(1)
               for row in pin['programs']}
    require(len(targets) == 1, 'Ambiguous original compiler target')
    target = next(iter(targets))
    env = dict(os.environ)
    if library_path:
        env['LD_LIBRARY_PATH'] = library_path
    version = subprocess.check_output([compiler, '--version'], env=env, text=True) if compiler else None
    with tempfile.TemporaryDirectory(prefix='frozen-distortion-') as temporary:
        for row in pin['programs']:
            raw = blobs[row['table']][row['index']]
            files.append(store(Path(row['metallib']['path']), raw, row['metallib']))
            marker = raw.index(bytes.fromhex('dec0170b'))
            _, version_word, offset, size, cpu = struct.unpack_from('<5I', raw, marker)
            require(version_word == 0 and offset == 20 and cpu == 0xffffffff and
                    marker + offset == row['bitcode']['offset'] and size == row['bitcode']['bytes'],
                    'Bitcode wrapper differs')
            files.append(store(Path(row['bitcode']['path']), raw[marker + offset:marker + offset + size], row['bitcode']))
            if compiler:
                candidate = Path(temporary) / Path(row['disassembly']['path']).name
                proc = subprocess.run([compiler, '--target=' + target, '-S', '-emit-llvm', '-Xclang',
                                       '-disable-llvm-passes', row['bitcode']['path'], '-o', str(candidate)],
                                      env=env, capture_output=True, text=True)
                require(proc.returncode == 0, 'Static disassembly failed: ' + proc.stderr[-2000:])
                text = candidate.read_bytes()
            else:
                text = (ROOT / row['disassembly']['path']).read_bytes()
            text_pin = dict(bytes=len(text), sha256=row['disassembly']['sha256'])
            files.append(store(Path(row['disassembly']['path']), text, text_pin))
    return dict(profile='distortion', libraries=len(pin['programs']), compiler=version,
                target=target, nativeExecution=False, files=files)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--garen', action='store_true')
    parser.add_argument('--distortion', action='store_true')
    parser.add_argument('--clang', help='Compiler capable of reproducing the original IR hashes')
    parser.add_argument('--clang-library-path', help='Optional shared-library path for an isolated compiler')
    parser.add_argument('--report', type=Path, required=True, help='Fresh audit output path')
    args = parser.parse_args()
    if not (args.garen or args.distortion):
        parser.error('Choose --garen and/or --distortion')
    report_path = args.report.resolve()
    if report_path.exists():
        parser.error('Report already exists; preserve prior evidence and choose a fresh output')
    os.chdir(ROOT)
    report = dict(status='failed', groups=[], scope='Exact ignored-cache restoration; pins, application and public assets stay unchanged. Static shader decoding only.')
    try:
        if args.garen:
            report['groups'].append(garen())
        if args.distortion:
            report['groups'].append(distortion(args.clang, args.clang_library_path))
        report['status'] = 'passed'
    except Exception as error:
        report['error'] = str(error)
        raise
    finally:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        with report_path.open('x') as stream:
            json.dump(report, stream, indent=2)
            stream.write('\n')
        print(json.dumps(dict(status=report['status'], report=str(report_path),
                              profiles=[group['profile'] for group in report['groups']])))


if __name__ == '__main__':
    main()
