"""Package the frozen AA particle closure without inventing graph dispatch.

The research inputs retain BIN records and losslessly decoded TEX/SCB assets.
All fourteen emitter definitions survive; unlinked critical weapon and scene
distortion remain explicitly deferred. Runtime attachment/stop policy is separate.
"""
from pathlib import Path
import hashlib
import json
import shutil
import math

ROOT = Path('.cache/garen-aa-full-source-research-20261023')
sha = lambda raw: hashlib.sha256(raw).hexdigest()

def write(path, value):
    raw = (json.dumps(value, indent=2) + '\n').encode()
    path = Path(path)
    if not path.exists() or path.read_bytes() != raw:
        path.write_bytes(raw)

def pin(path):
    path = Path(path)
    raw = path.read_bytes()
    return dict(file=str(path), bytes=len(raw), sha256=sha(raw))

def copy(source, target, expected):
    source, target = Path(source), Path(target)
    raw = source.read_bytes()
    assert sha(raw) == expected
    if target.exists():
        assert target.read_bytes() == raw, target
    else:
        shutil.copy2(source, target)
    return pin(target)

definitions = json.loads((ROOT / 'definitions.json').read_text())
findings = json.loads((ROOT / 'findings.json').read_text())
decoded = json.loads((ROOT / 'decoded-v2/index.json').read_text())
models = json.loads((ROOT / 'research-models/validation.json').read_text())
stage = json.loads((ROOT / 'stage-ledger.json').read_text())
for item in stage['files']:
    assert pin(item['file'])['sha256'] == item['sha256'], item['file']
for item in findings['sourcePins']:
    assert pin(item['file'])['sha256'] == item['sha256'], item['file']
defaults_path = Path('docs/reference/garen-spin-defaults.json')
defaults = json.loads(defaults_path.read_text())['defaults']

textures, meshes, assets = {}, {}, []
for item in decoded['textures']:
    source = item['source']
    target = Path('public/assets/effects') / ('garen-aa-' + Path(source['path']).stem + '.png')
    output = copy(item['file'], target, item['sha256'])
    textures[source['path']] = str(target).removeprefix('public/')
    assets.append(dict(source=source, decoded=item, output=output))
for item in models['reports']:
    assert item['errors'] == item['warnings'] == 0 and item['roundTripAttributesEqual']
    target = Path('public/assets/models') / ('garen-aa-' + Path(item['sourceAliases'][0]).stem + '.glb')
    output = copy(item['file'], target, item['sha256'])
    for alias in item['sourceAliases']:
        meshes[alias] = str(target).removeprefix('public/')
    assets.append(dict(sourceAliases=item['sourceAliases'], decoded=item, output=output))

def vector(value):
    return value if isinstance(value, list) else [value]

def birth(value, fallback):
    if isinstance(value, list):
        value = dict(constantValue=value)
    dynamics = value.get('dynamics')
    if dynamics:
        assert dynamics['times'] == [0] and len(dynamics['values']) == 1
    return dict(value=vector(dynamics['values'][0] if dynamics else value.get('constantValue', fallback)),
        probabilities=[dict(times=p.get('keyTimes', []), values=p.get('keyValues', []), single=p.get('singleValue', 1))
            for p in dynamics.get('probabilityTables', [])] if dynamics else None)

def curve(value, fallback):
    dynamics = value.get('dynamics')
    if dynamics:
        for p in dynamics.get('probabilityTables', []):
            assert not p.get('keyTimes') and not p.get('keyValues') and p.get('singleValue', 1) == 1
        return dict(times=dynamics['times'], values=[vector(v) for v in dynamics['values']])
    return dict(times=[0], values=[vector(value.get('constantValue', fallback))])

events = []
for clip, graph in findings['graphEvents'].items():
    for event in graph['events'].values():
        pair, = event['mParticleEventDataPairList']
        assert not event['mIsLoop'] and not event.get('mIsKillEvent', False)
        events.append(dict(clip=clip.lower(), system=event['mEffectKey'], frame=event['mStartFrame'],
            clipSeconds=event['mStartFrame'] * graph['tickDuration'], bone=pair['mBoneName']))
assert len(events) == 4 and not findings['graphEvents']['Crit']['events']
assert all(s['boneEnabled'] and s['bone'] == 'C_BUFFBONE_GLB_CHEST_LOC' and s['orientationType'] == 2
    for s in findings['spellHitEffects'])

allowed = set('rate particleLifetime particleLinger lifetime emitterLinger isSingleParticle emitterName birthVelocity '
    'birthDrag worldAcceleration bindWeight SpawnShape FlexShapeDefinition EmitterPosition primitive particleColorTexture '
    'Color blendMode pass miscRenderFlags meshRenderFlags particleIsLocalOrientation isLocalOrientation birthRotation0 '
    'birthRotationalVelocity0 birthScale0 scale0 texture birthUvScrollRate disableBackfaceCull timeBeforeFirstEmission '
    'colorLookUpTypeX colorLookUpTypeY colorLookUpScales colorLookUpOffsets isDirectionOriented directionVelocityScale '
    'directionVelocityMinScale isRandomStartFrame numFrames texDiv isUniformScale distortionDefinition __type'.split())
profiles = []
for system, resource in definitions['resources'].items():
    for index, e in enumerate(resource['definition']['complexEmitterDefinitionData']):
        assert not set(e) - allowed, (system, index, set(e) - allowed)
        primitive = e.get('primitive', {}).get('__type')
        assert primitive in [None, 'VfxPrimitiveArbitraryQuad', 'VfxPrimitiveMesh', 'VfxPrimitiveRay']
        shape = e.get('SpawnShape', {})
        assert not set(shape) - {'emitOffset', '__type'}
        deferred = ('unlinked critical weapon dispatch' if system == 'Garen_AA_Crit' else
            'scene distortion integration' if 'distortionDefinition' in e else None)
        profiles.append(dict(system=system, index=index, name=e['emitterName'],
            phase='hit' if system in ['Garen_AA_Tar', 'Garen_Crit_Tar'] else 'swing',
            critical=system in ['Garen_Crit_Tar', 'Garen_AA_Crit'], deferred=deferred,
            kind={None:'billboard', 'VfxPrimitiveArbitraryQuad':'quad', 'VfxPrimitiveMesh':'mesh', 'VfxPrimitiveRay':'ray'}[primitive],
            mesh=meshes[e['primitive']['mMesh']['mSimpleMeshName'].lower()] if primitive == 'VfxPrimitiveMesh' else None,
            texture=textures[e['texture'].lower()],
            lookup=textures[e['particleColorTexture'].lower()] if e.get('particleColorTexture') else None,
            rate=e['rate']['constantValue'], single=bool(e.get('isSingleParticle', False)),
            delay=e.get('timeBeforeFirstEmission', 0), emitterLife=e['lifetime'],
            emitterLinger=e.get('emitterLinger', 0), linger=e.get('particleLinger', 0),
            life=birth(e['particleLifetime'], 3), velocity=birth(e.get('birthVelocity', {}), [0,0,0]),
            drag=birth(e.get('birthDrag', {}), [0,0,0]), acceleration=birth(e.get('worldAcceleration', {}), [0,0,0]),
            position=birth(e.get('EmitterPosition', {}), [0,0,0]), spawnOffset=birth(shape.get('emitOffset', {}), [0,0,0]),
            size=birth(e.get('birthScale0', {}), defaults['birthScale']), rotation=birth(e.get('birthRotation0', {}), [0,0,0]),
            angularVelocity=birth(e.get('birthRotationalVelocity0', {}), [0,0,0]),
            scale=curve(e.get('scale0', {}), [1,1,1]), color=curve(e.get('Color', {}), [1,1,1,1]),
            scroll=birth(e.get('birthUvScrollRate', {}), [0,0]),
            bindWeight=e.get('bindWeight', {}).get('constantValue', 0),
            local=bool(e.get('isLocalOrientation', True)), particleLocal=bool(e.get('particleIsLocalOrientation', False)),
            uniform=bool(e.get('isUniformScale', False)), direction=bool(e.get('isDirectionOriented', False)),
            directionScale=e.get('directionVelocityScale', 0), directionMinScale=e.get('directionVelocityMinScale', 1),
            boundSize=e.get('FlexShapeDefinition', {}).get('scaleBirthScaleByBoundObjectSize'),
            atlas=dict(grid=e.get('texDiv', [1,1]), frames=e.get('numFrames', 1), random=bool(e.get('isRandomStartFrame', False))),
            lookupTypes=[e.get('colorLookUpTypeX', 1), e.get('colorLookUpTypeY', 0)],
            lookupScales=e.get('colorLookUpScales', [1,1]), lookupOffsets=e.get('colorLookUpOffsets', [0,0]),
            blend=e.get('blendMode', 0), renderOrder=e.get('pass', 0), miscRenderFlags=e.get('miscRenderFlags', 0),
            doubleSided=bool(e.get('disableBackfaceCull', False)),
            distortion=e.get('distortionDefinition'), explicitFields=sorted(e)))
assert len(profiles) == 14 and sum(p['deferred'] is None for p in profiles) == 12
def last_endpoint(p):
    life = p['life']['value'][0]
    probabilities = p['life']['probabilities']
    if probabilities:
        table = probabilities[0]
        life *= max(table['values']) if table['values'] else table['single']
    count = 1 if p['single'] else max(1, math.floor(math.floor(p['emitterLife'] * 60) * p['rate'] / 60))
    born = 1 if count == 1 else math.ceil(count * 60 / p['rate'])
    return math.ceil(p['delay'] * 60 - 1e-5) + born + math.ceil(life * 60)
timings = [dict(kind=e['clip'], seconds=e['clipSeconds'], tailTicks=last_endpoint(p))
    for e in events for p in profiles if p['system'] == e['system'] and p['deferred'] is None]
hit_history = max(last_endpoint(p) for p in profiles if p['phase'] == 'hit' and p['deferred'] is None) + 1
text = '// Generated from frozen source lifetimes and the local first-update emission grid.\n'
text += 'export const GAREN_AA_SWING_ENDPOINTS = ' + json.dumps(timings, indent=2) + ' as const;\n'
text += f'export const GAREN_AA_HIT_HISTORY_TICKS = {hit_history};\n'
timing_path = Path('src/content/garen-aa-particle-timing.ts')
if not timing_path.exists() or timing_path.read_text() != text:
    timing_path.write_text(text)
write('src/content/garen-aa-particles.json', dict(events=events, hitBone='C_BUFFBONE_GLB_CHEST_LOC',
    orientationType=2, profiles=profiles))
write('docs/reference/garen-aa-particles-source.json', dict(
    scope='Frozen fourteen-emitter closure and exact assets; source data is distinct from local timing/attachment/render policy.',
    definitions=definitions, graphEvents=findings['graphEvents'], spellHitEffects=findings['spellHitEffects'],
    assets=assets, defaults=pin(defaults_path),
    researchInputs=[pin(ROOT / f) for f in ['definitions.json','findings.json','stage-ledger.json','dependency-extraction.json',
        'decoded-v2/index.json','research-models/validation.json']],
    output=pin('src/content/garen-aa-particles.json'), timing=pin(timing_path),
    deferred=[dict(system=p['system'], index=p['index'], reason=p['deferred']) for p in profiles if p['deferred']] ))
print(json.dumps(dict(emitters=len(profiles), activeProfiles=12, events=len(events), textures=len(textures), uniqueMeshes=len(models['reports']))))
