#!/usr/bin/env python3
"""Verify bounded native BIN loading and Activate wire fields; offline, no target execution."""
import argparse
import hashlib
import importlib.util
import json
import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def require(ok, message):
    if not ok:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def checked(row):
    data = (ROOT / row['path']).read_bytes()
    require((len(data), digest(data)) == (row['bytes'], row['sha256']), 'Retained bytes differ: ' + row['path'])
    return data


def number(value):
    return int(value, 16) if isinstance(value, str) else value


def local_module(record, name):
    checked(record)
    spec = importlib.util.spec_from_file_location(name, ROOT / record['path'])
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


class WireReader:
    """Bounded current BIN value layout; no external reader or hash database executes."""
    def __init__(self, data):
        self.data, self.cursor = data, 0

    def take(self, size):
        require(0 <= size <= len(self.data) - self.cursor, 'BIN read exceeds input')
        start = self.cursor; self.cursor += size
        return self.data[start:self.cursor]

    def integer(self, size):
        return int.from_bytes(self.take(size), 'little')

    def string(self):
        return self.take(self.integer(2)).decode('utf-8')

    def fields(self, count, depth):
        require(count <= len(self.data) // 5, 'Impossible field count')
        result = []
        for _ in range(count):
            start = self.cursor; name, kind = self.integer(4), self.integer(1)
            result.append(dict(start=start, hash=name, wire=kind, value=self.value(kind, depth + 1)))
        return result

    def value(self, kind, depth=0):
        require(depth < 100, 'Excessive BIN depth')
        start = self.cursor
        fixed = {0: 0, 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 4, 7: 4,
                 8: 8, 9: 8, 10: 4, 11: 8, 12: 12, 13: 16, 14: 64,
                 15: 4, 17: 4, 18: 8, 0x84: 4, 0x87: 1}
        if kind in fixed:
            self.take(fixed[kind]); return None
        if kind == 16: return self.string()
        if kind in [0x82, 0x83]:
            type_hash = self.integer(4)
            if kind == 0x82 and type_hash == 0:
                return dict(start=start, end=self.cursor, typeHash=0, fields=[])
            length = self.integer(4); end = self.cursor + length
            require(end <= len(self.data), 'Struct length exceeds input')
            count = self.integer(2); fields = self.fields(count, depth)
            require(self.cursor == end, 'Struct length/count disagree')
            return dict(start=start, end=end, typeHash=type_hash, fields=fields)
        if kind in [0x80, 0x81]:
            element = self.integer(1); length = self.integer(4); end = self.cursor + length
            require(end <= len(self.data), 'List length exceeds input')
            count = self.integer(4); require(count <= len(self.data), 'Impossible list count')
            values = [self.value(element, depth + 1) for _ in range(count)]
            require(self.cursor == end, 'List length/count disagree')
            return dict(start=start, end=end, element=element, values=values)
        if kind == 0x85:
            element, count = self.integer(1), self.integer(1)
            require(count in [0, 1], 'Invalid option count')
            for _ in range(count): self.value(element, depth + 1)
            return None
        if kind == 0x86:
            key, value = self.integer(1), self.integer(1)
            length = self.integer(4); end = self.cursor + length; count = self.integer(4)
            require(end <= len(self.data) and count <= len(self.data), 'Invalid map extent')
            for _ in range(count):
                self.value(key, depth + 1); self.value(value, depth + 1)
            require(self.cursor == end, 'Map length/count disagree'); return None
        raise ValueError(f'Unsupported BIN wire type {kind:#x}')


def verify(path):
    pin = json.loads(path.read_text()); checked(pin['verifier'])
    require(not pin['nativeExecuted'] and not pin['nativeShaderExecuted'], 'Unexpected execution claim')
    prior = local_module(pin['constructorVerifier'], 'retained_emitter_verifier')
    checked(pin['constructorPin']); constructor = prior.verify(ROOT / pin['constructorPin']['path'])
    helper = local_module(constructor['sectionParser'], 'retained_section_parser')
    data, sections = helper.arm64_sections(checked(constructor['target']), constructor['target']['architecture'])

    def at(address, size):
        address = number(address)
        rows = [s for s in sections if s['address'] <= address and address + size <= s['address'] + s['bytes']]
        require(len(rows) == 1 and rows[0]['flags'] & 255 not in [1, 12, 18], 'Unmapped/zerofill read')
        s = rows[0]; offset = s['offset'] + address - s['address']
        require(offset + size <= len(data), 'Native span exceeds slice')
        return data[offset:offset + size]

    def word(address): return struct.unpack('<I', at(address, 4))[0]
    for row in pin['retainedInputs']: checked(row)
    starts_info = constructor['functionStarts']
    encoded = data[starts_info['offset']:starts_info['offset'] + starts_info['bytes']]
    require(digest(encoded) == starts_info['sha256'], 'Function-start bytes differ')
    starts = []; total = 0; value = 0; shift = 0
    for byte in encoded:
        value |= (byte & 127) << shift
        if byte & 128:
            shift += 7; require(shift < 64, 'Invalid ULEB128'); continue
        if value == 0: break
        total += value; starts.append(number(constructor['textVmaddr']) + total); value = 0; shift = 0
    successors = dict(zip(starts, starts[1:]))
    for row in pin['llvmRecords']:
        text = checked(row).decode(); start, end = number(row['requestedStart']), number(row['nextFunctionStart'])
        require(successors.get(start) == end, 'LLVM function-start bounds differ')
        words = [(int(a, 16), int(w, 16)) for a, w in re.findall(r'^([0-9a-f]{9}): ([0-9a-f]{8})\s', text, re.M)]
        require([a for a, _ in words] == list(range(start, end, 4)), 'Incomplete LLVM word stream')
        require(len(words) == row['instructions'], 'LLVM instruction count differs')
        for address, value in words: require(word(address) == value, 'LLVM/native word differs')
    for row in pin['instructionSpans']:
        raw = at(row['address'], row['bytes'])
        require((raw.hex(), digest(raw)) == (row['hex'], row['sha256']), 'Native span differs')
    for row in pin['directBranches']:
        pc = number(row['address']); w = word(pc)
        require(w & 0xfc000000 == 0x94000000, 'Expected BL')
        imm = w & 0x3ffffff
        if imm & (1 << 25): imm -= 1 << 26
        require(pc + 4 * imm == number(row['target']), 'BL target differs')
    for row in pin['exactWords']:
        require(word(row['address']) == number(row['word']), 'Selected loader instruction differs')
    table = pin['dispatchTable']; values = list(at(table['address'], 8))
    require(values == table['values'], 'Dispatch table differs')
    require(number(table['base']) + values[2] * 4 == 0x10169e4dc, 'STRUCT dispatch differs')

    source = json.loads(checked(pin['sourcePin'])); resource = source['resources']['Leona_R_buf']
    skin = checked(pin['sourceBin']); source_row = next(f for f in source['extraction']['files']
        if f['path'] == 'data/characters/leona/skins/skin0.bin')
    require((len(skin), digest(skin)) == (source_row['bytes'], source_row['sha256']), 'Frozen source identity differs')
    reader = WireReader(skin); require(reader.take(4) == b'PROP', 'Expected PROP BIN')
    require(reader.integer(4) == 3, 'Expected BIN version3')
    for _ in range(reader.integer(4)): reader.string()
    count = reader.integer(4); types = [reader.integer(4) for _ in range(count)]
    found = []
    for type_hash in types:
        length = reader.integer(4); end = reader.cursor + length
        require(end <= len(skin), 'Entry extent exceeds BIN')
        name = reader.integer(4); field_count = reader.integer(2)
        if name == prior.fnv(resource['record']):
            require(type_hash == prior.fnv(resource['definition']['__type']), 'System type differs')
            fields = reader.fields(field_count, 0); require(reader.cursor == end, 'Entry length differs')
            found.append(fields)
        reader.cursor = end
    require(len(found) == 1, 'R buff entry missing/ambiguous')
    fields = [f for f in found[0] if f['hash'] == prior.fnv('complexEmitterDefinitionData')]
    require(len(fields) == 1 and fields[0]['wire'] == 0x80, 'Expected emitter LIST')
    lst = fields[0]['value']; require(lst['element'] == 0x82 and len(lst['values']) == 4, 'Expected four STRUCT emitters')
    activate = lst['values'][3]; wire = pin['sourceWire']
    require((wire['virtualPath'], wire['record'], wire['binVersion']) ==
            ('data/characters/leona/skins/skin0.bin', resource['record'], 3), 'Wire source context differs')
    require(fields[0]['start'] == wire['listFieldHeader']['offset']
            and wire['listFieldHeader']['bytes'] == 14, 'List header ownership differs')
    require((wire['listFieldWireType'], wire['elementWireType'], wire['elementCount'],
             wire['activateElementIndex']) == (0x80, 0x82, 4, 3), 'Wire list metadata differs')
    require(int(wire['listFieldHash'], 16) == prior.fnv('complexEmitterDefinitionData')
            and int(wire['activateTypeHash'], 16) == 0x09cde442, 'Wire hashes differ')
    require(wire['absentFields'] == {name: f'{prior.fnv(name):08x}'
            for name in ['primitive', 'texture', 'alphaRef']}, 'Absent-field hashes differ')
    require(activate['typeHash'] == prior.fnv('VfxEmitterDefinitionData') == 0x09cde442, 'Activate type differs')
    require(len(activate['fields']) == wire['activateSerializedFieldCount'] == 18, 'Activate field count differs')
    require(activate['start'] == wire['activateElement']['offset']
            and activate['end'] - activate['start'] == wire['activateElement']['bytes'], 'Activate extent differs')
    names = [f for f in activate['fields'] if f['hash'] == prior.fnv('emitterName')]
    require(len(names) == 1 and names[0]['wire'] == 16 and names[0]['value'] == 'Activate', 'Emitter name differs')
    for name in ['primitive', 'texture', 'alphaRef']:
        require(all(f['hash'] != prior.fnv(name) for f in activate['fields']), 'Expected omitted ' + name)
    for row in [wire['listFieldHeader'], wire['activateElement']] + [f['header'] for f in wire['activateFieldHeaders']]:
        raw = skin[row['offset']:row['offset'] + row['bytes']]
        require((raw.hex(), digest(raw)) == (row['hex'], row['sha256']), 'Source wire span differs')
    require([(f['start'], f['hash'], f['wire']) for f in activate['fields']] ==
            [(f['header']['offset'], int(f['hash'], 16), f['wireType']) for f in wire['activateFieldHeaders']],
            'Source field headers differ')
    return pin


def main():
    cli = argparse.ArgumentParser(description=__doc__); cli.add_argument('--check', action='store_true', required=True)
    cli.add_argument('--pin', type=Path, default=ROOT / 'docs/reference/leona-native-bin-loader.json')
    pin = verify(cli.parse_args().pin)
    print(f'PASS: constructor evidence, {len(pin["llvmRecords"])} native loader word streams, '
          'LIST/STRUCT dispatch, exact Activate BIN ownership, 18 fields and three omissions. Offline/static only.')


if __name__ == '__main__': main()
