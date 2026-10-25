#!/usr/bin/env python3
"""Verify bounded fresh native Mesh/SCB cache selection offline; never runs a target.

Normal invocation and --check are both read-only. Use the existing CDTB Python
runtime. Explicit checks remain active under python -O.
"""
import argparse
import hashlib
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


def digest(data):
    return hashlib.sha256(data).hexdigest()


def checked(row):
    data = (ROOT / row['path']).read_bytes()
    require(len(data) == row['bytes'] and digest(data) == row['sha256'], 'Pinned bytes differ: ' + row['path'])
    return data


def fnv(text):
    value = 0x811c9dc5
    for byte in text.lower().encode('ascii'):
        value = ((value ^ byte) * 0x1000193) & 0xffffffff
    return value


class Native:
    def __init__(self, source, mapping):
        self.data = source
        self.mapping = mapping

    def at(self, address, count):
        section = next(s for s in self.mapping['sections'] if s['offset'] and s['address'] <= address and address + count <= s['address'] + s['bytes'])
        offset = self.mapping['fatOffset'] + section['offset'] + address - section['address']
        require(0 <= offset <= len(self.data) - count, 'Native read outside file')
        return self.data[offset:offset + count]

    def word(self, address):
        return struct.unpack('<I', self.at(address, 4))[0]

    def branch(self, address, link=True):
        word = self.word(address)
        require(word & 0xfc000000 == (0x94000000 if link else 0x14000000), 'Expected direct branch: ' + hex(address))
        immediate = word & 0x3ffffff
        if immediate & (1 << 25): immediate -= 1 << 26
        return address + immediate * 4

    def conditional(self, address):
        word = self.word(address)
        require(word & 0xff000010 == 0x54000000 or word & 0x7e000000 == 0x34000000, 'Expected B.cond/CBZ: ' + hex(address))
        immediate = (word >> 5) & 0x7ffff
        if immediate & (1 << 18): immediate -= 1 << 19
        return address + 4 * immediate


def source_reading():
    sys.path.insert(0, str(ROOT / '.tools/cdtb'))
    from cdtb import binfile
    for name in ['hashfile_binfields', 'hashfile_bintypes', 'hashfile_binhashes', 'hashfile_binentries', 'hashfile_binpaths']:
        getattr(binfile, name).hashes = {}
    source_pin = json.loads((ROOT / 'docs/reference/leona-e-particles.json').read_text())
    resource = source_pin['resources']['Leona_E_mis_weapon']
    row = next(x for x in source_pin['extraction']['files'] if x['path'] == resource['sourceBin'])
    path = ROOT / '.cache/leona-e-particle-sources-v2-20261024' / (row['wadPathHash'] + '.bin')
    data = path.read_bytes()
    require(digest(data) == row['sha256'] and len(data) == row['bytes'], 'Frozen E BIN differs')
    class Trace(binfile.BinReader):
        def read_field(self):
            start = self.f.tell()
            field = super().read_field()
            field.start, field.end = start, self.f.tell()
            return field
    original = binfile.BinReader
    binfile.BinReader = Trace
    try:
        parsed = binfile.BinFile(io.BytesIO(data))
    finally:
        binfile.BinReader = original
    entry = next(x for x in parsed.entries if x.path.h == fnv(resource['record']))
    parent = entry['complexEmitterDefinitionData']
    emitter = parent.value.values[18]
    require(emitter['emitterName'].value == 'sword2', 'Source emitter identity differs')
    primitive_field = emitter['primitive']
    primitive = primitive_field.value
    mesh_field = primitive['mMesh']
    mesh = mesh_field.value
    require(primitive.type.h == fnv('VfxPrimitiveMesh') == 0x8594e839, 'Primitive type differs')
    require(mesh.type.h == fnv('VfxMeshDefinitionData') == 0x6a88780b, 'Mesh child type differs')
    require(int(mesh_field.type) == 0x83, 'mMesh is not EMBEDDED83')
    fields = {field.name.h: field for field in mesh.fields}
    require(set(fields) == {fnv('mSimpleMeshName')}, 'Source mesh ownership/omissions differ')
    name = fields[fnv('mSimpleMeshName')]
    require(int(name.type) == 0x10 and name.value == 'ASSETS/Characters/Leona/Skins/Base/Particles/Leona_Base_Z_sword.scb', 'Simple mesh field differs')
    def window(field):
        raw = data[field.start:field.end]
        return dict(offset=field.start, bytes=len(raw), hex=raw.hex(), sha256=digest(raw))
    return dict(record=resource['record'], sourceBin=resource['sourceBin'], sourceBinPin=dict(path=str(path.relative_to(ROOT)), bytes=len(data), sha256=digest(data)), emitterIndex=18, emitterName='sword2', emitterConcreteType=f'{emitter.type.h:08x}', parentListWireType=int(parent.type), parentListElementWireType=int(parent.value.vtype), primitiveWireType=int(primitive_field.type), primitiveType=f'{primitive.type.h:08x}', meshWireType=int(mesh_field.type), meshType=f'{mesh.type.h:08x}', serializedMeshFieldCount=len(mesh.fields), authoredFields=[dict(name='mSimpleMeshName', hash=f'{name.name.h:08x}', wireType=int(name.type), value=name.value, sourceBytes=window(name))], omittedFields=['mMeshName', 'mMeshSkeletonName'], primitiveFieldBytes=window(primitive_field), meshFieldBytes=window(mesh_field))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Read-only offline verification, also the normal mode.')
    parser.add_argument('--pin', type=Path, default=ROOT / 'docs/reference/leona-native-scb-cache-selection.json')
    options = parser.parse_args()
    pin = json.loads(options.pin.read_text())
    for row in pin['dependencies']: checked(row)
    native = Native(checked(pin['native']['whole']), json.loads(checked(pin['native']['mapping'])))
    checked(pin['native']['slice'])
    require(len(pin['instructionStreams']) == 24, 'Bounded instruction stream count differs')
    for row in pin['instructionStreams']:
        text = checked(row).decode()
        words = [(int(a, 16), int(w, 16)) for a, w in re.findall(r'^([0-9a-f]+):\s+([0-9a-f]{8})', text, re.M)]
        require(len(words) == row['verifiedWords'] and words, 'Instruction stream extent differs')
        require([a for a, _ in words] == list(range(words[0][0], words[-1][0] + 4, 4)), 'Instruction stream is not contiguous')
        for address, word in words: require(native.word(address) == word, 'Retained LLVM word differs at ' + hex(address))
    for row in pin['nativeWindows']:
        data = native.at(int(row['address'], 16), row['bytes'])
        require(data.hex() == row['hex'] and digest(data) == row['sha256'], 'Native window differs: ' + row['address'])
    for address, word in pin['criticalWords'].items():
        require(native.word(int(address, 16)) == int(word, 16), 'Critical native word differs: ' + address)
    for row in pin['directBranches']:
        require(native.branch(int(row['address'], 16), row.get('link', True)) == int(row['target'], 16), 'Direct branch target differs')
    for row in pin['conditionalBranches']:
        require(native.conditional(int(row['address'], 16)) == int(row['target'], 16), 'Conditional branch target differs')
    require(source_reading() == pin['source'], 'Source ownership/default omission reading differs')
    # Recheck the relevant already-pinned generic BIN loading spans, including
    # EMBEDDED83's encoded-field loop, dispatch and parent-field lookup.
    loader = json.loads(checked(pin['loaderPin']))
    for row in loader['instructionSpans']:
        data = native.at(int(row['address'], 16), row['bytes'])
        require(data.hex() == row['hex'] and digest(data) == row['sha256'], 'Generic loader span differs')
    for row in loader['directBranches']:
        require(native.branch(int(row['address'], 16)) == int(row['target'], 16), 'Generic loader call differs')
    table = loader['dispatchTable']
    values = list(native.at(int(table['address'], 16), len(table['values'])))
    require(values == table['values'] and int(table['base'], 16) + values[3] * 4 == 0x10169e4f4, 'EMBEDDED83 dispatch table differs')
    # Registration relationships are decoded from their exact instruction words,
    # not inferred from an isolated hash match or from SCB +40.
    require(fnv('VfxPrimitiveMeshBase') == 0xfc395264 and fnv('mMesh') == 0x0d89732d, 'Mesh base/field hash differs')
    require(0x1025f07f8 + 0x440 == 0x1025f0c38, 'Mesh definition descriptor publication differs')
    require(0x1025f1298 + 0x88 == 0x1025f1320, 'Mesh base descriptor publication differs')
    require(struct.unpack('<Q', native.at(0x102486248, 8))[0] == 0x101914a3c and struct.unpack('<Q', native.at(0x1024862a0, 8))[0] == 0x101914a44, 'Mesh virtual getter pointers differ')
    def hash_pair(address):
        first, second = native.word(address), native.word(address + 4)
        require(first & 0xffe0001f == 0x52800001 and second & 0xffe0001f == 0x72a00001, 'Expected W1 hash MOVZ/MOVK pair')
        return ((first >> 5) & 0xffff) | (((second >> 5) & 0xffff) << 16)
    fields = []
    for name, address in [('mMeshName', 0x1018d6230), ('mMeshSkeletonName', 0x1018d624c), ('mSimpleMeshName', 0x1018d6214)]:
        require(hash_pair(address) == fnv(name), 'Registered field hash differs: ' + name)
        word = native.word(address + 8)
        require(word & 0xffe0001f == 0x52800002, 'Expected field offset W2 MOVZ')
        offset = (word >> 5) & 0xffff
        fields.append(dict(name=name, hash=f'{fnv(name):08x}', nativeOffset=offset, wireType=16, defaultStringLength=0, authored=name == 'mSimpleMeshName'))
    require(fields == pin['registeredTypes']['meshDefinition']['fields'], 'Registered field ownership/offset table differs')
    require(hash_pair(0x1018d61fc) == fnv('VfxMeshDefinitionData') and hash_pair(0x1018d6a70) == fnv('VfxPrimitiveMeshBase') and hash_pair(0x1018d6a98) == fnv('mMesh'), 'Registered class/embedded field hashes differ')
    require(struct.unpack('<Q', native.at(0x10246e0c0, 8))[0] == 0x102230369 and native.at(0x102230369, 1) == b'\0', 'Registered empty string pointer differs')
    # Literal constructor/guard controls: all four indices are FFFFFFFF, and the
    # source omitted the first name whose registered default string length is 0.
    require(pin['freshState']['componentIndex1c'] == -1 and pin['freshState']['componentIndex24'] == -1 and pin['freshState']['meshNameLength'] == 0, 'Fresh-state guard premise differs')
    require(native.word(0x101899064) == 0x9280001b and native.word(0x1018990f8) == 0xf802401b and native.word(0x1018990fc) == 0xf801c01b, 'Fresh component sentinel stores differ')
    require(native.word(0x10193a0e4) == 0xfd000400 and native.word(0x10193a140) == 0xfd000400 and native.word(0x10193a768) == 0xfd000c00, 'Registered/default embedded string length stores differ')
    require(native.word(0x101891f20) == 0xb9400848 and native.conditional(0x101891f24) == 0x101891f68, 'Empty first-name guard differs')
    require(native.word(0x10189030c) == 0xb9401ea8 and native.conditional(0x101890314) == 0x101890350, 'First cache -1 guard differs')
    print('PASS native SCB cache selection: fresh -1 indices, registered Mesh/embedded field ownership and omitted name lengths, generic loader spans, first-attempt empty guard, SCB cache branch. Conditional fresh-state result; offline/read-only, no target execution.')


if __name__ == '__main__':
    main()
