#!/usr/bin/env python3
"""Verify static native reflection fields, CPU uniforms and rim-only AIR; offline."""
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


def sha(raw): return hashlib.sha256(raw).hexdigest()
def num(value): return int(value, 16) if isinstance(value, str) else value


def checked(record):
    raw = (ROOT / record['path']).read_bytes()
    require((len(raw), sha(raw)) == (record['bytes'], record['sha256']), 'Retained bytes differ: ' + record['path'])
    return raw


def module(record, name):
    checked(record)
    spec = importlib.util.spec_from_file_location(name, ROOT / record['path'])
    result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result)
    return result


def fnv(name):
    value = 0x811c9dc5
    for byte in name.lower().encode('ascii'): value = ((value ^ byte) * 0x1000193) & 0xffffffff
    return value


def verify(path):
    pin = json.loads(path.read_text()); checked(pin['verifier'])
    require(not any(pin[k] for k in ['nativeExecuted', 'nativeShaderExecuted', 'nativeRenderingVerified']),
            'Unexpected native execution/rendering claim')
    matching = json.loads(checked(pin['matchingNativePin'])); target = pin['target']; arch = target['architecture']
    require(arch == next(a for a in matching['macho']['architectures'] if a['architecture'] == 'arm64'), 'Slice differs')
    require(any(all(row[k] == target[k] for k in ['path', 'bytes', 'sha256']) for row in matching['selectedFiles']),
            'Matching native target differs')
    parser = module(pin['sectionParser'], 'reflection_native_sections')
    data, sections = parser.arm64_sections(checked(target), arch)

    def at(address, size):
        address = num(address)
        rows = [s for s in sections if s['address'] <= address and address + size <= s['address'] + s['bytes']]
        require(len(rows) == 1 and rows[0]['flags'] & 255 not in [1, 12, 18], 'Unmapped native span')
        s = rows[0]; offset = s['offset'] + address - s['address']
        require(offset + size <= len(data), 'Native span exceeds slice')
        return data[offset:offset + size]

    def word(pc): return struct.unpack('<I', at(pc, 4))[0]
    def adrp(pc):
        w = word(pc); require(w & 0x9f000000 == 0x90000000, 'Expected ADRP')
        imm = ((w >> 5) & 0x7ffff) * 4 + ((w >> 29) & 3)
        if imm & 0x100000: imm -= 0x200000
        return (pc & ~4095) + imm * 4096

    def add(pc):
        w = word(pc); require(w & 0xffc00000 == 0x91000000, 'Expected ADD64 immediate')
        return (w >> 10) & 4095

    def branch(pc, target):
        w = word(pc); require(w & 0xfc000000 == 0x94000000, 'Expected BL')
        imm = w & 0x3ffffff
        if imm & 0x2000000: imm -= 0x4000000
        require(pc + imm * 4 == target, 'BL target differs')

    cursor = 32; link = None
    for _ in range(struct.unpack_from('<I', data, 16)[0]):
        command, size = struct.unpack_from('<II', data, cursor)
        if command == 0x26: link = struct.unpack_from('<II', data, cursor + 8)
        cursor += size
    info = pin['functionStarts']; require(link == (info['offset'], info['bytes']), 'Function-start command differs')
    encoded = data[link[0]:link[0] + link[1]]; require(sha(encoded) == info['sha256'], 'Function-start bytes differ')
    starts = []; total = value = shift = 0
    for byte in encoded:
        value |= (byte & 127) << shift
        if byte & 128:
            shift += 7; require(shift < 64, 'Invalid ULEB128'); continue
        if value == 0: break
        total += value; starts.append(num(pin['textVmaddr']) + total); value = shift = 0
    require(len(starts) == info['count'] and starts == sorted(set(starts)), 'Function-start count/order differs')
    successors = dict(zip(starts, starts[1:]))
    for row in pin['llvmRecords'] + pin['boundedWindows']:
        start = num(row['requestedStart']); end = num(row.get('nextFunctionStart', row.get('requestedEnd')))
        if 'nextFunctionStart' in row: require(successors.get(start) == end, 'Function-start bounds differ')
        words = [(int(a, 16), int(w, 16)) for a, w in re.findall(
            r'^([0-9a-f]{9}): ([0-9a-f]{8})\s', checked(row).decode(), re.M)]
        require([a for a, _ in words] == list(range(start, end, 4)), 'Incomplete LLVM word stream')
        for pc, value in words: require(word(pc) == value, 'LLVM/native instruction word differs')
    for row in pin['retainedInputs']: checked(row)
    for row in pin['instructionSpans']:
        raw = at(row['address'], row['bytes'])
        require((raw.hex(), sha(raw)) == (row['hex'], row['sha256']), 'Native byte span differs')
    for row in pin['directBranches']: branch(num(row['address']), num(row['target']))
    for row in pin['exactWords']: require(word(row['address']) == int(row['word'], 16), 'Selected native word differs')
    guard = pin['resourceGuard']; audit = json.loads(checked(pin['resourceGuardAudit']))
    require(guard['conclusion'] == audit['conclusion'] and guard['limits'] == audit['limits'], 'Guard audit differs')
    require(guard['freshComponent'] and not guard['descriptorFallbackPopulatesOriginal']
            and not guard['emptyLoaderClearsReusedPointer'] and not guard['oldObject58FreshStateKnown'],
            'Resource lifecycle qualification differs')
    require(word(0x10192f4a8) == 0x6f00e400 and word(0x10192f530) == 0x9107e268
            and word(0x10192f53c) == 0xad010100, 'Fresh resource-zero sequence differs')
    require(guard['baseOffset'] == add(0x10192f530) == 0x1f8 and guard['storeRelativeOffset'] == 0x20
            and guard['storeBytes'] == 32 and num(guard['resourceOffset']) == 0x220
            and 0x1f8 + 0x20 <= 0x220 < 0x1f8 + 0x20 + 32, 'Fresh zero-store range differs')
    require(word(0x1018937b4) == 0x54000940 and word(0x1018c3014) == 0xf90007e8
            and word(0x1018c3024) == 0xf9400268 and word(0x1018c2c98) == 0x39400a88,
            'Loader/descriptor/selector predicate differs')

    independent = json.loads(checked(pin['independentAudit']))
    require(pin['definition'] == independent['definition'] and pin['sourceWire'] == independent['source'],
            'Independent source/type audit differs')
    fields = pin['definition']['fields']
    offsets = [0, 16, 20, 24, 28, 44, 48]
    defaults = ['', 0, 1, 1, [1, 1, 1, 1], 1, [0, 0, 0, 0]]
    require(pin['definition']['nativeObjectBytes'] == 64 and pin['definition']['callbacks']['X6'] is None,
            'Reflection type/default callback differs')
    for i, row in enumerate(fields):
        require(int(row['hash'], 16) == fnv(row['name']) and num(row['nativeOffset']) == offsets[i]
                and row['constructorDefault'] == defaults[i], 'Reflection registration/default differs')
        # Seven descriptor registrations set W2 to the byte offset with MOVZ.
        w = word(0x1018ae2a4 + 28 * i)
        require(w & 0xffe0001f == 0x52800002 and ((w >> 5) & 65535) == offsets[i], 'Field-offset instruction differs')
    require(struct.unpack('<4f', at(0x10210e2b0, 16)) == (0, 1, 1, 1), 'Default vector differs')
    require(struct.unpack('<Q', at(0x10246e0c0, 8))[0] == 0x102230369 and at(0x102230369, 1) == b'\0',
            'Empty default string differs')
    for pc, expected in [(0x1019260b0, 0x52800800), (0x1019260d0, 0x4f03f601),
                         (0x1019260d8, 0xa9037c1f), (0x1018c0f78, 0x1f020400),
                         (0x1018df70c, 0x1f020400), (0x1018c0f88, 0x2d0303e1)]:
        require(word(pc) == expected, 'Constructor/power/vector instruction differs')
    for row in pin['uniformNames']:
        require(at(row['cstring'], len(row['name']) + 1) == row['name'].encode() + b'\0', 'Uniform name differs')
        new, old = num(row['newNameInstructions']), num(row['oldNameInstructions'])
        for pc in [new, old]:
            require(adrp(pc) + add(pc + 4) == num(row['cstring']), 'Uniform string reference differs')
            branch(pc + 8, 0x101a77c24)
        nw, ow = word(new + 16), word(old + 12)
        require(nw & 0xffc003ff == 0xf9000100 and ow & 0xffc003ff == 0xf90002e0,
                'Uniform identifier store differs')
        require(adrp(new + 12) + ((nw >> 10) & 4095) * 8 == num(row['newGlobal']), 'New uniform global differs')
        require(adrp(0x101946cd8) + add(0x101946cdc) + ((ow >> 10) & 4095) * 8 == num(row['oldGlobal']),
                'Old uniform global differs')

    # Walk the owning entry, emitter and child through an independent bounded reader.
    reader_module = module(pin['wireReader'], 'reflection_wire_reader'); checked(pin['loaderPin'])
    raw = checked(pin['sourceBin']); source = json.loads(checked(pin['sourcePin']))
    resource = source['resources']['Leona_E_mis_weapon']
    require(any(f['path'] == resource['sourceBin'] and f['bytes'] == len(raw) and f['sha256'] == sha(raw)
                for f in source['extraction']['files']), 'Frozen source identity differs')
    reader = reader_module.WireReader(raw)
    require(reader.take(4) == b'PROP' and reader.integer(4) == 3, 'Expected PROP3')
    for _ in range(reader.integer(4)): reader.string()
    types = [reader.integer(4) for _ in range(reader.integer(4))]; found = []
    for type_hash in types:
        end = reader.cursor + 4 + reader.integer(4); name = reader.integer(4); count = reader.integer(2)
        require(end <= len(raw), 'Entry exceeds input')
        if name == fnv(resource['record']):
            require(type_hash == fnv(resource['definition']['__type']), 'Source system type differs')
            found.append(reader.fields(count, 0)); require(reader.cursor == end, 'Entry length differs')
        reader.cursor = end
    require(len(found) == 1, 'Source entry missing/ambiguous')
    def field(items, name):
        matches = [f for f in items if f['hash'] == fnv(name)]
        require(len(matches) == 1, 'Source field missing/ambiguous: ' + name); return matches[0]
    lst = field(found[0], 'complexEmitterDefinitionData')
    require(lst['wire'] == 0x80 and lst['value']['element'] == 0x82, 'Expected LIST of STRUCT')
    emitter = lst['value']['values'][18]
    require(emitter['typeHash'] == 0x09cde442 and field(emitter['fields'], 'emitterName')['value'] == 'sword2',
            'Wrong source emitter')
    child = field(emitter['fields'], 'reflectionDefinition'); value = child['value']; wire = pin['sourceWire']
    require(child['wire'] == 0x82 and value['typeHash'] == 0x4112ea83 and len(value['fields']) == 2,
            'Reflection child type/count differs')
    require(child['start'] == wire['reflectionField']['offset'] and value['end'] - child['start'] == 45,
            'Source child ownership differs')
    for name, kind, fmt in [('fresnel', 10, '<f'), ('fresnelColor', 13, '<4f')]:
        f = field(value['fields'], name); require(f['wire'] == kind, 'Source field type differs')
        values = struct.unpack_from(fmt, raw, f['start'] + 5)
        expected = next(r for r in wire['authoredFields'] if r['name'] == name)
        require((values[0] if name == 'fresnel' else list(values)) == expected['value'], 'Source value differs')
    require(set(wire['omittedRegisteredFields']) == {f['name'] for f in fields if fnv(f['name']) not in
                {f['hash'] for f in value['fields']}}, 'Source omissions differ')
    math = module(pin['normalMath'], 'reflection_fma32')
    mapping = pin['uniformMapping']['fresnel']; scale = math.f32(4.9); bias = math.f32(.1)
    power = math.fma32(wire['authoredFields'][0]['value'], scale, bias)
    require(power == mapping['packedPower'] == 0.8350000381469727 and struct.pack('<f', power).hex() ==
            mapping['packedPowerFloat32Hex'] == '90c2553f', 'Mapped float32 power differs')
    require(mapping['rgb'] == wire['authoredFields'][1]['value'][:3] and not mapping['alphaRead'], 'Rim RGB differs')
    require(pin['uniformMapping']['reflection']['conditionalParameters'] == [5, 0, 1, 0]
            and pin['uniformMapping']['reflection']['conditionalColor'] == [1, 1, 1, 0], 'Reflection defaults differ')

    old = json.loads(checked(pin['reflectionShaderPin'])); extraction = json.loads(checked(pin['nonreflectiveExtraction']))
    require(extraction['parentPin']['sha256'] == pin['reflectionShaderPin']['sha256'], 'Shader parent pin differs')
    retained = {r['path']: r for r in extraction['inputs']}
    for path, row in retained.items():
        virtual = path.split('/native/', 1)[1]
        require(any(f['path'] == virtual and f['bytes'] == row['bytes'] and f['sha256'] == row['sha256']
                    for f in old['extraction']['files']), 'Shader input not in prior retained archive')
    for row in pin['shaderPrograms']:
        table = next(r for p, r in retained.items() if p.endswith('/' + row['table']))
        toc = checked(table); cursor = 0
        def read(fmt):
            nonlocal cursor
            values = struct.unpack_from('<' + fmt, toc, cursor); cursor += struct.calcsize('<' + fmt)
            return values[0] if len(values) == 1 else values
        def string():
            nonlocal cursor
            length = read('I'); result = toc[cursor:cursor + length].decode(); cursor += length; return result
        require(string() == 'TOC3.0', 'Shader TOC differs')
        count, define_count, _, stage = read('4I'); require(string() == 'baseDefines', 'TOC defines differ')
        defines = [(string(), string()) for _ in range(define_count)]; require(string() == 'shaders', 'TOC table differs')
        hashes = [read('Q') for _ in range(count)]; ids = [read('I') for _ in range(count)]
        key = '385f44a4ff47b22d' if row['flags'] else 'ef46db3751d8e999'
        require(row['flags'] in [[], ['DISABLE_FOW']] and row['definesHash'] == key and stage == row['stage']
                and cursor == len(toc) and dict(zip(hashes, ids))[int(key, 16)] == row['programId'], 'Shader selection differs')
        require('REFLECTIVE' in dict(defines) and 'REFLECTIVE' not in row['flags'], 'Expected nonreflective selection')
        bundle = checked(retained[row['bundle']]); metal = checked(row['metallib']); offset = row['programOffset']
        require(struct.unpack_from('<I', bundle, offset - 4)[0] == len(metal)
                and bundle[offset:offset + len(metal)] == metal, 'Shader bundle program differs')
        bc = checked(row['bitcode']); offset = row['bitcode']['offset']
        require(bc[:4] == b'BC\xc0\xde' and metal[offset:offset + len(bc)] == bc, 'AIR bytes differ')
        text = checked(row['disassembly']).decode()
        require('@wrapped_main' in text and 'texturecube' not in text.lower(), 'Unexpected shader/cube')
        if row['programId'] == 1:
            require('air.location_index", i32 2' in text and '@air.fast_powr.f32(float %101, float %102)' in text
                    and '%107 = fmul fast <3 x float> %106, %79' in text, 'Rim vertex arithmetic differs')
        if row['programId'] == 9:
            require('%27 = fmul fast <3 x float> %26, %2' in text and '@air.fast_clamp.v3f32' in text,
                    'Rim fragment arithmetic differs')
    require(len(pin['shaderPrograms']) == 4 and pin['shaderFormula']['noReflectionCube'], 'Expected four rim-only variants')
    return pin


def main():
    cli = argparse.ArgumentParser(description=__doc__); cli.add_argument('--check', action='store_true', required=True)
    cli.add_argument('--pin', type=Path, default=ROOT / 'docs/reference/leona-native-reflection-inputs.json')
    pin = verify(cli.parse_args().pin)
    print(f'PASS: reflection type/defaults, owned sword2 BIN fields, native uniform packing, '
          f'{len(pin["llvmRecords"])} bounded native functions, four rim-only Metal/AIR variants. Offline/static.')


if __name__ == '__main__': main()
