"""Read-only offline source BIN and TEX-to-PNG verification, not native rendering."""
from pathlib import Path
from io import BytesIO
import hashlib
import json
import struct
from leona_w_source import decode_mesh
from PIL import Image
from cdtb import binfile
from cdtb.export import TexConverter
from xxhash import xxh64_intdigest

sha = lambda b: hashlib.sha256(b).hexdigest()
pin_path = Path('docs/reference/leona-w-particles.json')
pin = json.loads(pin_path.read_text())
decoded = json.loads(Path('docs/reference/leona-w-particles-decoded.json').read_text())
model = json.loads(Path('docs/reference/leona-model.json').read_text())
assert pin['extraction']['manifest'] == model['extraction']['manifest']
assert pin['extraction']['archive'] == 'DATA/FINAL/Champions/Leona.wad.client'
assert decoded['sourcePinSha256'] == sha(pin_path.read_bytes())
fields, types, names, assets = {}, {}, {}, {}
def collect(v):
    if isinstance(v,dict):
        for k,c in v.items():
            if not k.startswith('{'): fields[binfile.compute_binhash(k)] = k
            if k == '__type' and not c.startswith('{'): types[binfile.compute_binhash(c)] = c
            collect(c)
    elif isinstance(v,list):
        for c in v: collect(c)
    elif isinstance(v,str) and v.isascii() and not v.startswith('{'):
        names[binfile.compute_binhash(v)] = v
        assets[xxh64_intdigest(v.lower())] = v
collect(pin['resources'])
for table, mapping in [(binfile.hashfile_binfields,fields),(binfile.hashfile_bintypes,types),
                       (binfile.hashfile_binhashes,names),(binfile.hashfile_binentries,names),
                       (binfile.hashfile_binpaths,assets)]:
    table.hashes = mapping
root = Path('.cache/leona-w-particle-sources')
bins, images, meshes = {}, {}, {}
for p in pin['extraction']['files']:
    raw = (root / (p['wadPathHash']+Path(p['path']).suffix)).read_bytes()
    assert len(raw) == p['bytes'] and sha(raw) == p['sha256']
    if p['path'].endswith('.bin'):
        bins[p['path']] = json.loads(json.dumps(binfile.BinFile(BytesIO(raw)).to_serializable()))
    elif p['path'].endswith('.scb'):
        meshes[p['path']] = decode_mesh(raw, p)
    else:
        assert p['path'].endswith('.tex')
        images[p['path']] = Image.open(BytesIO(TexConverter.tex_to_dds(raw))).convert('RGBA')
for key,r in pin['resources'].items():
    assert r['definition'] == bins[r['sourceBin']][r['record']], key
for t in decoded['textures']:
    raw = Path(t['path']).read_bytes()
    assert len(raw) == t['bytes'] and sha(raw) == t['sha256']
    image = Image.open(BytesIO(raw)).convert('RGBA')
    assert image.size == (t['width'],t['height']) == images[t['source']['path']].size
    assert image.tobytes() == images[t['source']['path']].tobytes()
    assert sha(image.tobytes()) == t['rgbaSha256']
assert len(bins) == 3 and len(images) == 36 and len(meshes) == 6

# Read GLB accessors independently of the NodeIO conversion/round-trip path.
# Raw custom attributes retain source coordinates and color bytes without
# treating either color stream as a native material input.
def glb_attributes(raw):
    assert raw[:4] == b'glTF' and struct.unpack_from('<II', raw, 4) == (2, len(raw))
    size, kind = struct.unpack_from('<II', raw, 12)
    assert kind == 0x4e4f534a
    gltf = json.loads(raw[20:20 + size])
    at = 20 + size
    bin_size, bin_kind = struct.unpack_from('<II', raw, at)
    assert bin_kind == 0x004e4942 and at + 8 + bin_size == len(raw)
    binary = raw[at + 8:]
    assert len(gltf['meshes']) == 1 and len(gltf['meshes'][0]['primitives']) == 1
    primitive = gltf['meshes'][0]['primitives'][0]
    assert 'indices' not in primitive and primitive.get('mode', 4) == 4
    attrs = {}
    for name, index in primitive['attributes'].items():
        accessor = gltf['accessors'][index]
        view = gltf['bufferViews'][accessor['bufferView']]
        assert view.get('buffer', 0) == 0 and 'sparse' not in accessor
        n = {'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[accessor['type']]
        fmt = {5121: 'B', 5126: 'f'}[accessor['componentType']]
        width = struct.calcsize(fmt) * n
        stride = view.get('byteStride', width)
        base = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        assert stride >= width
        values = [v for i in range(accessor['count'])
            for v in struct.unpack_from('<' + fmt * n, binary, base + i * stride)]
        attrs[name] = (values, fmt)
    return attrs

skin = model['skin']['data']['Characters/Leona/Skins/Skin0/Resources']['resourceMap']
assert set(pin['resources']) == {k for k in skin if k.startswith('Leona_W_') and 'DoomBot' not in k}
expected_systems = decoded['systems']
assert set(expected_systems) == set(pin['resources'])
for key, resource in pin['resources'].items():
    assert resource['record'] == skin[key]
    entries = resource['definition']['complexEmitterDefinitionData']
    assert len(expected_systems[key]['emitters']) == len(entries)
    for i, e in enumerate(entries):
        record = expected_systems[key]['emitters'][i]
        assert record['index'] == i and record['name'] == e['emitterName']
        assert record['disabled'] == e.get('disabled', False)
        assert record['primitive'] == e.get('primitive', {}).get('__type', 'billboard')
        assert record['explicitFields'] == sorted(e)
assert len(decoded['meshes']) == 6 and len(decoded['textures']) == 36
for m in decoded['meshes']:
    source = meshes.pop(m['source']['path'])
    path = Path('public' + m['output']['path'])
    raw = path.read_bytes()
    assert len(raw) == m['output']['bytes'] and sha(raw) == m['output']['sha256']
    assert json.loads(path.with_suffix('.json').read_text()) == m
    attrs = glb_attributes(raw)
    expected = dict(POSITION=[struct.unpack('<f', struct.pack('<f', v * 0.01))[0] for v in source['positions']],
        _SOURCE_POSITION=source['positions'], TEXCOORD_0=source['uv'])
    if source['expandedVertexBGRA']:
        expected['_SOURCE_VERTEX_BGRA'] = source['expandedVertexBGRA']
    if source['sourceFaceRGB']:
        expected['_SOURCE_FACE_RGB'] = source['sourceFaceRGB']
    assert set(attrs) == set(expected), path
    for name, (values, fmt) in attrs.items():
        assert values == expected[name], (path, name)
        assert sha(struct.pack('<' + fmt * len(values), *values)) == m['attributeSha256'][name]
    assert m['sourceVertices'] == source['sourceVertices'] and m['triangles'] == source['triangles']
    assert m['sourceFlags'] == source['flags'] and m['centralPoint'] == list(source['centralPoint'])
    assert m['rawSourceBounds'] == list(source['sourceBounds'])
    assert m['measuredMinMax'] == source['measuredMinMax']
    assert m['sourceIndicesSha256'] == sha(struct.pack('<' + 'I' * len(source['sourceIndices']), *source['sourceIndices']))
assert not meshes
assert decoded['acceptance']['runtimeIntegrated'] is False
assert decoded['acceptance']['nativeRenderingVerified'] is False
print(json.dumps(dict(result='passed', systems=len(pin['resources']), emitters=50,
    enabled=30, disabled=20, textures=len(images), meshes=len(decoded['meshes']),
    sourceBytes=sum(p['bytes'] for p in pin['extraction']['files']),
    runtimeIntegrated=False, nativeRenderingVerified=False)))
