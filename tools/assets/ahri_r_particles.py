"""Frozen Ahri R particle definitions and exact native dependency closure."""
from pathlib import Path
import hashlib
import json
import re

PIN = Path('docs/reference/ahri/r-particles.json')
PIN_SHA256 = '3f283be14704aa77c680d2c11eb67441d8376586835e43283ae7be440c956991'
MODEL = Path('docs/reference/ahri-model.json')
MODEL_SHA256 = '74d0b55f5aad08646fbd24f660ed533bc8fd5798e8a60dc0983d97960b47a377'
PARSER_SHA256 = '0c1825135763c98f705535eecf2b4b1a8e667c53181e9e1d43ad7a83d1d844fd'
SOURCE_ROOT = Path('.cache/ahri-r-particles/sources')
SYSTEMS = {'Ahri_R_mis_02', 'Ahri_R_Ready_tar', 'Ahri_R_Tar', 'Ahri_R_cas', 'Ahri_R_Indicator_2', 'Ahri_R_Ready_Aura', 'Ahri_R_TextureSwaps', 'Ahri_R_Indicator_3', 'Ahri_R_Eyes', 'Ahri_R_mis', 'Ahri_R_Indicator_1'}


def require(condition, message):
    if not condition: raise ValueError(message)


def checked(path, sha256, size=None):
    raw = Path(path).read_bytes()
    require((size is None or len(raw) == size) and hashlib.sha256(raw).hexdigest() == sha256, 'Frozen particle input differs: ' + str(path))
    return raw


def strings(value):
    if isinstance(value, dict):
        for child in value.values(): yield from strings(child)
    elif isinstance(value, list):
        for child in value: yield from strings(child)
    elif isinstance(value, str): yield value


def validate(pin, model):
    require(pin['modelSha256'] == MODEL_SHA256 and pin['parserSha256'] == PARSER_SHA256, 'Particle provenance changed')
    resources = model['skin']['data']['Characters/Ahri/Skins/Skin0/Resources']['resourceMap']
    require(pin['nullResources'] == {'Ahri_R_Transform_Out': '{00000000}'} and resources['Ahri_R_Transform_Out'] == '{00000000}', 'Native R null resource differs')
    require(set(pin['resources']) == SYSTEMS == {k for k in resources if k.startswith('Ahri_R_') and resources[k] != '{00000000}'}, 'Incomplete Ahri R resource closure')
    linked = {p.lower() for p in model['skin']['data']['__linked']}
    bins = {'data/characters/ahri/skins/skin0.bin'}
    for key, row in pin['resources'].items():
        require(row['record'] == resources[key] and row['sourceBin'] in linked, 'Particle binding differs')
        require(row['definition']['objectPath'] == row['record'] and row['definition']['__type'] == 'VfxSystemDefinitionData', 'Particle record identity differs')
        bins.add(row['sourceBin'])
    assets = {s.lower() for row in pin['resources'].values() for s in strings(row['definition']) if s.lower().startswith('assets/')}
    require(len(bins) == 8 and len(assets) == 55 and all(p.endswith(('.tex', '.scb')) for p in assets), 'Ahri R dependency closure changed')
    require(not [s for row in pin['resources'].values() for s in strings(row['definition']) if re.fullmatch(r'\{[0-9a-f]{16}\}', s)], 'Unresolved native PATH dependency')
    rows = pin['extraction']['files']
    require(pin['extraction']['archive'] == 'DATA/FINAL/Champions/Ahri.wad.client' and pin['extraction']['referenceVersion'] == '16.18.8175716', 'Particle archive/version changed')
    require(len(rows) == 63 and len({r['path'] for r in rows}) == 63 and {r['path'] for r in rows} == bins | assets, 'Missing/duplicate/extra particle files')
    by_path = {r['path']: r for r in rows}
    for row in pin['resources'].values():
        require(row['nativeSha256'] == by_path[row['sourceBin']]['sha256'], 'Particle BIN identity differs')
    require(sum(len(row['definition'].get('complexEmitterDefinitionData', [])) for row in pin['resources'].values()) == 55, 'Emitter count changed')
    return bins, assets


def load(pin_path=PIN, model_path=MODEL):
    pin = json.loads(checked(pin_path, PIN_SHA256)); model = json.loads(checked(model_path, MODEL_SHA256))
    validate(pin, model)
    return pin, model


def cache_path(root, row):
    require(re.fullmatch(r'[0-9a-f]{16}', row['wadPathHash']) is not None, 'Invalid flat source hash')
    extension = Path(row['path']).suffix
    require(extension in {'.bin', '.tex', '.scb'}, 'Unknown native particle extension')
    target = Path(root) / (row['wadPathHash'] + extension)
    require(not any(p.is_symlink() for p in [target, *target.parents]), 'Native particle input cannot contain symlinks')
    return target


def check_files(pin, root):
    for row in pin['extraction']['files']: checked(cache_path(root, row), row['sha256'], row['bytes'])


def verify_native(pin, model, root):
    check_files(pin, root)
    import io
    import runpy
    from cdtb import binfile
    from xxhash import xxh64_intdigest
    require(Path(binfile.__file__).resolve() == Path('.tools/cdtb/cdtb/binfile.py').resolve(), 'Unexpected particle parser path')
    checked(binfile.__file__, PARSER_SHA256)
    same = runpy.run_path(str(Path(__file__).with_name('verify-ahri-character.py')))['same']
    fields, types, names, entries, paths = {}, {}, {}, {}, {}
    def collect(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if not key.startswith('{'):
                    fields[binfile.compute_binhash(key)] = key
                    names[binfile.compute_binhash(key)] = key
                if key == '__type' and isinstance(child, str) and not child.startswith('{'): types[binfile.compute_binhash(child)] = child
                collect(child)
        elif isinstance(value, list):
            for child in value: collect(child)
        elif isinstance(value, str) and value.isascii() and not value.startswith('{'):
            names[binfile.compute_binhash(value)] = value
            entries[binfile.compute_binhash(value)] = value
            paths[xxh64_intdigest(value.lower())] = value
    collect(model['skin']['data']); collect(pin['resources'])
    for key in model['skin']['data']: entries[binfile.compute_binhash(key)] = key
    for row in pin['resources'].values(): entries[binfile.compute_binhash(row['record'])] = row['record']
    for table, mapping in [(binfile.hashfile_binfields, fields), (binfile.hashfile_bintypes, types), (binfile.hashfile_binhashes, names), (binfile.hashfile_binentries, entries), (binfile.hashfile_binpaths, paths)]: table.hashes = mapping
    parsed = {}
    for row in pin['extraction']['files']:
        if row['path'].endswith('.bin'):
            parsed[row['path']] = json.loads(json.dumps(binfile.BinFile(io.BytesIO(cache_path(root, row).read_bytes())).to_serializable()))
        require(f'{xxh64_intdigest(row["path"]):016x}' == row['wadPathHash'], 'Native WAD path hash differs')
    require(same(parsed['data/characters/ahri/skins/skin0.bin'], model['skin']['data']), 'Complete native skin/resource binding differs')
    for key, row in pin['resources'].items():
        require(row['record'] in parsed[row['sourceBin']] and same(parsed[row['sourceBin']][row['record']], row['definition']), 'Complete native particle record differs: ' + key)
    rows = pin['extraction']['files']
    return {'systems': len(pin['resources']),
            'emitters': sum(len(r['definition'].get('complexEmitterDefinitionData', [])) for r in pin['resources'].values()),
            'bins': sum(r['path'].endswith('.bin') for r in rows),
            'textures': sum(r['path'].endswith('.tex') for r in rows),
            'meshes': sum(r['path'].endswith('.scb') for r in rows)}
