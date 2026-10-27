"""Pinned source-master decoding and independent, non-normalizing WAV checks."""
from pathlib import Path
import hashlib
import json
import math
import platform
import struct
import subprocess
import tempfile
from masteryi_audio_source import checked_bytes

GRAPH = Path('docs/reference/masteryi/audio-graph.json')
GRAPH_SHA256 = 'b7879c088d3544626d70c9ecaf4abfd0aebae007db5a6ee841c0caed7a2b33e3'
DECODER_REVISION = 'e6afeaacf433bfafd38d873f80c94517e09d5b96'
OGG_REVISION = 'fa80aae9d50096160f2b56ada35527d7aee3f746'
VORBIS_REVISION = '2eac96b03ff67953354cb0a649c08aa3a23267ef'
MEDIA_ROOT = Path('.cache/masteryi-audio-media')
MASTER_ROOT = Path('.cache/masteryi-audio-decoded')
DECODED = Path('docs/reference/masteryi/audio-decoded.json')
DECODED_SHA256 = '28ac362788bb76709a226e76d282eb25a1805a474b9bc7348cedd59bbee33a32'


def sha(data): return hashlib.sha256(data).hexdigest()


def source_media(graph_path=GRAPH, media_root=MEDIA_ROOT):
    graph = json.loads(checked_bytes(graph_path, GRAPH_SHA256))
    for row in graph['media']:
        checked_bytes(Path(media_root) / f"{row['id']}.wem", row['sha256'], row['bytes'])
    return graph


def wave_chunks(raw):
    if len(raw) < 12 or raw[:4] != b'RIFF' or raw[8:12] != b'WAVE': raise ValueError('Expected RIFF/WAVE master')
    if struct.unpack_from('<I', raw, 4)[0] + 8 != len(raw): raise ValueError('WAV RIFF extent differs')
    offset = 12; result = {}
    while offset < len(raw):
        if offset + 8 > len(raw): raise ValueError('Truncated WAV chunk header')
        tag, size = struct.unpack_from('<4sI', raw, offset); start = offset + 8
        if tag in result or start + size > len(raw): raise ValueError('Invalid WAV chunk extent or duplicate')
        result[tag] = raw[start:start + size]; offset = start + size + size % 2
    if offset != len(raw): raise ValueError('WAV padding extent differs')
    return result


def inspect_wave(raw, metadata):
    parts = wave_chunks(raw)
    if b'fmt ' not in parts or len(parts[b'fmt ']) < 16 or b'data' not in parts: raise ValueError('WAV omits format/data')
    fmt, channels, rate, byte_rate, alignment, bits = struct.unpack_from('<HHIIHH', parts[b'fmt '])
    frames = metadata['numberOfSamples']
    if fmt != 3 or bits != 32: raise ValueError('Master must retain IEEE float32 samples')
    if channels < 1 or rate < 1 or channels != metadata['channels'] or rate != metadata['sampleRate']: raise ValueError('Native channels/sample rate differ')
    if metadata['mixingInfo']['inputChannels'] != channels or metadata['mixingInfo']['outputChannels'] != channels: raise ValueError('Channel mixing is not a source master')
    if alignment != channels * 4 or byte_rate != rate * alignment: raise ValueError('WAV byte rate/alignment differ')
    if type(frames) is not int or frames < 0 or len(parts[b'data']) != frames * alignment: raise ValueError('Native frame count differs')
    samples = [item[0] for item in struct.iter_unpack('<f', parts[b'data'])]
    if not all(math.isfinite(v) for v in samples): raise ValueError('Non-finite PCM sample')
    peak = max((abs(v) for v in samples), default=0)
    return {'wavSha256': sha(raw), 'pcmSha256': sha(parts[b'data']), 'wavBytes': len(raw),
        'format': 'IEEE float32 little-endian WAV', 'channels': channels, 'sampleRate': rate,
        'frames': frames, 'durationSeconds': frames / rate, 'peak': peak,
        'rms': math.sqrt(math.fsum(v * v for v in samples) / len(samples)) if samples else 0,
        'samplesOutsideUnitRange': sum(abs(v) > 1 for v in samples),
        'endpointDelta': [samples[-channels + c] - samples[c] for c in range(channels)] if samples else [0] * channels}


def clean_revision(root, revision):
    root = Path(root).resolve()
    top = subprocess.check_output(['git', '-C', str(root), 'rev-parse', '--show-toplevel'], text=True).strip()
    actual = subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip()
    if Path(top).resolve() != root or actual != revision: raise ValueError('Exact decoder/codec repository revision required')
    if subprocess.check_output(['git', '-C', str(root), 'diff', '--name-only', 'HEAD'], text=True).strip(): raise ValueError('Decoder/codec tracked sources differ')
    return root


def decoder_provenance(decoder_root, ogg_root, vorbis_root):
    root = clean_revision(decoder_root, DECODER_REVISION)
    clean_revision(ogg_root, OGG_REVISION); clean_revision(vorbis_root, VORBIS_REVISION)
    tool = root / 'build/cli/vgmstream-cli'
    cache_path = root / 'build/CMakeCache.txt'; cache = {}
    for line in cache_path.read_text().splitlines():
        if line.startswith(('#', '//')) or ':' not in line or '=' not in line: continue
        key, value = line.split('=', 1); cache[key.split(':', 1)[0]] = value
    selected = {key: cache[key] for key in ['CMAKE_BUILD_TYPE', 'CMAKE_C_COMPILER', 'CMAKE_C_FLAGS', 'CMAKE_C_FLAGS_RELEASE', 'USE_VORBIS', 'USE_FFMPEG', 'USE_MPEG', 'USE_G7221', 'USE_G719', 'USE_ATRAC9', 'USE_CELT', 'USE_SPEEX']}
    libraries = []
    for name, revision, relative in [('ogg', OGG_REVISION, 'dependencies/ogg/libogg.a'), ('vorbis', VORBIS_REVISION, 'dependencies/vorbis/lib/libvorbis.a'), ('vorbisfile', VORBIS_REVISION, 'dependencies/vorbis/lib/libvorbisfile.a')]:
        p = root / 'build' / relative
        libraries.append({'name': name, 'revision': revision, 'path': relative, 'bytes': p.stat().st_size, 'sha256': sha(p.read_bytes())})
    result = {'repository': 'https://github.com/vgmstream/vgmstream', 'revision': DECODER_REVISION,
        'binarySha256': sha(tool.read_bytes()), 'staticDependencies': libraries,
        'flags': ['-i', '-W', '4'], 'compiler': subprocess.check_output([selected['CMAKE_C_COMPILER'], '--version'], text=True).splitlines()[0],
        'cmakeCacheSha256': sha(cache_path.read_bytes()), 'cmakeConfiguration': selected,
        'platform': {'system': platform.system(), 'machine': platform.machine(), 'libc': list(platform.libc_ver())}}
    return tool, result


def decode(decoder_root, ogg_root, vorbis_root, graph_path=GRAPH, media_root=MEDIA_ROOT):
    graph = source_media(graph_path, media_root)
    tool, provenance = decoder_provenance(decoder_root, ogg_root, vorbis_root)
    results = []; waves = {}
    with tempfile.TemporaryDirectory() as tmp:
        for row in graph['media']:
            source = Path(media_root) / f"{row['id']}.wem"; dest = Path(tmp) / f"{row['id']}.wav"
            metadata = json.loads(subprocess.check_output([str(tool), '-m', '-I', str(source)], text=True))
            subprocess.run([str(tool), '-i', '-W', '4', '-o', str(dest), str(source)], check=True, stdout=subprocess.DEVNULL)
            raw = dest.read_bytes(); stats = inspect_wave(raw, metadata)
            results.append({'id': row['id'], 'encodedSha256': row['sha256'], **stats, 'decoderMetadata': metadata})
            waves[row['id']] = raw
    record = {'sourceGraphSha256': GRAPH_SHA256, 'decoder': provenance, 'media': results,
        'status': 'Unnormalized source masters; no resampling, channel mixing, gain, pitch, loop expansion or fades baked in. Native mix/listening and runtime remain separate.'}
    return record, waves


def check_masters(record_path=DECODED, graph_path=GRAPH, media_root=MEDIA_ROOT, masters=MASTER_ROOT, record_sha256=DECODED_SHA256):
    graph = source_media(graph_path, media_root); record = json.loads(checked_bytes(record_path, record_sha256))
    if record['sourceGraphSha256'] != GRAPH_SHA256: raise ValueError('Decoded source graph differs')
    expected = {row['id']: row['sha256'] for row in graph['media']}
    if len(record['media']) != len(expected) or {r['id'] for r in record['media']} != set(expected): raise ValueError('Decoded media membership differs')
    for row in record['media']:
        if row['encodedSha256'] != expected[row['id']]: raise ValueError('Encoded source identity differs')
        raw = checked_bytes(Path(masters) / f"{row['id']}.wav", row['wavSha256'], row['wavBytes'])
        stats = inspect_wave(raw, row['decoderMetadata'])
        if any(row.get(key) != value for key, value in stats.items()): raise ValueError('Decoded PCM statistics or identity differ')
    return record
