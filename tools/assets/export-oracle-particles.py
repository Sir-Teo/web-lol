"""Normalize every frozen Oracle emitter without losing curves or bindings.

This exports declarations, not native callback dispatch. Value curves retain
their constant, temporal keys and probability multipliers separately.
"""
import json
from pathlib import Path
from riot_archive import sha

pin_path = Path('docs/reference/oracle-lens-source.json')
assets_path = Path('docs/reference/oracle-lens-assets.json')
defaults_path = Path('docs/reference/garen-spin-defaults.json')
reader_path = Path('docs/reference/garen-q-cast-reader.json')
pin = json.loads(pin_path.read_text())
assets = json.loads(assets_path.read_text())
defaults = json.loads(defaults_path.read_text())['defaults']
reader = json.loads(reader_path.read_text())
surface = next(f for f in reader['files'] if f['name'] == 'readSurface.ts')
assert sha(Path('.cache/garen-q-cast-readers/readSurface.ts').read_bytes()) == surface['sha256']
assert assets['sourcePinSha256'] == sha(pin_path.read_bytes())
textures = {t['source']['path']: t['path'].removeprefix('public/') for t in assets['textures']}
meshes = {m['source']['path']: m['output']['path'].removeprefix('/') for m in assets['meshes']}
for t in assets['textures']: assert sha(Path(t['path']).read_bytes()) == t['sha256']
for m in [assets['rig']] + assets['meshes']:
    assert sha(Path('public'+m['output']['path']).read_bytes()) == m['output']['sha256']
def vector(v): return v if isinstance(v, list) else [v]
def value(v, default):
    if isinstance(v, list): v = {'constantValue': v}
    d = v.get('dynamics', {})
    times, values = d.get('times', []), d.get('values', [])
    assert len(times) == len(values) and all(a <= b for a,b in zip(times, times[1:]))
    probabilities = []
    for p in d.get('probabilityTables', []):
        t, k = p.get('keyTimes', []), p.get('keyValues', [])
        assert len(t) == len(k) and all(a <= b for a,b in zip(t, t[1:]))
        probabilities.append(dict(times=t, values=k, single=p.get('singleValue', 1)))
    return dict(constant=vector(v.get('constantValue', default)), times=times,
                values=[vector(x) for x in values], probabilities=probabilities)
systems = {
    'buff': 'Items/3364/Particles/3364_Buff',
    'death': 'Items/3364/Particles/3364_Global_Trinket_Spotter_Death',
    'alert': 'Items/3364/Particles/3364_Alert',
}
profiles = []
for role, key in systems.items():
    system = pin['items']['records'][key]
    for index, e in enumerate(system['complexEmitterDefinitionData']):
        shape = e.get('SpawnShape', {})
        primitive = e.get('primitive', {})
        mesh = primitive.get('mMesh', {})
        child = e.get('childParticleSetDefinition')
        kind = ('child' if child else 'rig' if mesh.get('mMeshName') else
                'mesh' if mesh.get('mSimpleMeshName') else 'quad' if primitive.get('__type') == 'VfxPrimitiveArbitraryQuad'
                else 'projection' if primitive.get('__type') == 'VfxPrimitivePlanarProjection' else 'billboard')
        assert primitive.get('__type') in [None, 'VfxPrimitiveMesh', 'VfxPrimitiveArbitraryQuad', 'VfxPrimitivePlanarProjection']
        assert e.get('blendMode', 0) in [0,1,3,4]
        grid = e.get('texDiv', [1,1])
        assert all(v > 0 for v in grid)
        # CoreLaser has [0.51, 1], an authored UV divisor rather than a count
        # of atlas cells. Preserve the fractional value; do not round it away.
        assert 'dynamics' not in e['rate'], 'Temporal rates require a separate emission adapter'
        assert len(shape.get('emitRotationAngles', [])) == len(shape.get('emitRotationAxes', []))
        if child:
            assert 'texture' not in e and child['childEmitOnDeath']
            assert [x['effectKey'] for x in child['childrenIdentifiers']] == ['{b28120e6}']
        profiles.append(dict(role=role, index=index, name=e['emitterName'], kind=kind,
            mesh='assets/models/oracle-lens-base.glb' if kind == 'rig' else meshes[mesh['mSimpleMeshName'].lower()] if kind == 'mesh' else None,
            texture=textures[e['texture'].lower()] if 'texture' in e else None,
            lookup=textures[e['particleColorTexture'].lower()] if 'particleColorTexture' in e else None,
            rate=e['rate']['constantValue'], single=bool(e.get('isSingleParticle', False)),
            delay=e.get('timeBeforeFirstEmission', 0), emitterLife=e.get('lifetime'),
            linger=e.get('particleLinger', 0), emitterLinger=e.get('emitterLinger'),
            life=value(e['particleLifetime'], 0), bind=value(e.get('bindWeight', {}), 0),
            size=value(e.get('birthScale0', {}), defaults['birthScale']),
            scale=value(e.get('scale0', {}), defaults['scale']),
            birthColor=value(e.get('birthColor', {}), defaults['color']),
            color=value(e.get('Color', {}), defaults['color']),
            velocity=value(e.get('birthVelocity', {}), [0,0,0]),
            drag=value(e.get('birthDrag', {}), [0,0,0]),
            acceleration=value(e.get('worldAcceleration', {}), [0,0,0]),
            orbital=value(e.get('birthOrbitalVelocity', {}), [0,0,0]),
            rotation=value(e.get('birthRotation0', {}), [0,0,0]),
            angularVelocity=value(e.get('birthRotationalVelocity0', {}), [0,0,0]),
            position=value(e.get('EmitterPosition', {}), [0,0,0]),
            offset=value(shape.get('emitOffset', {}), [0,0,0]),
            spawnAngles=[value(v, 0) for v in shape.get('emitRotationAngles', [])],
            spawnAxes=shape.get('emitRotationAxes', []),
            uniform=bool(e.get('isUniformScale', False)), local=bool(e.get('isLocalOrientation', True)),
            particleLocal=bool(e.get('particleIsLocalOrientation', False)),
            scroll=value(e.get('birthUvScrollRate', {}), [0,0]),
            uvOffset=value(e.get('birthUVOffset', {}), [0,0]),
            # The pinned readSurface schema defaults missing numFrames to one,
            # independently of texDiv. Do not invent four random cells for sparks.
            atlas=dict(grid=grid, frames=e.get('numFrames', 1), start=e.get('startFrame',0),
                       random=bool(e.get('isRandomStartFrame', False)), fps=e.get('frameRate',0)),
            lookupTypes=[e.get('colorLookUpTypeX', defaults['lookupTypes'][0]),e.get('colorLookUpTypeY', defaults['lookupTypes'][1])],
            lookupScales=e.get('colorLookUpScales', defaults['lookupScales']),
            lookupOffsets=e.get('colorLookUpOffsets', defaults['lookupOffsets']),
            direction=bool(e.get('isDirectionOriented', False)), directionScale=e.get('directionVelocityScale',0),
            directionMin=e.get('directionVelocityMinScale',0), blend=e.get('blendMode',0),
            renderOrder=e.get('pass',0), miscRenderFlags=e.get('miscRenderFlags',0),
            ground=bool(e.get('isGroundLayer',False)), navmeshMask=bool(e.get('useNavmeshMask',False)),
            projection=primitive.get('mProjection'), hudProjection=bool(system.get('hudAnchorPositionFromWorldProjection',False)),
            uvMode=e.get('uvMode',0), reflection=e.get('reflectionDefinition'),
            childRole='death' if child else None, rawEmitterSha256=sha(json.dumps(e, separators=(',',':')).encode())))
assert len(profiles)==17 and sum(p['kind']=='child' for p in profiles)==1
out = Path('src/content/oracle-particles.json')
raw = (json.dumps(profiles, indent=2)+'\n').encode()
if not out.exists() or out.read_bytes()!=raw: out.write_bytes(raw)
audit = dict(sourcePinSha256=sha(pin_path.read_bytes()), assetsSha256=sha(assets_path.read_bytes()),
    defaultsEvidenceSha256=sha(defaults_path.read_bytes()), output=dict(path=str(out), sha256=sha(raw)),
    readerEvidenceSha256=sha(reader_path.read_bytes()), missingFrameCountDefault=1,
    systems=systems, profiles=[dict(role=p['role'], index=p['index'], name=p['name'], kind=p['kind'], rawEmitterSha256=p['rawEmitterSha256']) for p in profiles],
    limits=['Declarations do not establish native event triggers, value time domains, orbital units, attachment, HUD scale, stop/linger or material dispatch.',
            'Alert dispatch remains unresolved. Child death relationship is explicit; runtime stopping/callback timing requires a named adapter.'])
target=Path('docs/reference/oracle-particle-profiles.json');raw=(json.dumps(audit,indent=2)+'\n').encode()
if not target.exists() or target.read_bytes()!=raw:target.write_bytes(raw)
print('Exported 17 original emitters, including the invisible child driver; no curves/probability tables discarded')
