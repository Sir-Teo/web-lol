"""Export all nine Sunlight emitters; reject unhandled source fields and dynamics."""
from pathlib import Path
import hashlib
import json
import sys

sha = lambda b: hashlib.sha256(b).hexdigest()
pin_path = Path('docs/reference/leona-sunlight-particles.json')
pin = json.loads(pin_path.read_text())
decoded = json.loads(Path('docs/reference/leona-sunlight-particles-decoded.json').read_text())
assert decoded['sourcePinSha256'] == sha(pin_path.read_bytes())
defaults_path = Path('docs/reference/garen-spin-defaults.json')
defaults = json.loads(defaults_path.read_text())['defaults']
textures = {t['source']['path']: t['path'].removeprefix('public/') for t in decoded['textures']}
for t in decoded['textures']:
    assert sha(Path(t['path']).read_bytes()) == t['sha256']

def vector(v): return v if isinstance(v,list) else [v]
def birth(value, fallback):
    if isinstance(value,list): value = dict(constantValue=value)
    dynamics = value.get('dynamics')
    if dynamics: assert dynamics['times'] == [0] and len(dynamics['values']) == 1
    return dict(value=vector(dynamics['values'][0] if dynamics else value.get('constantValue',fallback)),
        probabilities=[dict(times=t.get('keyTimes',[]),values=t.get('keyValues',[]),single=t.get('singleValue',1))
            for t in dynamics.get('probabilityTables',[])] if dynamics else None)
def curve(value, fallback):
    dynamics = value.get('dynamics')
    if dynamics:
        for t in dynamics.get('probabilityTables',[]):
            assert not t.get('keyTimes') and not t.get('keyValues') and t.get('singleValue',1) == 1
        return dict(times=dynamics['times'], values=[vector(v) for v in dynamics['values']])
    return dict(times=[0], values=[vector(value.get('constantValue',fallback))])

profiles = []
allowed = set('rate particleLifetime particleLinger lifetime isSingleParticle emitterName bindWeight FlexShapeDefinition SpawnShape particleColorTexture birthColor pass meshRenderFlags miscRenderFlags isUniformScale birthScale0 scale0 texture colorLookUpScales colorLookUpOffsets birthRotation0 birthRotationalVelocity0 birthVelocity birthDrag __type'.split())
for system, role in [('Leona_P_tar_buf','mark'),('Leona_P_tar_buf_champ','champion'),('Leona_P_tar_hit','hit')]:
    definition = pin['resources'][system]['definition']
    assert set(definition) <= set('complexEmitterDefinitionData particleName particlePath objectPath soundOnCreateDefault flags __type'.split())
    for index,e in enumerate(definition['complexEmitterDefinitionData']):
        assert set(e) <= allowed, set(e)-allowed
        assert e.get('bindWeight',{}).get('constantValue',0) in [0,1]
        shape = e.get('SpawnShape',{})
        assert set(shape) <= {'emitOffset','__type'}
        flex = e.get('FlexShapeDefinition',{})
        assert set(flex) <= {'scaleEmitOffsetByBoundObjectSize','__type'}
        assert e.get('meshRenderFlags',0) == 0
        profiles.append(dict(system=system,role=role,index=index,name=e['emitterName'],
            texture=textures[e['texture'].lower()],lookup=textures[e['particleColorTexture'].lower()],
            rate=e['rate']['constantValue'],single=bool(e.get('isSingleParticle',False)),
            emitterLife=e['lifetime'],linger=e.get('particleLinger',0),life=birth(e['particleLifetime'],3),
            bind=e.get('bindWeight',{}).get('constantValue',0),boundOffset=flex.get('scaleEmitOffsetByBoundObjectSize'),
            offset=shape.get('emitOffset',[0,0,0]),velocity=birth(e.get('birthVelocity',{}),[0,0,0]),drag=birth(e.get('birthDrag',{}),[0,0,0]),
            size=birth(e['birthScale0'],defaults['birthScale']),scale=curve(e.get('scale0',{}),[1,1,1]),uniform=bool(e.get('isUniformScale',False)),
            rotation=birth(e.get('birthRotation0',{}),[0,0,0]),spin=birth(e.get('birthRotationalVelocity0',{}),[0,0,0]),
            birthColor=birth(e.get('birthColor',{}),[1,1,1,1]),color=defaults['color'],
            lookupTypes=defaults['lookupTypes'],lookupScales=e.get('colorLookUpScales',defaults['lookupScales']),lookupOffsets=e.get('colorLookUpOffsets',defaults['lookupOffsets']),
            blend=0,renderOrder=e.get('pass',0),miscRenderFlags=e.get('miscRenderFlags',0),explicitFields=sorted(e)))
assert len(profiles) == 9
raw = (json.dumps(profiles,indent=2)+'\n').encode()
output = Path('src/content/leona-sunlight-particles.json')
if '--check' in sys.argv: assert output.read_bytes() == raw, 'Sunlight profiles differ'
elif not output.exists() or output.read_bytes() != raw: output.write_bytes(raw)
print(json.dumps(dict(emitters=9,sourcePinSha256=sha(pin_path.read_bytes()),defaultsSha256=sha(defaults_path.read_bytes()))))
