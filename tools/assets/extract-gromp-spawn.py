"""Retain a bounded legacy timer window and the source spawn-clip contract."""
import hashlib
import json
from pathlib import Path
from lua51 import read_chunk, named_functions, instruction

sha = lambda raw: hashlib.sha256(raw).hexdigest()
parent_path = Path('docs/reference/jungle-script-source.json')
parent = json.loads(parent_path.read_text())
path = 'data/shared/scripts/sr_neutralminionspawn.luabin64'
source = Path('.cache/jungle-camp-research/sources') / path
raw = source.read_bytes()
file = next(f for f in parent['extraction']['files'] if f['path'] == path)
assert sha(raw) == file['sha256'] and len(raw) == file['bytes']
proto = named_functions(read_chunk(raw))['NeutralMinionDeath']
window = [instruction(proto, pc) for pc in range(371, 393)]
assert window[0]['operands'][1] == {'constant': 'InitNeutralMinionTimer'}
assert window[9]['operands'][2] == {'constant': 'GroupsRespawnTime'}
assert window[12]['operands'][2] == {'constant': 'SpawnDuration'}
assert window[13]['op'] == 'SUB' and window[13]['operands'] == [9, {'register': 9}, {'register': 10}]
assert window[16]['operands'][2] == {'constant': 'SpawnDuration'}
assert window[-1]['op'] == 'CALL' and window[-1]['operands'] == [6, 7, 1]
character_path = Path('docs/reference/jungle-character-source.json')
records = json.loads(character_path.read_text())['records']
graph = next(v for v in records['data/characters/sru_gromp/animations/skin0.bin'].values()
             if isinstance(v, dict) and v.get('__type') == 'AnimationGraphData')
clip = graph['mClipDataMap']['{e4cb0f58}']
manifest_path = Path('public/assets/models/sru-gromp-base.json')
manifest = json.loads(manifest_path.read_text())
converted = next(c for c in manifest['clips'] if c['state'] == '{e4cb0f58}')
assert converted['source'] == clip['mAnimationResourceData']['mAnimationFilePath']
spawn_key = int('e4cb0f58', 16)
spawn_blends = {k: v for k, v in graph['mBlendDataTable'].items()
                if int(k) >> 32 == spawn_key or int(k) & 0xffffffff == spawn_key}
assert len(spawn_blends) == 2 and all(v['mTime'] == 0 for v in spawn_blends.values())
durations = {c['literalSettings']['SpawnDuration'] for c in parent['camps']}
assert durations == {3.2} and converted['durationSeconds'] == 4.5
result = dict(scriptSourcePin=str(parent_path), scriptSourcePinSha256=sha(parent_path.read_bytes()),
              characterSourcePin=str(character_path), characterSourcePinSha256=sha(character_path.read_bytes()),
              modelManifest=str(manifest_path), modelManifestSha256=sha(manifest_path.read_bytes()),
              timerEvidence=dict(path=path, function='NeutralMinionDeath', codeSha256=proto['codeSha256'],
                                 firstPc=371, lastPc=392, instructions=window),
              atomicClip=clip, convertedClip=converted, cascadeBlendSeconds=graph['mCascadeBlendValue'],
              spawnBlendEntries=spawn_blends,
              legacySpawnDurationSeconds=3.2,
              status='Static source data. Timer call subtracts SpawnDuration from GroupsRespawnTime and passes SpawnDuration separately. Engine timer semantics and active native flags remain unknown. Local scheduling interprets duration as a protected lead-up to the existing ready deadline; clip playback continues until completion or combat interruption. Spawn submesh/events/audio remain separate work.')
target = Path('docs/reference/gromp-spawn-source.json')
if target.exists():
    assert json.loads(target.read_text()) == result, 'Pinned spawn evidence changed'
else:
    target.write_text(json.dumps(result, indent=2) + '\n')
print('Pinned 22 timer instructions, 4.5s source clip, 3.2s legacy duration and zero spawn/cascade blends')
