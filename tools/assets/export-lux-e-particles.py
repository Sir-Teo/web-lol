"""Export supported static E layers; inventory every deferred emitter separately."""
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
        inventory.append(dict(record=record, index=index, name=e['emitterName'],
            status='rendered static layer' if active else 'deferred',
            reason=None if active else 'Separate moving-particle, distortion, additional-layer, target-hit or audio integration remains required.'))
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
tail = math.ceil(max(p['life'] for p in profiles if p['role'] == 'burst')*60)+1
Path('src/content/lux-e-particle-timing.ts').write_text('// Generated by tools/assets/export-lux-e-particles.py.\n// Longest selected burst lifetime plus its first-update birth tick.\nexport const LUX_E_BURST_TICKS = '+str(tail)+';\n')
audit = dict(sourcePinSha256=hashlib.sha256(pin_path.read_bytes()).hexdigest(),
             profileSha256=hashlib.sha256(out.read_bytes()).hexdigest(), rendered=len(profiles),
             inventory=inventory, limits=['Static layers only; moving particles, distortion, sustained source audio and target hit capture remain open.',
             'Birth dispatch, palette row conversion, emitter origin/height, source-frame attachment, ground projection, stop behavior and composition remain local adapters pending native comparison.'])
Path('docs/reference/lux-e-particle-coverage.json').write_text(json.dumps(audit, indent=2) + '\n')
print(json.dumps(dict(rendered=len(profiles), deferred=len(inventory)-len(profiles))))
