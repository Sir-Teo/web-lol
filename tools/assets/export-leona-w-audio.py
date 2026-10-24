"""Export untouched Eclipse masters and verified five-role bank policy.

--check verifies generated outputs without writing them. Native dispatch,
listener/bus mix, shuffle and missing-property defaults remain unverified.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

sha = lambda b: hashlib.sha256(b).hexdigest()
graph_path = Path('docs/reference/leona-w-audio.json')
graph = json.loads(graph_path.read_text())
decoded = json.loads(Path('docs/reference/leona-w-audio-decoded.json').read_text())
assert decoded['sourceGraphSha256'] == sha(graph_path.read_bytes())
nodes = {n['id']: n for n in graph['nodes']}


def parameter(identity, suffix):
    found = [p for p in nodes[identity]['parameters'] if p[0].endswith('/' + suffix)]
    assert len(found) == 1, (identity, suffix)
    return found[0][2]


def properties(identity):
    fields = nodes[identity]['parameters']
    result = {}
    for f in fields:
        if f[0].endswith('/pID'):
            key = f[3].split('[')[-1].removesuffix(']')
            value = next(p[2] for p in fields if p[0] == f[0][:-3] + 'pValue')
            assert key not in result
            result[key] = float(value)
    return result


events = {e['name']: e for e in graph['events']}
profile = {}
outputs = {}
for role, suffix, target, gain, count, cap in [
    ('cast', 'LeonaSolarBarrier_OnCast', 2434, -10, 4, 2),
    ('initial', 'LeonaSolarBarrier_OnBuffActivate', 2435, -9, 3, 4),
    ('extended', 'LeonaSolarBarrier2_OnBuffActivate', 2439, -20, 3, 4),
    ('hit', 'LeonaSolarBarrier_hit', 2436, -9, 4, 2),
    ('miss', 'LeonaSolarBarrier_hitwhiff', 2437, -13, 4, 4),
]:
    event = events['Play_sfx_Leona_' + suffix]
    assert len(event['actions']) == 1
    action = event['actions'][0]
    assert action['target'] == target
    assert properties(action['id']) == ({'TransitionTime': 5} if role == 'initial' else {})
    assert int(parameter(action['id'], 'eFadeCurve')) == 4
    assert properties(target) == ({'MakeUpGain': gain, 'Priority': 60} if role == 'extended' else {'MakeUpGain': gain})
    assert int(parameter(target, 'DirectParentID')) == 2433
    policy = {k: int(parameter(target, k)) for k in [
        'eMode', 'eRandomMode', 'wAvoidRepeatCount', 'bResetPlayListAtEachPlay',
        'bIsGlobal', 'bIsContinuous', '_bIsUsingWeight', 'u16MaxNumInstance',
        'bKillNewest', 'sLoopCount', 'sLoopModMin', 'sLoopModMax', 'eTransitionMode',
    ]}
    assert policy == dict(eMode=0, eRandomMode=1, wAvoidRepeatCount=0,
        bResetPlayListAtEachPlay=1, bIsGlobal=1, bIsContinuous=0,
        _bIsUsingWeight=0, u16MaxNumInstance=cap, bKillNewest=0,
        sLoopCount=1, sLoopModMin=0, sLoopModMax=0, eTransitionMode=0)
    assert int(parameter(target, 'ulPlayListItem')) == count
    variants = []
    for i in range(count):
        sound = int(parameter(target, f'AkPlaylistItem:{i}/ulPlayID'))
        assert int(parameter(target, f'AkPlaylistItem:{i}/weight')) == 50000
        assert int(parameter(sound, 'DirectParentID')) == target
        assert properties(sound) == {'Priority': 60}  # No authored Loop property.
        identity = int(parameter(sound, 'sourceID'))
        m = next(m for m in decoded['media'] if m['id'] == identity)
        assert m['sampleRate'] == 44100 and m['channels'] == 1
        assert m['decoderMetadata']['loopingInfo'] is None
        raw = (Path('.cache/leona-w-audio-decoded-v1-20261023') / f'{identity}.wav').read_bytes()
        assert sha(raw) == m['wavSha256']
        url = f'assets/audio/leona-w-{identity}.wav'
        outputs['public/' + url] = raw
        variants.append(dict(id=identity, soundId=sound, url=url, sha256=m['wavSha256'],
            pcmSha256=m['pcmSha256'], frames=m['frames'], sampleRate=m['sampleRate'],
            channels=m['channels'], durationSeconds=m['durationSeconds'], peak=m['peak']))
    assert {v['id'] for v in variants} == set(action['affectedMediaIds'])
    stop = None
    if role in ['initial', 'extended']:
        e = events['Stop_sfx_Leona_' + suffix]
        assert len(e['actions']) == 1
        a = e['actions'][0]
        assert a['target'] == target and properties(a['id']) == {'DelayTime': 500}
        assert int(parameter(a['id'], 'eFadeCurve')) == 4
        stop = dict(eventId=e['id'], actionId=a['id'], delaySeconds=0.5,
            authoredTransitionSeconds=None, curve=4)
    profile[role] = dict(eventId=event['id'], actionId=action['id'], targetId=target,
        gainDb=gain, fadeInSeconds=0.005 if role == 'initial' else 0,
        policy=policy, stop=stop, variants=variants,
        maxDurationSeconds=max(v['durationSeconds'] for v in variants))

assert properties(2433) == {} and int(parameter(2433, 'DirectParentID')) == 695650395
assert properties(695650395) == {'Priority': 60, 'AttenuationID': 339248780}
assert int(parameter(695650395, 'OverrideBusId')) == 1259461568
assert int(parameter(339248780, 'eScaling')) == 2
assert int(parameter(339248780, 'curveToUse[0]')) == 0
profile['attenuation'] = dict(id=339248780, scaling=2,
    points=[dict(distance=float(parameter(339248780, f'AkRTPCGraphPoint:{i}/From')),
        storedValue=float(parameter(339248780, f'AkRTPCGraphPoint:{i}/To')),
        interpolation=int(parameter(339248780, f'AkRTPCGraphPoint:{i}/Interp'))) for i in range(6)],
    unresolvedOutputBusId=1259461568)
source = ('// Generated by tools/assets/export-leona-w-audio.py.\n'
    '// Finite source recordings; no authored loops. Native dispatch/mix remain unverified.\n'
    + 'export const LEONA_W_AUDIO = ' + json.dumps(profile, indent=2) + ' as const;\n')
formatted = subprocess.check_output(['npx', 'prettier', '--stdin-filepath', 'src/content/leona-w-audio.ts'], input=source.encode())
outputs['src/content/leona-w-audio.ts'] = formatted
for file, raw in outputs.items():
    path = Path(file)
    if '--check' in sys.argv:
        assert path.read_bytes() == raw, file
    else:
        if path.exists():
            assert path.read_bytes() == raw, 'Refuse to replace changed output: ' + file
        else:
            path.write_bytes(raw)
print(json.dumps(dict(result='passed', checkOnly='--check' in sys.argv,
    events=len(events), roles=5, media=len(decoded['media']), shippedBytes=sum(len(b) for p, b in outputs.items() if p.endswith('.wav')))))
