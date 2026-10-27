"""Deliver the complete four-emitter Meditate buff closure for local rendering."""
from pathlib import Path
import argparse
import json
import math
import runpy
from masteryi_w_particles import SOURCE_ROOT, checked, load, require, strings
from masteryi_w_buff import profiles
from masteryi_q_decode import sha
from masteryi_audio_graph import write_outputs

TRANSPORT = Path('docs/reference/masteryi/w-particle-texture-transport.json')
TRANSPORT_SHA256 = '66ce933143a662f0f2506b96520d2d4f6e7ab206a1cb58d8da6b3b94e01e5cfd'
MESH_AUDIT_SHA256 = '23722a08d9a06f9bb9fbb0c316e9d6d04add2b3efb93a1e13716d5d1c279c1c0'


def json_bytes(value): return (json.dumps(value, indent=2, allow_nan=False) + '\n').encode()


def generate_outputs():
    pin, _ = load(); raw = checked(TRANSPORT, TRANSPORT_SHA256); transport = json.loads(raw)
    packer = runpy.run_path(str(Path(__file__).with_name('pack-masteryi-w-textures.py')))
    packer['verify'](transport, SOURCE_ROOT)
    require((packer['OUTPUT']/'textures.json').read_bytes() == raw, 'Staged Meditate texture transport differs')
    selected = {s.lower() for s in strings(pin['resources']['MasterYi_W_Buf']['definition']) if s.lower().endswith('.tex')}
    require(len(selected) == 6, 'Meditate buff texture closure differs')
    known = json.loads(Path('src/content/masteryi-q-contact-particles.json').read_text())['textures'] + json.loads(Path('src/content/masteryi-w-cast-particles.json').read_text())['textures']
    urls, assets, outputs = {}, [], {}
    for texture in transport['textures']:
        if texture['source']['path'] not in selected: continue
        png = checked(texture['path'], texture['sha256'], texture['bytes'])
        shared = next((t for t in known if t['sha256'] == texture['sha256'] and t['bytes'] == texture['bytes']), None)
        url = shared['url'] if shared else f"assets/effects/masteryi-w-buff-{texture['source']['wadPathHash']}.png"
        urls[texture['source']['path']] = url
        assets.append({**texture, 'key': texture['source']['wadPathHash'], 'url': url})
        outputs[Path('public')/url] = png
    require(len(assets) == 6, 'Missing Meditate buff texture')
    mesh = json.loads(checked('.cache/masteryi-w-packed-meshes/masteryi-w-heal.glb.json', MESH_AUDIT_SHA256))
    require(mesh['output']['sha256'] == '538220d5c8cef2a643f5381ea40a27eb58b815f6b4908d33cd1a831212915e4b' and
            mesh['validation'] == {'errors': 0, 'warnings': 0, 'roundTripAttributesExact': True} and
            mesh['sourceVertices'] == 403 and mesh['triangles'] == 733 and mesh['flags'] == 5 and
            len(bytes.fromhex(mesh['tailHex'])) == 24 and mesh['sourceHasVertexColors'] is False and mesh['normalsGenerated'] is False,
            'Meditate buff GLB provenance differs')
    mesh_url = 'assets/models/masteryi-w-buff-heal.glb'; output = mesh['output']
    outputs[Path('public')/mesh_url] = checked(output['path'], output['sha256'], output['bytes'])
    defaults_path = Path('docs/reference/garen-spin-defaults.json')
    defaults_raw = checked(defaults_path, '51aaa77125b84ae77e05586d31c7e45de3037028345222a0addd1ed188debefb')
    fields_path = Path('docs/reference/masteryi/w-fields-reader.json')
    fields_raw = checked(fields_path, 'b67cb8e90ae6521816579a06ae1b4274bd6ae11befc28d75fca948fd8abff3c7')
    require(json.loads(fields_raw)['defaults']['orbitalDirection'] == [0, 1, 0], 'Pinned orbital default differs')
    compiled = profiles(pin, urls, mesh_url, json.loads(defaults_raw)['defaults'])
    ends = []
    for p in compiled:
        rate = p['rate']['values'][0][0]
        require(type(p['emitterLife']) in (int, float) and math.isfinite(p['emitterLife']) and p['emitterLife'] > 0 and rate > 0,
                'Meditate emission clock differs')
        count = 1 if p['single'] else max(1, math.floor(math.floor(p['emitterLife']*60)*rate/60))
        last = 1 if p['single'] else math.ceil(count*60/rate)
        probability = p['life']['probabilities']
        peak = max(v[0] for v in p['life']['values']) * (max(probability[0]['values'] or [probability[0]['single']]) if probability else 1)
        ends.append(last + math.ceil(peak*60) + 1)
    retention = max(ends); require(retention == 361, 'Meditate buff retention differs')
    content = {'textures': assets, 'mesh': {'url': mesh_url, 'sha256': output['sha256'], 'bytes': output['bytes']}, 'profiles': compiled}
    outputs[Path('src/content/masteryi-w-buff-particles.json')] = json_bytes(content)
    outputs[Path('src/content/masteryi-w-buff-timing.ts')] = (
        '// Complete buff emission window plus maximum finite particle tail.\n'
        'export const MEDITATE_BUFF_TAIL_TICKS = 121;\n'
        f'export const MEDITATE_BUFF_MAX_HISTORY_TICKS = {retention};\n').encode()
    reading = {'format': 1, 'sourcePinSha256': sha(Path('docs/reference/masteryi/w-particles.json').read_bytes()),
        'transport': {'path': str(TRANSPORT), 'sha256': TRANSPORT_SHA256}, 'mesh': mesh,
        'readerDefaults': {'path': str(defaults_path), 'sha256': sha(defaults_raw)},
        'profileSha256': sha(json_bytes(content)), 'historyTicks': retention, 'tailTicks': 121,
        'fieldReader': {'path': str(fields_path), 'sha256': sha(fields_raw)},
        'limits': ['Complete four-emitter W_Buf only. Tenacity and damage systems remain separate.',
            'Accepted local W dispatch, first-update grid, actor-root source-X reflection, indexed draws, source shape interpretation and fixed-grid field force integration are local adapters; native callbacks/frames/RNG remain unverified.',
            'Exact field-name hash candidates are recorded separately; raw source hashes stay unchanged.',
            'Omitted shader/UV controls use explicit shared local defaults, including alphaRef 5/255, repeated base textures, clamped linear lookup, white neutral lookup when absent and identity UV transforms.',
            'Source linger values are retained without extending visible particle lifetimes. No sound is inferred from W_Buf.']}
    outputs[Path('docs/reference/masteryi/w-buff-particle-reading.json')] = json_bytes(reading)
    return list(outputs.items()), content, reading


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--check', action='store_true'); args = parser.parse_args()
    outputs, content, reading = generate_outputs(); write_outputs(outputs, args.check)
    print(json.dumps({'profiles': len(content['profiles']), 'textures': len(content['textures']),
                      'authoredMips': sum(len(t['rectangles']) for t in content['textures']),
                      'historyTicks': reading['historyTicks']}))
