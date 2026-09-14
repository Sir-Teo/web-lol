"""Preserve flight emitter depth flags with the pinned interpretation provenance."""
import hashlib
import json
from pathlib import Path

source = Path('docs/reference/lux-basic-attack.json')
pin = json.loads(source.read_text())
interpretation = json.loads(Path('docs/reference/lux-impact-depth.json').read_text())['interpretation']
for item in interpretation['files']:
    assert hashlib.sha256(Path('.cache/ltk-manager', item['path']).read_bytes()).hexdigest() == item['sha256']
profiles = {}
for emitter in pin['data']['complexEmitterDefinitionData']:
    assert not emitter.get('{33f36f05}', False)
    flags = emitter.get('{6563bee8}', 0)
    assert isinstance(flags, int) and 0 <= flags <= 255
    profiles[emitter['emitterName']] = {'miscRenderFlags': flags}
assert profiles == {'crescentwhite': {'miscRenderFlags': 0}, 'Trail': {'miscRenderFlags': 0}, 'hoop': {'miscRenderFlags': 1}}
Path('src/content/lux-flight-depth.json').write_text(json.dumps(profiles, indent=2) + '\n')
report = {
    'sourceDefinitionSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'sourceBinSha256': pin['sourceBinSha256'],
    'interpretation': interpretation,
    'disableDepthTestMask': 1,
    'emitters': [{
        'name': name, **profile, 'depthTest': not bool(profile['miscRenderFlags'] & 1)
    } for name, profile in profiles.items()],
    'limitations': [
        'Absent source miscRenderFlags uses the zero default.',
        'The bit interpretation is from an external reconstruction, not a local native-client capture.',
        'This does not establish native draw ordering or complete material state.'
    ]
}
Path('docs/reference/lux-flight-depth.json').write_text(json.dumps(report, indent=2) + '\n')
print('Exported depth flags: crescentwhite/Trail test depth; hoop disables depth testing')
