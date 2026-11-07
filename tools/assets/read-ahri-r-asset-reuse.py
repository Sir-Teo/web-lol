"""Audit R transport reuse without publishing assets or assigning runtime bindings."""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path.cwd()
OUTPUT = ROOT / 'docs/reference/ahri/r-asset-reuse.json'
INPUTS = [
    'docs/reference/ahri/r-texture-transports.json',
    'docs/reference/ahri/r-mesh-transports.json',
    *[f'src/content/{name}.json' for name in [
        'ahri-q-cast-particles', 'ahri-q-projectile-particles',
        'ahri-w-particles', 'ahri-e-particles',
    ]],
]

def require(condition, message):
    if not condition:
        raise ValueError(message)

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def safe(path):
    require(not path.is_symlink() and path.is_file(), f'Missing or linked input: {path}')
    for parent in path.parents:
        if parent == ROOT:
            break
        require(not parent.is_symlink(), f'Linked asset parent: {parent}')
    return path

def verify(path, row):
    raw = safe(path).read_bytes()
    require(len(raw) == row['bytes'] and digest(raw) == row['sha256'], f'Asset bytes differ: {path}')

inputs = [json.loads(safe(ROOT / name).read_bytes()) for name in INPUTS]
rows = []
for kind, transports in [('textures', inputs[0]['textures']), ('meshes', inputs[1]['meshes'])]:
    for transport in transports:
        packed = transport if kind == 'textures' else transport['glb']
        verify(ROOT / packed['path'], packed)
        candidates = []
        for filename, content in zip(INPUTS[2:], inputs[2:]):
            for asset in content.get(kind, []):
                if 'source' not in asset or asset['source']['path'] != transport['source']['path']:
                    continue
                require(asset['source'] == transport['source'], 'Same source path has different native identity')
                require(all(asset[key] == packed[key] for key in ['bytes', 'sha256']), 'Shared transport bytes differ')
                if kind == 'textures':
                    require(all(asset[key] == transport[key] for key in ['width', 'height', 'rectangles', 'rgbaSha256']), 'Shared mip transport differs')
                verify(ROOT / 'public' / asset['url'], asset)
                candidates.append({'content': filename, 'url': asset['url'],
                                   'declaredOwner': asset.get('textureOwner' if kind == 'textures' else 'geometryOwner')})
        rows.append({'kind': kind, 'source': transport['source'], 'bytes': packed['bytes'],
                     'sha256': packed['sha256'], 'existingBindings': candidates})
record = {'format': 1, 'scope': 'Byte-exact transport reuse candidates; no publication or renderer binding',
          'producerSha256': digest(Path(__file__).read_bytes()),
          'unidentifiedCandidatePolicy': 'Entries without native source identity are excluded from reuse proof',
          'inputs': [{'path': name, 'sha256': digest(safe(ROOT / name).read_bytes())} for name in INPUTS],
          'summary': {kind: {'total': sum(r['kind'] == kind for r in rows),
                             'reusable': sum(r['kind'] == kind and bool(r['existingBindings']) for r in rows),
                             'newTransportBytes': sum(r['bytes'] for r in rows if r['kind'] == kind and not r['existingBindings'])}
                      for kind in ['textures', 'meshes']}, 'assets': rows}
encoded = (json.dumps(record, indent=2) + '\n').encode()
require(sys.argv[1:] in [[], ['--check']], 'Only --check is supported')
if sys.argv[1:]:
    require(OUTPUT.read_bytes() == encoded, 'Reuse reading differs')
else:
    require(not OUTPUT.exists() or OUTPUT.read_bytes() == encoded, 'Refusing to overwrite different reading')
    OUTPUT.write_bytes(encoded)
print(json.dumps({'result': 'passed', **record['summary']}))
