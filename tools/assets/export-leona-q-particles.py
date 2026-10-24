"""Retain all 15 Daybreak emitters, including two explicitly disabled records.

Pinned external reconstruction defaults are distinguished from authored fields.
Native dispatch/defaults/rendering remain comparison targets.
"""
from pathlib import Path
import hashlib
import json
import sys
import math
sha=lambda b:hashlib.sha256(b).hexdigest()
pin_path=Path('docs/reference/leona-q-particles.json')
pin=json.loads(pin_path.read_text())
decoded=json.loads(Path('docs/reference/leona-q-particles-decoded.json').read_text())
assert decoded['sourcePinSha256']==sha(pin_path.read_bytes())
textures={t['source']['path']:t['path'].removeprefix('public/') for t in decoded['textures']}
for t in decoded['textures']:assert sha(Path(t['path']).read_bytes())==t['sha256']
readers=json.loads(Path('docs/reference/garen-q-cast-reader.json').read_text())
if '--readers' in sys.argv:
    for f in readers['files']:assert sha((Path('.cache/garen-q-cast-readers')/f['name']).read_bytes())==f['sha256']
def vector(v):return v if isinstance(v,list) else [v]
def birth(value,fallback):
    if isinstance(value,list):value=dict(constantValue=value)
    d=value.get('dynamics')
    if d:assert all(v==d['values'][0] for v in d['values'])
    return dict(value=vector(d['values'][0] if d else value.get('constantValue',fallback)),
        probabilities=[dict(times=t.get('keyTimes',[]),values=t.get('keyValues',[]),single=t.get('singleValue',1)) for t in d.get('probabilityTables',[])] if d else None)
def curve(value,fallback):
    d=value.get('dynamics')
    if d:
        for t in d.get('probabilityTables',[]):assert not t.get('keyTimes') and not t.get('keyValues') and t.get('singleValue',1)==1
        return dict(times=d['times'],values=[vector(v) for v in d['values']])
    return dict(times=[0],values=[vector(value.get('constantValue',fallback))])
allowed=set('rate particleLifetime particleLinger lifetime emitterLinger isSingleParticle emitterName importance pass bindWeight particleColorTexture meshRenderFlags colorRenderFlags miscRenderFlags isUniformScale birthScale0 scale0 texture colorLookUpTypeY colorLookUpScales birthRotation0 birthRotationalVelocity0 disabled EmitterPosition primitive isLocalOrientation isFollowingTerrain isGroundLayer blendMode birthColor Color SpawnShape timeBeforeFirstEmission birthVelocity birthDrag worldAcceleration isRandomStartFrame useEmissionMeshNormalForBirth filtering FlexShapeDefinition useNavmeshMask directionVelocityScale birthFrameRate __type'.split())
profiles=[]
for system,role in [('Leona_Q_cas','cast'),('Leona_Q_tar','hit')]:
    definition=pin['resources'][system]['definition']
    assert set(definition)<=set('complexEmitterDefinitionData particleName particlePath objectPath soundOnCreateDefault flags __type'.split())
    for index,e in enumerate(definition['complexEmitterDefinitionData']):
        assert set(e)<=allowed,set(e)-allowed
        shape=e.get('SpawnShape',{});flex=e.get('FlexShapeDefinition',{})
        assert set(shape)<=set('emitOffset emitRotationAngles emitRotationAxes __type'.split())
        assert set(flex)<=set('scaleBirthScaleByBoundObjectSize __type'.split())
        assert e.get('primitive',{}).get('__type') in [None,'VfxPrimitiveArbitraryQuad']
        assert e.get('meshRenderFlags',0)==0 and not e.get('useEmissionMeshNormalForBirth',False)
        assert e.get('blendMode',0) in [0,1,4]
        assert e.get('colorRenderFlags',0) in [0,1]
        assert e.get('birthFrameRate',{}).get('constantValue',0)==0
        profiles.append(dict(system=system,role=role,index=index,name=e['emitterName'],disabled=e.get('disabled',False),
            texture=textures[e['texture'].lower()],lookup=textures[e['particleColorTexture'].lower()] if e.get('particleColorTexture') else None,
            kind='quad' if e.get('primitive') else 'billboard',ground=bool(e.get('isGroundLayer',False)),terrain=bool(e.get('isFollowingTerrain',False)),navmesh=bool(e.get('useNavmeshMask',False)),
            rate=e['rate']['constantValue'],single=bool(e.get('isSingleParticle',False)),delay=e.get('timeBeforeFirstEmission',0),
            emitterLife=e.get('lifetime'),emitterLinger=e.get('emitterLinger',0),linger=e.get('particleLinger',0),life=birth(e.get('particleLifetime',{}),3),
            bind=e.get('bindWeight',{}).get('constantValue',0),boundScale=flex.get('scaleBirthScaleByBoundObjectSize'),
            position=birth(e.get('EmitterPosition',{}),[0,0,0]),spawn=birth(shape.get('emitOffset',{}),[0,0,0]),
            angles=[birth(v,0) for v in shape.get('emitRotationAngles',[])],axes=shape.get('emitRotationAxes',[]),
            velocity=birth(e.get('birthVelocity',{}),[0,0,0]),drag=birth(e.get('birthDrag',{}),[0,0,0]),acceleration=birth(e.get('worldAcceleration',{}),[0,0,0]),
            size=birth(e['birthScale0'],[1,1,1]),scale=curve(e.get('scale0',{}),[1,1,1]),uniform=bool(e.get('isUniformScale',False)),
            rotation=birth(e.get('birthRotation0',{}),[0,0,0]),spin=birth(e.get('birthRotationalVelocity0',{}),[0,0,0]),local=bool(e.get('isLocalOrientation',True)),
            birthColor=birth(e.get('birthColor',{}),[1,1,1,1]),color=curve(e.get('Color',{}),[1,1,1,1]),
            lookupTypes=[1,e.get('colorLookUpTypeY',0)],lookupScales=e.get('colorLookUpScales',[1,1]),lookupOffsets=[0,0],
            blend=e.get('blendMode',0),renderOrder=e.get('pass',0),miscRenderFlags=e.get('miscRenderFlags',0),
            colorRenderFlags=e.get('colorRenderFlags',0),keywords=e.get('filtering',{}).get('keywordsExcluded',[]),explicitFields=sorted(e)))
assert len(profiles)==15 and [p['disabled'] for p in profiles].count(True)==2
raw=(json.dumps(profiles,indent=2)+'\n').encode();out=Path('src/content/leona-q-particles.json')
if '--check' in sys.argv:assert out.read_bytes()==raw
elif not out.exists() or out.read_bytes()!=raw:out.write_bytes(raw)
print(json.dumps(dict(result='passed',emitters=15,enabled=13,disabled=2,sourcePinSha256=sha(pin_path.read_bytes()),nativeVerified=False)))
def peak(value):
    t=value['probabilities'][0] if value['probabilities'] else None
    return value['value'][0]*(max(t['values'] or [t['single']]) if t else 1)
cast_tail=2+math.ceil(max(min(peak(p['life']),p['linger']) for p in profiles if p['role']=='cast')*60)
hit_ends=[]
for p in profiles:
    if p['role']!='hit' or p['disabled']:continue
    delay=max(1,math.ceil(p['delay']*60-1e-5))
    count=max(1,math.floor(p['rate']*math.floor(p['emitterLife']*60)/60)) if not p['single'] else 1
    last=delay+(max(1,math.ceil(count*60/p['rate']))-1 if not p['single'] and count>1 else 0)
    hit_ends.append(last+peak(p['life'])*60)
hit_tail=1+math.ceil(max(hit_ends))
timing=("// Generated by tools/assets/export-leona-q-particles.py.\n"
    "// Source values with the existing local first-update/stop settlement policy.\n"
    f"export const LEONA_Q_CAST_TAIL_TICKS = {cast_tail};\n"
    f"export const LEONA_Q_HIT_HISTORY_TICKS = {hit_tail};\n"
    "export const LEONA_Q_SHIELD_BONE = 'BUFFBONE_CSTM_SHIELD_MID';\n"
    "export const LEONA_Q_HIT_BONE = 'C_BUFFBONE_GLB_CENTER_LOC';\n"
    f"export const LEONA_Q_PROFILE_SHA256 = '{sha(raw)}';\n")
timing_path=Path('src/content/leona-q-presentation.ts')
if '--check' in sys.argv:assert timing_path.read_text()==timing
elif not timing_path.exists() or timing_path.read_text()!=timing:timing_path.write_text(timing)
