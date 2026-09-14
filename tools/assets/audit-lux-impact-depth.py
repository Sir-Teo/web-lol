"""Record source flags and the pinned external reconstruction used to interpret bit 0."""
import hashlib, json
from pathlib import Path
revision = '65a7d2a746b9d02d65dab788b5f7b8198d5e555e'
files = []
for name, expected in [
    ('enums.ts', '229255a8ecd474ba46003662e271a49de01aa1db756cebe4e281f3cf3b96e3e0'),
    ('blend.ts', 'd01381d75d574c7c31c8ac2f09d44a746a9aed6523db0af90fa507afe3dc72d9'),
]:
    path = 'src/modules/workshop/bin/vfx/' + name
    digest = hashlib.sha256(Path('.cache/ltk-manager', path).read_bytes()).hexdigest()
    assert digest == expected
    files.append({'path': path, 'sha256': digest,
                  'url': f'https://github.com/LeagueToolkit/ltk-manager/blob/{revision}/{path}'})
pin = Path('docs/reference/lux-attack-impact.json')
data = json.loads(pin.read_text())
emitters = []
for system, record in data['records'].items():
    for emitter in record['complexEmitterDefinitionData']:
        if emitter.get('{33f36f05}', False): continue
        flags = emitter.get('{6563bee8}', 0)
        assert flags == 1
        emitters.append({'system': system, 'name': emitter['emitterName'], 'miscRenderFlags': flags,
                         'depthTest': False, 'authoredDepthPushPull': emitter.get('DepthPushPull'),
                         'authoredDepthBiasFactors': emitter.get('depthBiasFactors')})
assert len(emitters) == 8
report = {'sourceDefinitionSha256': hashlib.sha256(pin.read_bytes()).hexdigest(),
          'field': {'name': 'miscRenderFlags', 'hash': '6563bee8', 'disableDepthTestMask': 1},
          'interpretation': {'repository': 'LeagueToolkit/ltk-manager', 'revision': revision, 'files': files},
          'activeEmitters': emitters,
          'limitations': ['Bit interpretation uses the pinned external source reconstruction, not a local native-client capture.',
                         'This audit does not establish native draw ordering, material variant, orientation or target-specific effect dispatch.']}
Path('docs/reference/lux-impact-depth.json').write_text(json.dumps(report, indent=2)+'\n')
print('Verified all eight active normal/critical emitter records request no depth test')
