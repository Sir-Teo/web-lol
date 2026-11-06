"""Strict float-master decoding shared by new, explicitly pinned audio corpora."""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct
import subprocess
import tempfile


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def require(ok, message):
    if not ok:
        raise ValueError(message)


def inspect_float_wave(raw, metadata):
    require(len(raw) >= 12 and raw[:4] == b'RIFF' and raw[8:12] == b'WAVE' and
            struct.unpack_from('<I', raw, 4)[0] + 8 == len(raw), 'Invalid float WAV extent')
    chunks, cursor = {}, 12
    while cursor < len(raw):
        require(cursor + 8 <= len(raw), 'Truncated WAV chunk')
        tag, size = struct.unpack_from('<4sI', raw, cursor)
        start = cursor + 8
        require(tag not in chunks and start + size <= len(raw), 'Duplicate/outside WAV chunk')
        chunks[tag] = raw[start:start + size]
        cursor = start + size + size % 2
    require(cursor == len(raw), 'Invalid WAV tail')
    require(b'fmt ' in chunks and len(chunks[b'fmt ']) >= 16 and b'data' in chunks, 'Missing WAV fields')
    codec, channels, rate, byte_rate, alignment, bits = struct.unpack_from('<HHIIHH', chunks[b'fmt '])
    frames = metadata['numberOfSamples']
    require(isinstance(frames, int) and frames > 0 and codec == 3 and bits == 32 and channels > 0 and rate > 0 and
            channels == metadata['channels'] and rate == metadata['sampleRate'] and
            alignment == channels * 4 and byte_rate == rate * alignment and
            len(chunks[b'data']) == frames * alignment, 'Decoded WAV format/frame layout differs')
    require(metadata['mixingInfo']['inputChannels'] == metadata['mixingInfo']['outputChannels'] == channels,
            'Unexpected decoder mixing')
    samples = [value[0] for value in struct.iter_unpack('<f', chunks[b'data'])]
    require(all(math.isfinite(value) for value in samples), 'Nonfinite decoded samples')
    return dict(format='IEEE float32 little-endian WAV', wavSha256=sha(raw), pcmSha256=sha(chunks[b'data']),
                wavBytes=len(raw), frames=frames, sampleRate=rate, channels=channels,
                durationSeconds=frames / rate, peak=max(abs(value) for value in samples),
                rms=math.sqrt(math.fsum(value * value for value in samples) / len(samples)),
                samplesOutsideUnitRange=sum(abs(value) > 1 for value in samples))


def decode(specification, producer):
    graph_path = Path(specification['graph'])
    reference_path = Path(specification['decoderReference'])
    helper_path = Path(specification['decoderHelper'])
    for path, key in [(graph_path, 'graphSha256'), (reference_path, 'decoderReferenceSha256'),
                      (helper_path, 'decoderHelperSha256')]:
        require(sha(path.read_bytes()) == specification[key], 'Frozen corpus input differs: ' + str(path))
    module_spec = importlib.util.spec_from_file_location('pinned_audio_decoder', helper_path)
    helper = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(helper)
    tool = helper.decoder()
    require(tool == json.loads(reference_path.read_bytes())['decoder'], 'Pinned decoder/toolchain differs')
    source = json.loads(graph_path.read_bytes())['media']
    require(len(source) == len({row['id'] for row in source}) == specification['mediaCount'], 'Corpus closure differs')
    rows, outputs = [], {}
    with tempfile.TemporaryDirectory(prefix='source-float-masters-') as temporary:
        for row in source:
            require(row['path'] == str(row['id']) + '.wem', 'Unexpected numeric media path')
            path = Path(specification['encodedDirectory']) / row['path']
            encoded = path.read_bytes()
            require(len(encoded) == row['bytes'] and sha(encoded) == row['sha256'], 'Encoded corpus media differs')
            metadata = json.loads(subprocess.check_output([str(helper.TOOL), '-m', '-I', str(path)], text=True))
            target = Path(temporary) / (str(row['id']) + '.wav')
            subprocess.run([str(helper.TOOL), '-i', '-W', '4', '-o', str(target), str(path)],
                           check=True, stdout=subprocess.DEVNULL)
            raw = target.read_bytes()
            rows.append(dict(id=row['id'], encodedSha256=row['sha256'], **inspect_float_wave(raw, metadata),
                             decoderMetadata=metadata))
            outputs[str(row['id']) + '.wav'] = raw
    record = dict(format=1, sourceGraphSha256=specification['graphSha256'],
                  decoderReferenceSha256=specification['decoderReferenceSha256'],
                  decoderHelperSha256=specification['decoderHelperSha256'], sharedCoreSha256=sha(Path(__file__).read_bytes()),
                  producerSha256=sha(Path(producer).read_bytes()), decoder=tool, media=rows,
                  limits=['Numeric embedded media masters, not event dispatch or gameplay semantics.',
                          'Source headroom/rate/channels retained; no gain, normalization, fade, resampling or downmix baked in.',
                          'Base spans decoded without loop expansion; source decoder loop metadata stays explicit.',
                          'Private corpus only; no runtime assets, native timing/mix or listening parity inferred.'])
    return record, outputs


def main(specification, producer):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--discover', action='store_true')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--record', type=Path, default=Path(specification['record']))
    parser.add_argument('--output-dir', type=Path, default=Path(specification['outputDirectory']))
    args = parser.parse_args()
    require(not (args.discover and args.check), 'Discovery/check are exclusive')
    require(not args.record.is_symlink() and not args.output_dir.is_symlink(), 'Corpus destinations cannot be symlinks')
    require(args.record.exists() or args.discover, 'Initial corpus needs --discover')
    require(not args.discover or (not args.record.exists() and not args.output_dir.exists()), 'Discovery needs fresh paths')
    record, outputs = decode(specification, producer)
    raw = (json.dumps(record, indent=2) + '\n').encode()
    require(not args.record.exists() or args.record.read_bytes() == raw, 'Frozen decoded corpus differs')
    for name, data in outputs.items():
        path = args.output_dir / name
        require(not path.is_symlink(), 'Corpus master cannot be a symlink')
        require(not path.exists() or path.read_bytes() == data, 'Frozen corpus master differs: ' + name)
        require(not args.check or path.exists(), 'Missing corpus master: ' + name)
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
    print(json.dumps(dict(status='passed', media=len(record['media']), bytes=sum(row['wavBytes'] for row in record['media']),
                          rates=sorted({row['sampleRate'] for row in record['media']}),
                          channels=sorted({row['channels'] for row in record['media']}),
                          peak=max(row['peak'] for row in record['media']),
                          looping=sum(row['decoderMetadata']['loopingInfo'] is not None for row in record['media']),
                          runtimeChanged=False)))
