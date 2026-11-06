"""Decode eight candidate basic-attack masters with pinned tools and no gain baking."""
import argparse
import json
import math
from pathlib import Path
import struct
import subprocess
import tempfile
from riot_archive import sha

READING = Path('docs/reference/baron-audio-candidate-reading.json')
READING_SHA = 'a6e058c208a15a0c0b11f22781dc077d2b4ed5bf4204a5130f1b07ed85838afe'
GRAPH = Path('docs/reference/baron-audio-graph.json')
GRAPH_SHA = 'eec1c9d1ca816d6c2aeae41ac3190abce2af09034f770de822ec40ab907870b1'
TOOL = Path('.tools/vgmstream/build/cli/vgmstream-cli')


def require(ok, message):
    if not ok:
        raise ValueError(message)


def wave_chunks(raw):
    require(raw[:4] == b'RIFF' and raw[8:12] == b'WAVE' and struct.unpack_from('<I', raw, 4)[0] + 8 == len(raw), 'Invalid float WAV container')
    result, cursor = {}, 12
    while cursor < len(raw):
        require(cursor + 8 <= len(raw), 'Truncated WAV chunk')
        tag, size = struct.unpack_from('<4sI', raw, cursor)
        start = cursor + 8
        require(tag not in result and start + size <= len(raw), 'Duplicate/outside WAV chunk')
        result[tag] = raw[start:start + size]
        cursor = start + size + size % 2
    require(cursor == len(raw), 'WAV tail differs')
    return result


def decoder():
    sources = [('.tools/vgmstream', 'e6afeaacf433bfafd38d873f80c94517e09d5b96'),
               ('.tools/vgmstream/dependencies/ogg', 'fa80aae9d50096160f2b56ada35527d7aee3f746'),
               ('.tools/vorbis', '2eac96b03ff67953354cb0a649c08aa3a23267ef')]
    for folder, revision in sources:
        require(subprocess.check_output(['git', '-C', folder, 'rev-parse', 'HEAD'], text=True).strip() == revision,
                'Decoder source revision differs: ' + folder)
        require(subprocess.run(['git', '-C', folder, 'diff', '--quiet']).returncode == 0,
                'Decoder tracked source changed: ' + folder)
    dependencies = []
    for name in ['ogg', 'vorbis']:
        folder = Path('.tools/vgmstream/build/dependencies') / name
        libraries = [dict(path=str(p.relative_to(folder)), sha256=sha(p.read_bytes())) for p in sorted(folder.rglob('*.a'))]
        require(libraries, 'Missing static codec libraries: ' + name)
        dependencies.append(dict(name=name, libraries=libraries))
    return dict(sources=[dict(path=p, revision=r) for p, r in sources], binarySha256=sha(TOOL.read_bytes()),
                staticDependencies=dependencies, flags=['-i', '-W', '4'],
                compiler=subprocess.check_output(['cc', '--version'], text=True).splitlines()[0])


def build():
    require(sha(READING.read_bytes()) == READING_SHA and sha(GRAPH.read_bytes()) == GRAPH_SHA,
            'Pinned candidate reading/graph differs')
    reading, graph = json.loads(READING.read_bytes()), json.loads(GRAPH.read_bytes())
    selected = sorted({identity for role in reading['roles'].values() for identity in role['media']})
    require(len(selected) == 8, 'Candidate media closure differs')
    source = {row['id']: row for row in graph['media']}
    tool = decoder()
    media, outputs = [], {}
    with tempfile.TemporaryDirectory(prefix='baron-pcm-') as temporary:
        for identity in selected:
            row = source[identity]
            path = Path('.cache/baron-audio-media-v1') / row['path']
            encoded = path.read_bytes()
            require(len(encoded) == row['bytes'] and sha(encoded) == row['sha256'], 'Encoded candidate media differs')
            metadata = json.loads(subprocess.check_output([str(TOOL), '-m', '-I', str(path)], text=True))
            target = Path(temporary) / (str(identity) + '.wav')
            subprocess.run([str(TOOL), '-i', '-W', '4', '-o', str(target), str(path)], check=True, stdout=subprocess.DEVNULL)
            raw = target.read_bytes()
            chunks = wave_chunks(raw)
            require(b'fmt ' in chunks and b'data' in chunks, 'Missing float WAV fields')
            codec, channels, rate, byte_rate, alignment, bits = struct.unpack_from('<HHIIHH', chunks[b'fmt '])
            require(codec == 3 and bits == 32 and channels == metadata['channels'] and rate == metadata['sampleRate'] and
                    alignment == channels * 4 and byte_rate == rate * alignment and
                    len(chunks[b'data']) == metadata['numberOfSamples'] * alignment,
                    'Decoded extent/channel/rate differs')
            require(metadata['mixingInfo']['inputChannels'] == metadata['mixingInfo']['outputChannels'] == channels,
                    'Unexpected decoder channel mixing')
            samples = [x[0] for x in struct.iter_unpack('<f', chunks[b'data'])]
            require(samples and all(math.isfinite(v) for v in samples), 'Empty/nonfinite decoded media')
            peak = max(abs(v) for v in samples)
            require(peak > 0, 'Unexpected silent candidate master')
            outputs[str(identity) + '.wav'] = raw
            media.append(dict(id=identity, encodedSha256=row['sha256'], wavSha256=sha(raw), pcmSha256=sha(chunks[b'data']),
                              wavBytes=len(raw), format='IEEE float32 little-endian WAV', channels=channels, sampleRate=rate,
                              frames=metadata['numberOfSamples'], durationSeconds=metadata['numberOfSamples'] / rate,
                              peak=peak, rms=math.sqrt(math.fsum(v * v for v in samples) / len(samples)),
                              samplesOutsideUnitRange=sum(abs(v) > 1 for v in samples), decoderMetadata=metadata))
    return dict(format=1, candidateReadingSha256=READING_SHA, sourceGraphSha256=GRAPH_SHA,
                helperSha256=sha(Path(__file__).read_bytes()), decoder=tool, media=media,
                limits=['Candidate-label media only; no gameplay event timing or native dispatch selected.',
                        'No authored gain, normalization, resampling, downmix, fade or loop expansion baked into masters.',
                        'Native global routing/mix and listening comparison remain unverified.']), outputs


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--discover', action='store_true')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--record', type=Path, default=Path('docs/reference/baron-basic-audio-decoded.json'))
    parser.add_argument('--output-dir', type=Path, default=Path('.cache/baron-basic-audio-decoded-v1'))
    args = parser.parse_args()
    require(not (args.discover and args.check), 'Discovery/check are exclusive')
    require(args.record.exists() or args.discover, 'Initial decode needs --discover')
    require(not args.discover or (not args.record.exists() and not args.output_dir.exists()), 'Decode discovery needs fresh paths')
    record, outputs = build()
    raw = (json.dumps(record, indent=2) + '\n').encode()
    require(not args.record.exists() or args.record.read_bytes() == raw, 'Frozen decoded reading differs')
    for name, data in outputs.items():
        path = args.output_dir / name
        require(not path.is_symlink(), 'Decoded master cannot be a symlink')
        require(not path.exists() or path.read_bytes() == data, 'Frozen decoded master differs: ' + name)
        require(not args.check or path.exists(), 'Missing decoded master: ' + name)
    if not args.check:
        args.output_dir.mkdir(parents=True, exist_ok=True)
        for name, data in outputs.items():
            path = args.output_dir / name
            if not path.exists():
                with path.open('xb') as stream:
                    stream.write(data)
        if not args.record.exists():
            with args.record.open('xb') as stream:
                stream.write(raw)
    print(json.dumps(dict(status='passed', media=len(record['media']), bytes=sum(r['wavBytes'] for r in record['media']),
                          rates=sorted({r['sampleRate'] for r in record['media']}), channels=sorted({r['channels'] for r in record['media']}),
                          peak=max(r['peak'] for r in record['media']), runtimePlayback=False)))
