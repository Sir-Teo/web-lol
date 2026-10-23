"""Ship unchanged Lucent Singularity float masters and export verified container/stop policy."""
from pathlib import Path
import hashlib
import json
import subprocess

sha = lambda b: hashlib.sha256(b).hexdigest()
graph_path = Path('docs/reference/lux-e-audio.json')
graph = json.loads(graph_path.read_text())
decoded_path = Path('docs/reference/lux-e-audio-decoded.json')
decoded = json.loads(decoded_path.read_text())
assert decoded['sourceGraphSha256'] == sha(graph_path.read_bytes())
nodes = {n['id']: n for n in graph['nodes']}
def parameter(identity, ending):
    found = [p for p in nodes[identity]['parameters'] if p[0].endswith('/' + ending)]
    assert len(found) == 1, (identity, ending)
    return found[0][2]
def properties(identity):
    fields = nodes[identity]['parameters']; result = {}
    for f in fields:
        if f[0].endswith('/pID'):
            key = f[3].split('[')[-1].removesuffix(']')
            value = next(p[2] for p in fields if p[0] == f[0][:-3] + 'pValue')
            assert key not in result, (identity, key)
            result[key] = float(value)
    return result
events = {e['name']: e for e in graph['events']}
profile = {}
for role, name, target_id, gain, delay in [
    ('cast', 'OnCast', 1160, -5, 0),
    ('flight', 'OnMissileLaunch', 1163, -7, 100),
    ('zone', 'buffactivate', 632030757, -10, 0),
    ('zoneDelayed', 'buffactivate', 1162, -13, 500),
    ('hit', 'hit', 1161, -6, 0)]:
    event = events['Play_sfx_Lux_LuxLightStrikeKugel_' + name]
    action = next(a for a in event['actions'] if a['target'] == target_id)
    assert properties(action['id']) == ({'DelayTime': delay} if delay else {})
    assert properties(target_id) == {'MakeUpGain': gain}
    assert int(parameter(target_id, 'DirectParentID')) == 1159
    policy = {k: int(parameter(target_id, k)) for k in ['eMode', 'eRandomMode', 'wAvoidRepeatCount',
        'bResetPlayListAtEachPlay', 'bIsGlobal', 'bIsContinuous', '_bIsUsingWeight',
        'u16MaxNumInstance', 'bKillNewest', 'sLoopCount', 'sLoopModMin', 'sLoopModMax', 'eTransitionMode']}
    assert policy['eMode'] == 0 and policy['bIsGlobal'] == 1
    assert policy['eRandomMode'] == (0 if role in ('flight', 'zone') else 1)
    assert policy['wAvoidRepeatCount'] == dict(cast=3, flight=1, zone=1, zoneDelayed=0, hit=2)[role]
    assert policy['bIsContinuous'] == 0 and policy['sLoopCount'] == 1
    assert policy['bKillNewest'] == 0 and policy['_bIsUsingWeight'] == 0
    variants = []
    for i in range(int(parameter(target_id, 'ulPlayListItem'))):
        sound_id = int(parameter(target_id, f'AkPlaylistItem:{i}/ulPlayID'))
        media_id = int(parameter(sound_id, 'sourceID'))
        assert not properties(sound_id)
        assert int(parameter(target_id, f'AkPlaylistItem:{i}/weight')) == 50000
        m = next(m for m in decoded['media'] if m['id'] == media_id)
        assert m['decoderMetadata']['loopingInfo'] is None and m['sampleRate'] == 44100 and m['channels'] == 1
        raw = (Path('.cache/lux-e-audio-decoded') / f'{media_id}.wav').read_bytes()
        assert sha(raw) == m['wavSha256']
        assert m['encodedSha256'] == next(x['sha256'] for x in graph['media'] if x['id'] == media_id)
        output = Path(f'public/assets/audio/lux-e-{media_id}.wav'); output.write_bytes(raw)
        variants.append(dict(id=media_id, soundId=sound_id, url=str(output).removeprefix('public/'),
            sha256=m['wavSha256'], pcmSha256=m['pcmSha256'], frames=m['frames'], sampleRate=m['sampleRate'],
            channels=m['channels'], durationSeconds=m['durationSeconds'], peak=m['peak']))
    assert {v['id'] for v in variants} == set(action['affectedMediaIds'])
    profile[role] = dict(eventId=event['id'], actionId=action['id'], targetId=target_id, gainDb=gain, delaySeconds=delay / 1000,
        policy=policy, variants=variants, maxDurationSeconds=max(v['durationSeconds'] for v in variants))
stop = events['Stop_sfx_Lux_LuxLightStrikeKugel_OnMissileLaunch']
assert len(stop['actions']) == 1
action = stop['actions'][0]
assert action['target'] == 1163 and properties(action['id']) == {'TransitionTime': 1500}
assert int(parameter(action['id'], 'eFadeCurve')) == 4
profile['flight']['stop'] = dict(eventId=stop['id'], actionId=action['id'], fadeSeconds=1.5, curve=4)
assert properties(1159) == {}
assert int(parameter(1159, 'DirectParentID')) == 413871746
assert properties(413871746) == {'Priority': 60, 'AttenuationID': 339248780}
assert int(parameter(413871746, 'OverrideBusId')) == 1259461568
assert int(parameter(339248780, 'eScaling')) == 2
assert int(parameter(339248780, 'curveToUse[0]')) == 0
points = [dict(distance=float(parameter(339248780, f'AkRTPCGraphPoint:{i}/From')),
    storedValue=float(parameter(339248780, f'AkRTPCGraphPoint:{i}/To')),
    interpolation=int(parameter(339248780, f'AkRTPCGraphPoint:{i}/Interp'))) for i in range(6)]
profile['attenuation'] = dict(id=339248780, scaling=2, points=points, unresolvedOutputBusId=1259461568)
output = Path('src/content/lux-e-audio.ts')
output.write_text('// Generated by tools/assets/export-lux-e-audio.py.\n'
    '// Source policy; native dispatch, random state, voice priority and bus mix remain unverified.\n'
    + 'export const LUX_E_AUDIO = ' + json.dumps(profile, indent=2) + ' as const;\n')
subprocess.run(['npx', 'prettier', '--write', str(output)], check=True, stdout=subprocess.DEVNULL)
print(json.dumps(dict(roles={k: dict(variants=len(profile[k]['variants']), gainDb=profile[k]['gainDb'], seconds=profile[k]['maxDurationSeconds']) for k in ['cast', 'flight', 'zone', 'zoneDelayed', 'hit']},
    shippedBytes=sum((Path('public') / v['url']).stat().st_size for k in ['cast', 'flight', 'zone', 'zoneDelayed', 'hit'] for v in profile[k]['variants']))))

manifest_path = Path('public/assets/reference-manifest.json')
manifest = json.loads(manifest_path.read_text())
manifest['assets'] = [a for a in manifest['assets'] if not a['path'].startswith('/assets/audio/lux-e-')]
for role in ['cast', 'flight', 'zone', 'zoneDelayed', 'hit']:
    for v in profile[role]['variants']:
        raw = (Path('public') / v['url']).read_bytes()
        source = next(m for m in graph['media'] if m['id'] == v['id'])
        manifest['assets'].append(dict(path='/' + v['url'], bytes=len(raw), sha256=sha(raw),
            source='Pinned Lux base Wwise BNK, embedded WEM ' + str(v['id']),
            sourceGraph='docs/reference/lux-e-audio.json', sourceGraphSha256=sha(graph_path.read_bytes()),
            encodedSha256=source['sha256'], decoderRevision=decoded['decoder']['revision'],
            conversion='vgmstream -i -W 4; unchanged mono 44100 Hz float32 master; no normalization, resampling or loop expansion'))
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')

import math
tail = math.ceil(max(profile[k]['delaySeconds'] + profile[k]['maxDurationSeconds'] for k in ['cast', 'flight', 'zone', 'zoneDelayed', 'hit']) * 60) + 1
Path('src/content/lux-e-audio-timing.ts').write_text(
    '// Generated by tools/assets/export-lux-e-audio.py.\n'
    '// Conservative finite-clip history retention after stop; no source clip loops.\n'
    f'export const LUX_E_AUDIO_TAIL_TICKS = {tail};\n')
