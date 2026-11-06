"""Decode the complete embedded bank to private, unmodified float masters."""
import argparse
import importlib.util
import json
import math
from pathlib import Path
import struct
import subprocess
import tempfile
from riot_archive import sha

GRAPH = Path('docs/reference/baron-audio-graph.json')
GRAPH_SHA = 'eec1c9d1ca816d6c2aeae41ac3190abce2af09034f770de822ec40ab907870b1'
BASIC = Path('docs/reference/baron-basic-audio-decoded.json')
BASIC_SHA = 'ce3dbe0278046a10a2899e41416f260e62fe96a98e1356e809f20879b137d908'
HELPER = Path('tools/assets/decode-baron-basic-audio.py')
HELPER_SHA = '5cbd26831b27bf5be77ac210470145f67ca8dc73f839fa3eabdb79884341933d'


def require(ok, message):
    if not ok:
        raise ValueError(message)


def build():
    require(sha(GRAPH.read_bytes()) == GRAPH_SHA and sha(BASIC.read_bytes()) == BASIC_SHA and
            sha(HELPER.read_bytes()) == HELPER_SHA, 'Frozen corpus inputs/helper differ')
    spec = importlib.util.spec_from_file_location('baron_float_decoder', HELPER)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    tool = helper.decoder()
    basic_record = json.loads(BASIC.read_bytes())
    require(tool == basic_record['decoder'], 'Pinned basic decoder/toolchain differs')
    basic = {row['id']: row for row in basic_record['media']}
    source = json.loads(GRAPH.read_bytes())['media']
    require(len(source) == 82 and len({row['id'] for row in source}) == 82, 'Embedded media closure differs')
    rows, outputs = [], {}
    with tempfile.TemporaryDirectory(prefix='baron-corpus-pcm-') as temporary:
        for row in source:
            path = Path('.cache/baron-audio-media-v1') / row['path']
            encoded = path.read_bytes()
            require(len(encoded) == row['bytes'] and sha(encoded) == row['sha256'], 'Encoded corpus media differs')
            metadata = json.loads(subprocess.check_output([str(helper.TOOL), '-m', '-I', str(path)], text=True))
            target = Path(temporary) / f"{row['id']}.wav"
            subprocess.run([str(helper.TOOL), '-i', '-W', '4', '-o', str(target), str(path)],
                           check=True, stdout=subprocess.DEVNULL)
            raw = target.read_bytes()
            chunks = helper.wave_chunks(raw)
            require(b'fmt ' in chunks and b'data' in chunks, 'Missing WAV fields')
            codec, channels, rate, byte_rate, alignment, bits = struct.unpack_from('<HHIIHH', chunks[b'fmt '])
            require(codec == 3 and bits == 32 and channels == metadata['channels'] and rate == metadata['sampleRate'] and
                    alignment == channels * 4 and byte_rate == rate * alignment and
                    len(chunks[b'data']) == metadata['numberOfSamples'] * alignment, 'Decoded corpus extent differs')
            require(metadata['mixingInfo']['inputChannels'] == metadata['mixingInfo']['outputChannels'] == channels,
                    'Unexpected decoder mixing')
            samples = [value[0] for value in struct.iter_unpack('<f', chunks[b'data'])]
            require(samples and all(math.isfinite(v) for v in samples), 'Empty/nonfinite corpus master')
            peak = max(abs(v) for v in samples)
            decoded = dict(id=row['id'], encodedSha256=row['sha256'], wavSha256=sha(raw), pcmSha256=sha(chunks[b'data']),
                           wavBytes=len(raw), frames=metadata['numberOfSamples'], sampleRate=rate, channels=channels,
                           durationSeconds=metadata['numberOfSamples'] / rate, peak=peak,
                           rms=math.sqrt(math.fsum(v * v for v in samples) / len(samples)),
                           samplesOutsideUnitRange=sum(abs(v) > 1 for v in samples), decoderMetadata=metadata)
            if row['id'] in basic:
                for key in ['encodedSha256', 'wavSha256', 'pcmSha256', 'wavBytes', 'frames', 'sampleRate', 'channels',
                            'durationSeconds', 'peak', 'rms', 'samplesOutsideUnitRange', 'decoderMetadata']:
                    require(decoded[key] == basic[row['id']][key], 'Frozen basic master differs in corpus: ' + key)
            rows.append(decoded)
            outputs[f"{row['id']}.wav"] = raw
    return dict(format=1, numericGraphSha256=GRAPH_SHA, basicMastersSha256=BASIC_SHA,
                decoderHelperSha256=HELPER_SHA, helperSha256=sha(Path(__file__).read_bytes()),
                decoder=tool, media=rows,
                limits=['Complete embedded numeric media closure, not semantic event attribution.',
                        'Float32 masters retain source headroom/rate/channels; no gain, fades, resampling or downmix baked in.',
                        'Base sample spans decoded without loop expansion; original looping metadata remains explicit.',
                        'No additional public assets, gameplay binding or native mix/dispatch certification.']), outputs


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--discover', action='store_true')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--record', type=Path, default=Path('docs/reference/baron-audio-corpus-decoded.json'))
    parser.add_argument('--output-dir', type=Path, default=Path('.cache/baron-audio-decoded-v1'))
    args = parser.parse_args()
    require(not (args.discover and args.check), 'Discovery/check are exclusive')
    require(args.record.exists() or args.discover, 'Initial corpus decode needs discovery')
    require(not args.discover or (not args.record.exists() and not args.output_dir.exists()), 'Discovery needs fresh paths')
    record, outputs = build()
    raw = (json.dumps(record, indent=2) + '\n').encode()
    require(not args.record.exists() or args.record.read_bytes() == raw, 'Frozen corpus reading differs')
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
