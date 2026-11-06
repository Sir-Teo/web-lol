"""Exercise float-master format rejection and preservation without source caches."""
import copy
import json
import math
import struct
import sys
from audio_float_corpus import inspect_float_wave, require


def chunk(tag, raw):
    return tag + struct.pack('<I', len(raw)) + raw + (b'\0' if len(raw) % 2 else b'')


def wave(samples, channels=2, rate=48000, codec=3, extra=b''):
    fmt = struct.pack('<HHIIHH', codec, channels, rate, rate * channels * 4, channels * 4, 32)
    body = b'WAVE' + chunk(b'fmt ', fmt) + chunk(b'data', struct.pack('<' + 'f' * len(samples), *samples)) + extra
    return b'RIFF' + struct.pack('<I', len(body)) + body


metadata = dict(numberOfSamples=2, channels=2, sampleRate=48000,
                mixingInfo=dict(inputChannels=2, outputChannels=2))
raw = wave([1.5, -1.25, 0.25, 0])
before = copy.deepcopy(metadata)
reading = inspect_float_wave(raw, metadata)
require(reading['peak'] == 1.5 and reading['samplesOutsideUnitRange'] == 2 and
        reading['frames'] == 2 and reading['sampleRate'] == 48000 and reading['channels'] == 2 and
        reading['durationSeconds'] == 2 / 48000 and math.isclose(reading['rms'], math.sqrt(31 / 32), rel_tol=1e-15),
        'Float headroom/channel/rate measurement changed')
require(metadata == before and inspect_float_wave(raw, metadata) == reading, 'Wave inspection mutated input or retained state')
fmt = struct.pack('<HHIIHH', 3, 2, 48000, 48000 * 8, 8, 32)
probes = [
    (raw[:4] + struct.pack('<I', len(raw) - 9) + raw[8:], metadata),
    (raw[:-1], metadata),
    (wave([1, 0, 0, 0], extra=chunk(b'fmt ', fmt)), metadata),
    (wave([float('nan'), 0, 0, 0]), metadata),
    (wave([float('inf'), 0, 0, 0]), metadata),
    (wave([0, 0, 0, 0], codec=1), metadata),
    (raw, {**metadata, 'numberOfSamples': 3}),
    (raw, {**metadata, 'mixingInfo': dict(inputChannels=2, outputChannels=1)}),
]
for data, info in probes:
    try:
        inspect_float_wave(data, info)
    except ValueError:
        pass
    else:
        raise ValueError('Invalid float source accepted')
print(json.dumps(dict(status='passed', optimized=bool(sys.flags.optimize), invalidInputsRejected=len(probes),
                      headroomRetained=True, sourceCachesRequired=False)))
