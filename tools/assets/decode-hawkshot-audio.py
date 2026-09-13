"""Decode pinned Hawkshot WEMs to unnormalized float WAV source masters."""
from pathlib import Path
import hashlib
import json
import math
import struct
import subprocess

REVISION = 'e6afeaacf433bfafd38d873f80c94517e09d5b96'
TOOL = Path('.tools/vgmstream/build/cli/vgmstream-cli')
assert subprocess.check_output(['git', '-C', '.tools/vgmstream', 'rev-parse', 'HEAD'], text=True).strip() == REVISION


def sha(data):
    return hashlib.sha256(data).hexdigest()


def chunks(raw):
    assert raw[:4] == b'RIFF' and raw[8:12] == b'WAVE'
    assert struct.unpack_from('<I', raw, 4)[0] + 8 == len(raw)
    offset = 12
    result = {}
    while offset < len(raw):
        tag, size = struct.unpack_from('<4sI', raw, offset)
        start = offset + 8
        assert start + size <= len(raw) and tag not in result
        result[tag] = raw[start:start + size]
        offset = start + size + size % 2
    assert offset == len(raw)
    return result


source_path = Path('docs/reference/hawkshot-audio.json')
source = json.loads(source_path.read_text())
out = Path('.cache/hawkshot-audio-decoded')
out.mkdir(parents=True, exist_ok=True)
results = []
for media in source['media']:
    path = Path('.cache/hawkshot-audio-media') / f"{media['id']}.wem"
    encoded = path.read_bytes()
    assert len(encoded) == media['bytes'] and sha(encoded) == media['sha256']
    metadata = json.loads(subprocess.check_output([str(TOOL), '-m', '-I', str(path)], text=True))
    dest = out / f"{media['id']}.wav"
    # Disable decoder loop expansion/fade. Preserve original channels/rate,
    # full decoded stream, and float headroom without normalization/dither.
    subprocess.run([str(TOOL), '-i', '-W', '4', '-o', str(dest), str(path)], check=True, stdout=subprocess.DEVNULL)
    raw = dest.read_bytes()
    wav = chunks(raw)
    format_id, channels, rate, byte_rate, alignment, bits = struct.unpack_from('<HHIIHH', wav[b'fmt '])
    assert format_id == 3 and bits == 32
    assert channels == metadata['channels'] and rate == metadata['sampleRate']
    assert alignment == channels * 4 and byte_rate == rate * alignment
    assert len(wav[b'data']) == metadata['numberOfSamples'] * alignment
    samples = [x[0] for x in struct.iter_unpack('<f', wav[b'data'])]
    assert samples and all(math.isfinite(x) for x in samples)
    peak = max(abs(x) for x in samples)
    assert peak > 0, 'Unexpected silent source'
    # Endpoint delta is diagnostic, not a proof of seamless native looping.
    endpoint_delta = [samples[-channels + c] - samples[c] for c in range(channels)]
    rms = math.sqrt(math.fsum(x * x for x in samples) / len(samples))
    results.append(dict(id=media['id'], encodedSha256=media['sha256'], wavSha256=sha(raw),
        pcmSha256=sha(wav[b'data']), wavBytes=len(raw), format='IEEE float32 little-endian WAV',
        channels=channels, sampleRate=rate, frames=metadata['numberOfSamples'],
        durationSeconds=metadata['numberOfSamples'] / rate, peak=peak, rms=rms,
        samplesOutsideUnitRange=sum(abs(x) > 1 for x in samples), endpointDelta=endpoint_delta,
        decoderMetadata=metadata))

# This build uses system Vorbis/Ogg; record exact library bytes and versions,
# since a decoder commit alone does not establish bit-identical output.
linked = subprocess.check_output(['otool', '-L', str(TOOL)], text=True)
libraries = []
for line in linked.splitlines()[1:]:
    path = Path(line.strip().split(' (')[0])
    if path.name.startswith(('libvorbis', 'libogg')):
        libraries.append(dict(name=path.name, sha256=sha(path.read_bytes())))
assert len(libraries) == 3
result = dict(sourceGraphSha256=sha(source_path.read_bytes()),
    decoder=dict(repository='https://github.com/vgmstream/vgmstream', revision=REVISION,
                 binarySha256=sha(TOOL.read_bytes()), libraries=libraries,
                 vorbisVersion=subprocess.check_output(['pkg-config', '--modversion', 'vorbisfile'], text=True).strip(),
                 oggVersion=subprocess.check_output(['pkg-config', '--modversion', 'ogg'], text=True).strip(),
                 flags=['-i', '-W', '4']),
    media=results,
    status='Decoded source masters only. No normalization, resampling, gain, loop expansion or fade applied. Native mix and listening comparison remain unverified.')
Path('docs/reference/hawkshot-audio-decoded.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps([dict(id=x['id'], seconds=round(x['durationSeconds'], 4), peak=round(x['peak'], 4),
                      loop=x['decoderMetadata']['loopingInfo']) for x in results]))
