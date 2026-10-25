#!/usr/bin/env python3
"""Verify retained attached-skin CPU/BIN/AIR inputs offline; no native execution."""
import argparse
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import re
import struct
import sys

ROOT = Path(__file__).resolve().parents[2]


def require(ok, message):
    if not ok:
        raise ValueError(message)


def sha(raw): return hashlib.sha256(raw).hexdigest()


def verify(path=ROOT / 'docs/reference/leona-attached-skin-reflection-inputs.json'):
    pin = json.loads(path.read_text())
    files = {}
    for row in pin['inputs'] + pin['instructionStreams']:
        raw = (ROOT / row.get('archived', row['path'])).read_bytes()
        require(len(raw) == row['bytes'] and sha(raw) == row['sha256'], 'Input differs: ' + row['path'])
        files[row['path']] = raw
    mapping = json.loads(files['.cache/leona-native-matching-v1-20261024/arm64-focused-strings.json'])
    raw = (ROOT / pin['native']['path']).read_bytes()
    require(sha(raw) == pin['native']['sha256'] == '97edcf2c88fec3169a1ec36345276569de3329e27fd9b32c8162957a77135c6c', 'Native identity differs')

    def window(address, count):
        section = next(s for s in mapping['sections'] if s['offset'] and s['address'] <= address and address + count <= s['address'] + s['bytes'])
        offset = mapping['fatOffset'] + section['offset'] + address - section['address']
        return raw[offset:offset + count]

    for row in pin['instructionStreams']:
        words = re.findall(r'^([0-9a-f]+):\s+([0-9a-f]{8})', files[row['path']].decode(), re.M)
        require(len(words) == row['verifiedWords'] and words, 'Stream extent differs')
        for address, word in words:
            require(struct.unpack('<I', window(int(address, 16), 4))[0] == int(word, 16), 'Native word differs: ' + address)
    for row in pin['windows']:
        value = window(int(row['address'], 16), row['bytes'])
        require(value.hex() == row['hex'] and sha(value) == row['sha256'], 'Native window differs')
    require(window(0x10193a834, 8).hex() == '6801805208200039', 'Attached kind11 constructor differs')
    require(window(0x1021112e0, 16) == struct.pack('<4f', 0, 0, 0, 1), 'Null-child fallback differs')
    # Re-decode each source element rather than trusting the descriptive table.
    sys.path.insert(0, str(ROOT / '.tools/cdtb'))
    from cdtb import binfile
    for name in ['hashfile_binfields', 'hashfile_bintypes', 'hashfile_binhashes', 'hashfile_binentries', 'hashfile_binpaths']:
        getattr(binfile, name).hashes = {}

    def fnv(text):
        value = 2166136261
        for byte in text.lower().encode(): value = ((value ^ byte) * 16777619) & 0xffffffff
        return value

    require(len(pin['sourceProfiles']) == 6, 'Source coverage differs')
    for row in pin['sourceProfiles']:
        decoded = binfile.BinFile(io.BytesIO(files[row['rawBin']['path']]))
        entry = next(e for e in decoded.entries if e.path.h == fnv(row['record']))
        field = entry['complexEmitterDefinitionData']
        emitter = field.value.values[row['emitterIndex']]
        require(field.value.vtype == row['serializedListElementWireType'] == 130, 'Emitter wire type differs')
        require(emitter['emitterName'].value == row['name'] and emitter['blendMode'].value == row['blendMode'] == 4, 'Emitter identity/blend differs')
        require(emitter['primitive'].value.type.h == fnv('VfxPrimitiveAttachedMesh'), 'Attached type differs')
        child = next((f for f in emitter.fields if f.name.h == fnv('reflectionDefinition')), None)
        source = row['sourceReflection']
        require(bool(child) == bool(source), 'Child presence differs')
        if source:
            require(child.value['fresnel'].value == source['fresnel'] == row['exportedReflection']['power'], 'Source rim field differs')
            require(list(child.value['fresnelColor'].value) == source['fresnelColor'] == row['exportedReflection']['color'], 'Source rim color differs')
            require({f.name.h for f in child.value.fields} == {fnv('fresnel'), fnv('fresnelColor')}, 'Child fields differ')
    helper = ROOT / '.cache/leona-native-mesh-reading-v1-20261024/normal-transcription.py'
    spec = importlib.util.spec_from_file_location('attached_fma', helper)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    require([r['littleEndianHex'] for r in pin['float32RimMapping']] == ['d7a3b03e', '90c2553f'], 'Mapped rim table differs')
    for row in pin['float32RimMapping']:
        power = module.fma32(row['source'], module.f32(4.9), module.f32(.1))
        require(power == row['mappedFloat32'] and struct.pack('<f', power).hex() == row['littleEndianHex'], 'FMA32 differs')
    air = files['.cache/leona-w-skin-shaders/particle_vs.vs-metal-5.ll'].decode()
    require('%87 = extractelement <4 x float> %70, i32 3' in air and '@air.fast_powr.f32(float %86, float %87)' in air and '!"vFresnel"' in air, 'AIR exponent consumer differs')
    return pin


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--pin', type=Path, default=ROOT / 'docs/reference/leona-attached-skin-reflection-inputs.json')
    args = parser.parse_args()
    verify(args.pin)
    print('PASS: six raw attached-skin definitions, blend4, retained native streams/kind11/null fallback, exact rim FMA32 and AIR exponent consumer. Conditional static inputs; no native dispatch/frame acceptance.')
