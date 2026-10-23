"""Export static E layers and field/detonation motion; retain deferred coverage."""
from lux_e_field import export_field
import hashlib
import math
import json
from pathlib import Path

pin_path = Path('docs/reference/lux-e-vfx.json')
pin = json.loads(pin_path.read_text())
selected = {'Lux_E_mis': [2, 3, 4, 6, 8],
            'Lux_E_tar_aoe_green': [2, 3, 4, 7, 8],
            'Lux_E_tar_aoe_red': [4, 8, 9, 10, 16],
            'Lux_E_tar_nova': [1, 2, 3, 9, 10]}
roles = dict(zip(selected, ['flight', 'ally', 'enemy', 'burst']))
burst_indices = [5, 7, 8]
textures = {t['path']: t['output'].removeprefix('public/') for t in pin['textures']}


def vector(v):
    return v if isinstance(v, list) else [v]


def birth(v, default):
    d = v.get('dynamics')
    if d:
        assert d['times'] == [0] and len(d['values']) == 1
    return dict(value=vector(d['values'][0] if d else v.get('constantValue', default)),
                probabilities=[dict(times=t.get('keyTimes', []), values=t.get('keyValues', []),
                                    single=t.get('singleValue', 1)) for t in d['probabilityTables']]
                if d and 'probabilityTables' in d else None)


def curve(v, default):
    d = v.get('dynamics')
    if d:
        assert all(not t.get('keyTimes') and not t.get('keyValues') and t.get('singleValue', 1) == 1
                   for t in d.get('probabilityTables', []))
        return dict(times=d['times'], values=[vector(x) for x in d['values']])
    c = vector(v.get('constantValue', default))
    return dict(times=[0, 1], values=[c, c])


profiles, inventory = [], []
allowed = set('Color SpawnShape __type alphaErosionDefinition alphaRef bindWeight birthColor birthRotation0 birthRotationalVelocity0 birthScale0 birthUVOffset blendMode disableBackfaceCull emitterLinger emitterName EmitterPosition importance isGroundLayer isLocalOrientation isSingleParticle isUniformScale lifetime miscRenderFlags paletteDefinition particleColorTexture particleIsLocalOrientation particleLifetime particleLinger pass primitive rate scale0 texture textureMult uvMode'.split())
for record, d in pin['definitions'].items():
    for index, e in enumerate(d.get('complexEmitterDefinitionData', [])):
        active = index in selected.get(record, [])
        moving = record == 'Lux_E_tar_nova' and index in burst_indices
        inventory.append(dict(record=record, index=index, name=e['emitterName'],
            status='rendered static layer' if active else 'rendered moving batch' if moving else 'deferred',
            reason=None if active or moving else 'Separate moving-particle, distortion, additional-layer or target-hit integration remains required; the nonvisual sound emitter binding is not certified by the separate E audio controller.'))
        if not active:
            continue
        assert set(e) <= allowed, set(e) - allowed
        assert e['isSingleParticle'] and 'dynamics' not in e['rate']
        assert 'dynamics' not in e['particleLifetime']
        assert e['bindWeight']['constantValue'] == 1
        assert e.get('blendMode', 0) in [0, 2, 4]
        assert e.get('uvMode', 0) in [0, 2]
        primitive = e.get('primitive', {}).get('__type', 'camera')
        assert primitive in ['camera', 'VfxPrimitiveArbitraryQuad', 'VfxPrimitiveMesh']
        palette = e.get('paletteDefinition')
        if palette:
            assert not palette['paletteSelector'].get('dynamics')
            assert not palette['palleteSrcMixColor'].get('dynamics')
        mult = e.get('textureMult', {})
        assert set(mult) <= {'textureMult', '{cd124686}', '{22c3cf3e}', 'birthUVOffsetMult', '__type'}
        erosion = e.get('alphaErosionDefinition')
        offset = e.get('SpawnShape', {}).get('emitOffset', [0, 0, 0])
        assert isinstance(offset, list)
        pos = e.get('EmitterPosition', {}).get('constantValue', [0, 0, 0])
        profiles.append(dict(role=roles[record], record=record, index=index, name=e['emitterName'],
            count=max(1, int(e['rate']['constantValue'])), life=e['particleLifetime']['constantValue'],
            size=birth(e['birthScale0'], [1, 1, 1]), rotation=birth(e.get('birthRotation0', {}), [0, 0, 0]),
            angular=birth(e.get('birthRotationalVelocity0', {}), [0, 0, 0]),
            offset=[a+b for a,b in zip(offset,pos)],
            scale=curve(e.get('scale0', {}), [1, 1, 1]),
            birthColor=birth(e.get('birthColor', {}), [1, 1, 1, 1]),
            color=curve(e.get('Color', {}), [1, 1, 1, 1]),
            uniform=bool(e.get('isUniformScale')), ground=bool(e.get('isGroundLayer')) or primitive == 'VfxPrimitiveMesh',
            primitive={'camera': 'camera', 'VfxPrimitiveArbitraryQuad': 'quad', 'VfxPrimitiveMesh': 'mesh'}[primitive],
            local=bool(e.get('isLocalOrientation', True)),
            passOrder=e.get('pass', 0), blend=e.get('blendMode', 0), misc=e.get('miscRenderFlags', 0),
            texture=textures[e['texture'].lower()], lookup=textures[e['particleColorTexture'].lower()] if e.get('particleColorTexture') else '',
            uvMode=e.get('uvMode', 0), uvOffset=birth(e.get('birthUVOffset', {}), [0, 0]),
            mult=textures[mult['textureMult'].lower()] if mult else '',
            multScale=curve(mult.get('{cd124686}', {}), [1, 1]),
            multScroll=curve(mult.get('{22c3cf3e}', {}), [0, 0]),
            multOffset=birth(mult.get('birthUVOffsetMult', {}), [0, 0]),
            palette=dict(texture=textures[palette['paletteTexture'].lower()], mix=palette['palleteSrcMixColor']['constantValue'],
                         row=(palette['paletteSelector']['constantValue'][0]+0.5)/palette['paletteCount']) if palette else None,
            erosion=dict(texture=textures[erosion['erosionMapName'].lower()], drive=curve(erosion['erosionDriveCurve'], 0),
                         mix=erosion['erosionMapChannelMixer']['constantValue']) if erosion else None))
out = Path('src/content/lux-e-particles.json')
out.write_text(json.dumps(profiles, indent=2) + '\n')
burst = []
for index in burst_indices:
    e = pin['definitions']['Lux_E_tar_nova']['complexEmitterDefinitionData'][index]
    extra = {'birthVelocity', 'birthDrag', 'worldAcceleration', 'birthOrbitalVelocity',
             'colorLookUpTypeY', 'directionVelocityScale', 'isDirectionOriented',
             'isRandomStartFrame', 'numFrames', 'texDiv', '{ae4f2c3a}'}
    assert set(e) <= allowed | extra, set(e) - allowed - extra
    assert not e.get('primitive') and e.get('blendMode') == 4
    assert 'dynamics' not in e['rate'] and e['lifetime'] > 0
    # Retain the unknown block rather than assigning it a guessed engine meaning.
    assert e['{ae4f2c3a}'] == {'{fa390047}': [{'{cf0bf7fe}': [1.0, 1.0, 1.0], '__type': '{634db850}'}], '__type': '{bbc023b8}'}
    acceleration = e['worldAcceleration']
    assert acceleration['dynamics']['times'] == [0]
    assert len(acceleration['dynamics']['values']) == 1
    shape = e['SpawnShape']
    cylinder = shape['__type'] == 'VfxShapeCylinder'
    assert shape['__type'] in ['VfxShapeLegacy', 'VfxShapeCylinder']
    if cylinder:
        assert set(shape) == {'flags', 'radius', '__type'} and shape['flags'] == 1
    else:
        assert set(shape) == {'emitOffset', 'emitRotationAngles', 'emitRotationAxes', '__type'}
    offset = shape.get('emitOffset', {})
    assert isinstance(offset, dict)
    burst.append(dict(index=index, name=e['emitterName'], rate=e['rate']['constantValue'],
        single=bool(e.get('isSingleParticle')), emitterLife=e['lifetime'],
        life=birth(e['particleLifetime'], 1), size=birth(e['birthScale0'], [1, 1, 1]),
        velocity=birth(e['birthVelocity'], [0, 0, 0]), drag=birth(e['birthDrag'], [0, 0, 0]),
        acceleration=acceleration['dynamics']['values'][0],
        orbit=birth(e['birthOrbitalVelocity'], [0, 0, 0]), offset=birth(offset, [0, 0, 0]),
        position=birth(e['EmitterPosition'], [0, 0, 0]),
        shapeAngles=[birth(a, 0) for a in shape.get('emitRotationAngles', [])],
        shapeAxes=shape.get('emitRotationAxes', []), cylinderRadius=shape.get('radius', 0),
        cylinderFlags=shape.get('flags'),
        scale=curve(e['scale0'], [1, 1, 1]), uniform=bool(e.get('isUniformScale')),
        birthColor=birth(e['birthColor'], [1, 1, 1, 1]), color=curve(e['Color'], [1, 1, 1, 1]),
        direction=bool(e.get('isDirectionOriented')), directionScale=e.get('directionVelocityScale', 0),
        directionMin=e.get('directionVelocityMinScale', 1), passOrder=e.get('pass', 0),
        depthTest=(e.get('miscRenderFlags', 0) & 1) == 0,
        texture=textures[e['texture'].lower()], lookup=textures[e['particleColorTexture'].lower()] if e.get('particleColorTexture') else '',
        lookupTypes=[e.get('colorLookUpTypeX', 1), e.get('colorLookUpTypeY', 0)],
        lookupScales=e.get('colorLookUpScales', [1, 1]), lookupOffsets=e.get('colorLookUpOffsets', [0, 0]),
        atlas=dict(grid=e.get('texDiv', [1, 1]), frames=e.get('numFrames', 1), random=bool(e.get('isRandomStartFrame')))))
burst_out = Path('src/content/lux-e-burst.json')
burst_out.write_text(json.dumps(burst, indent=2) + '\n')
def maximum(v):
    return max(v['value']) * max([1] + [x for p in v['probabilities'] or [] for x in p['values']])
tail = max([math.ceil(p['life']*60)+1 for p in profiles if p['role'] == 'burst'] +
           [(0 if p['single'] else math.floor(p['emitterLife']*60)) + math.ceil(maximum(p['life'])*60)+1 for p in burst])
Path('src/content/lux-e-particle-timing.ts').write_text('// Generated by tools/assets/export-lux-e-particles.py.\n// Conservative last birth plus maximum selected particle life and one tick.\nexport const LUX_E_BURST_TICKS = '+str(tail)+';\n')
field, field_out = export_field(pin, textures, inventory)
audit = dict(sourcePinSha256=hashlib.sha256(pin_path.read_bytes()).hexdigest(),
             profileSha256=hashlib.sha256(out.read_bytes()).hexdigest(), burstProfileSha256=hashlib.sha256(burst_out.read_bytes()).hexdigest(), fieldProfileSha256=hashlib.sha256(field_out.read_bytes()).hexdigest(), rendered=len(profiles)+len(burst)+len(field),
             inventory=inventory, limits=['Twenty static layers, three detonation motion batches and four field wave/spark batches. Remaining field/flight motion, distortion and target hit capture remain open; E source audio is implemented separately.',
             'Birth dispatch, palette row conversion, emitter origin/height, source-frame attachment, ground projection, stop behavior and composition remain local adapters pending native comparison.'])
Path('docs/reference/lux-e-particle-coverage.json').write_text(json.dumps(audit, indent=2) + '\n')
print(json.dumps(dict(fieldProfileSha256=hashlib.sha256(field_out.read_bytes()).hexdigest(), rendered=len(profiles)+len(burst)+len(field), deferred=len(inventory)-len(profiles)-len(burst)-len(field), burstTailTicks=tail)))
