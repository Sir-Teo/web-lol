"""Join pinned spellbook timing fields with the shipped base animation clips.

This is a source audit, not a cast-time resolver. Missing flags remain null.
"""
import hashlib
import json
from pathlib import Path

def read(path):
    return json.loads(Path(path).read_text())

def sha(data):
    return hashlib.sha256(data).hexdigest()

raw = Path('.cache/ashe-16.18.json').read_bytes()
source = json.loads(raw)
root_name = 'Characters/Ashe/CharacterRecords/Root'
spellbook = source[root_name]['spells']
model_path = 'docs/reference/ashe-model.json'
model_bytes = Path(model_path).read_bytes()
model = json.loads(model_bytes)
manifest_path = 'public/assets/models/ashe-base.json'
manifest = read(manifest_path)
assert manifest['definitionsSha256'] == sha(model_bytes)
glb = Path('public' + manifest['output']['path']).read_bytes()
assert sha(glb) == manifest['output']['sha256']
graph_name = model['skin']['data']['Characters/Ashe/Skins/Skin0']['skinAnimationProperties']['animationGraphData']
graph = model['animations']['data'][graph_name]
clips = {clip['name']: clip for clip in manifest['clips']}

fields = ['spellCastTime', 'castFrame', 'useAnimatorFramerate', 'flags',
          'mCantCancelWhileWindingUp', 'mCantCancelWhileChanneling',
          'mCanMoveWhileChanneling', 'mDoNotNeedToFaceTarget']
rows = {}
pins = {}
for index, slot in enumerate('qwer'):
    path = f'docs/reference/ashe-{slot}.json'
    pin = read(path)
    assert sha(raw) == pin['sha256']
    record_name = pin.get('spell', pin.get('record'))
    assert spellbook[index] == record_name, f'{slot}: wrong spellbook record'
    record = source[record_name]
    assert record == pin.get('data', pin.get('records', {}).get(record_name))
    spell = record['mSpell']
    clip_name = spell['mAnimationName']
    atomic = graph['mClipDataMap'][clip_name]
    assert atomic['__type'] == 'AtomicClipData'
    clip = clips[clip_name.lower()]
    animation_path = atomic['mAnimationResourceData']['mAnimationFilePath'].lower()
    assert clip['source'] == animation_path
    pins[slot] = {'path': path, 'sha256': sha(Path(path).read_bytes())}
    rows[slot] = {
        'spellbookIndex': index,
        'record': record_name,
        'sourceFields': {field: spell.get(field) for field in fields},
        'tags': spell.get('mSpellTags', []),
        'animation': {
            'graphEntry': clip_name,
            'path': animation_path,
            'runtimeClip': clip['name'],
            'durationSeconds': clip['durationSeconds'],
        },
    }

report = {
    'status': 'Verified source fields and clip selection; native timing precedence and interruption semantics remain unresolved.',
    'source': {'url': pin['url'], 'sha256': sha(raw), 'root': root_name},
    'pins': pins,
    'model': {'path': model_path, 'sha256': sha(model_bytes), 'graph': graph_name,
              'runtimeManifest': manifest_path, 'glbSha256': sha(glb)},
    'missingFieldPolicy': 'null means absent in the selected source record, not false or a verified engine default.',
    'spells': rows,
    'findings': [
        'Q/W/E/R all declare spellCastTime 0.25; Q also has flags 4 and Trait_AttackReset. That number alone is insufficient to resolve activation behavior.',
        'W/R explicitly enable useAnimatorFramerate and record castFrame 7.5. E omits the flag and records castFrame 11.3100004196167. Preserve both timing sources.',
        'W/E/R explicitly set mCantCancelWhileWindingUp. This does not by itself classify movement, stun, death, Flash or other-spell interruption.',
        'Q activation and E both select Spell3. Q empowered attacks separately select Spell1; do not infer spell slot from animation suffix.',
        'The source animation duration is longer than the declared cast time. Playing the entire clip as a movement lock would conflate windup and recovery.',
    ],
}
Path('docs/reference/ashe-cast-timing.json').write_text(json.dumps(report, indent=2) + '\n')
print('Verified all four spellbook slots, source hashes, graph mappings and shipped GLB hash')
for slot, row in rows.items():
    print(slot.upper(), row['sourceFields'], row['animation']['runtimeClip'], row['animation']['durationSeconds'])
