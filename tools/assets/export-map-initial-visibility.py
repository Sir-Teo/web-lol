"""Preserve explicit source default visibility without inferring controller logic."""
import hashlib
import json
from pathlib import Path


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


materials_path = '.cache/map-materials.json'
mesh_path = '.cache/map-mesh-info.json'
gltf_path = 'public/assets/maps/rift.gltf'
assert sha(materials_path) == 'b2ba02f51824f5d2a1a3a6101d0bfa989d37aae1b91a90335cd4cbc6d551505b'
# Produced by the pinned converter's map-mesh-info export from the mapgeo below.
assert sha(mesh_path) == 'e8a4c9343a37f88b855a11aee6a2e87b92bc5021ae7d5c41cc0ad1724cb7eba0'
extraction = json.loads(Path('docs/reference/map-extraction.json').read_text())
source = next(f for f in extraction['files'] if f['path'].endswith('base_srx.mapgeo'))
assert sha('.cache/map-sources/' + source['path']) == source['sha256']
materials = json.loads(Path(materials_path).read_text())
meshes = {m['Name']: m for m in json.loads(Path(mesh_path).read_text())}
gltf = json.loads(Path(gltf_path).read_text())
hidden, controllers, unresolved = [], {}, {}
for node in gltf['nodes']:
    if 'mesh' not in node:
        continue
    mesh = meshes[node['name'].split('.')[-1]]
    controller_hash = mesh['VisibilityControllerPathHash']
    if not controller_hash:
        continue
    key = '{%08x}' % controller_hash
    controller = materials[key]
    controllers[key] = controller
    if controller.get('DefaultVisible') is False:
        assert controller['__type'] in ('{c406a533}', '{ec733fe2}')
        hidden.append({'node': node['name'], 'controller': key})
    elif controller['__type'] in ('ChildMapVisibilityController', 'MutatorMapVisibilityController'):
        unresolved.setdefault(key, []).append(node['name'])
    else:
        assert controller['__type'] == '{ec733fe2}' and 'DefaultVisible' not in controller
assert len(hidden) == 20
output = {'hiddenNodes': sorted(x['node'] for x in hidden)}
Path('src/content/rift-initial-visibility.json').write_text(json.dumps(output, indent=2) + '\n')
audit = {
    'referenceVersion': extraction['referenceVersion'],
    'sources': {p: sha(p) for p in (materials_path, mesh_path, gltf_path)},
    'mapGeometry': source,
    'controllers': controllers,
    'hidden': hidden,
    'unresolved': unresolved,
    'policy': 'Apply explicit DefaultVisible false. Preserve child and mutator states until their evaluation is recovered. No dynamic terrain transition implementation.',
    'outputSHA256': sha('src/content/rift-initial-visibility.json'),
}
Path('docs/reference/map-initial-visibility.json').write_text(json.dumps(audit, indent=2) + '\n')
print(json.dumps({'hidden': len(hidden), 'unresolvedControllers': len(unresolved)}))
