"""Pinned Solar Flare WEM decoding with float headroom and complete authoring provenance."""
from pathlib import Path
import hashlib
import json
import math
import struct
import subprocess

REVISION = 'e6afeaacf433bfafd38d873f80c94517e09d5b96'
TOOL = Path('.tools/vgmstream/build/cli/vgmstream-cli')
assert subprocess.check_output(['git', '-C', '.tools/vgmstream', 'rev-parse', 'HEAD'], text=True).strip() == REVISION
sha = lambda b: hashlib.sha256(b).hexdigest()
def chunks(raw):
    assert raw[:4] == b'RIFF' and raw[8:12] == b'WAVE'
    assert struct.unpack_from('<I', raw, 4)[0] + 8 == len(raw)
    offset, result = 12, {}
    while offset < len(raw):
        tag, size = struct.unpack_from('<4sI', raw, offset); start = offset + 8
        assert start + size <= len(raw) and tag not in result
        result[tag] = raw[start:start + size]; offset = start + size + size % 2
    assert offset == len(raw)
    return result
def decode_source_audio(prefix):
    assert prefix == 'leona-r'
    source_path = Path(f'docs/reference/{prefix}-audio.json')
    source = json.loads(source_path.read_text())
    out = Path(f'.cache/{prefix}-audio-decoded-v2-20261024'); out.mkdir(exist_ok=True)
    results = []
    for media in source['media']:
        path = Path(f'.cache/{prefix}-audio-media-v1-20261024') / f"{media['id']}.wem"
        encoded = path.read_bytes()
        assert len(encoded) == media['bytes'] and sha(encoded) == media['sha256']
        metadata = json.loads(subprocess.check_output([str(TOOL), '-m', '-I', str(path)], text=True))
        dest = out / f"{media['id']}.wav"
        subprocess.run([str(TOOL), '-i', '-W', '4', '-o', str(dest), str(path)], check=True, stdout=subprocess.DEVNULL)
        raw = dest.read_bytes(); wav = chunks(raw)
        format_id, channels, rate, byte_rate, alignment, bits = struct.unpack_from('<HHIIHH', wav[b'fmt '])
        assert format_id == 3 and bits == 32
        assert channels == metadata['channels'] and rate == metadata['sampleRate']
        assert alignment == channels * 4 and byte_rate == rate * alignment
        assert len(wav[b'data']) == metadata['numberOfSamples'] * alignment
        samples = [x[0] for x in struct.iter_unpack('<f', wav[b'data'])]
        assert samples and all(math.isfinite(x) for x in samples)
        peak = max(abs(x) for x in samples); assert peak > 0
        results.append(dict(id=media['id'], encodedSha256=media['sha256'], wavSha256=sha(raw), pcmSha256=sha(wav[b'data']),
            wavBytes=len(raw), format='IEEE float32 little-endian WAV', channels=channels, sampleRate=rate,
            frames=metadata['numberOfSamples'], durationSeconds=metadata['numberOfSamples'] / rate, peak=peak,
            rms=math.sqrt(math.fsum(x*x for x in samples)/len(samples)), samplesOutsideUnitRange=sum(abs(x)>1 for x in samples),
            endpointDelta=[samples[-channels+c]-samples[c] for c in range(channels)], decoderMetadata=metadata))
    dependencies = []
    for name, revision in [('ogg', 'fa80aae9d50096160f2b56ada35527d7aee3f746'), ('vorbis', '2eac96b03ff67953354cb0a649c08aa3a23267ef')]:
        folder = Path('.tools/vgmstream/build/dependencies') / name
        source_folder = Path('.tools/vgmstream/dependencies/ogg') if name == 'ogg' else Path('.tools/vorbis')
        assert subprocess.check_output(['git', '-C', str(source_folder), 'rev-parse', 'HEAD'], text=True).strip() == revision
        libraries = [dict(path=str(p.relative_to(folder)), sha256=sha(p.read_bytes())) for p in sorted(folder.rglob('*.a'))]
        assert libraries, f'Missing static codec libraries: {name}'
        dependencies.append(dict(name=name, revision=revision, libraries=libraries))
    result = dict(sourceGraphSha256=sha(source_path.read_bytes()),
        decoder=dict(repository='https://github.com/vgmstream/vgmstream', revision=REVISION,
            binarySha256=sha(TOOL.read_bytes()), staticDependencies=dependencies, flags=['-i', '-W', '4'],
            compiler=subprocess.check_output(['cc', '--version'], text=True).splitlines()[0]), media=results,
        status='Decoded source masters without gain, normalization, resampling, loop expansion or fades. Native mix/listening comparison remains unverified.')
    Path(f'docs/reference/{prefix}-audio-decoded.json').write_text(json.dumps(result, indent=2) + '\n')
    return result

if __name__ == '__main__':
    result = decode_source_audio('leona-r')
    print(json.dumps([dict(id=m['id'], frames=m['frames'], seconds=m['durationSeconds'], peak=m['peak'], loop=m['decoderMetadata']['loopingInfo']) for m in result['media']]))
