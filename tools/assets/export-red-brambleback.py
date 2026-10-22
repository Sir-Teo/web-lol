"""Export Red Root stats, normal-skin clips and separately labeled local policies."""
import hashlib
import json
from pathlib import Path

source = Path('docs/reference/red-brambleback-source.json')
pin = json.loads(source.read_text())
parent = json.loads(Path(pin['parents']['jungle-character-source']['path']).read_text())
records = parent['records']['data/characters/sru_red/sru_red.bin']
root = records['Characters/SRU_Red/CharacterRecords/Root']
attack = next(v['mSpell'] for v in records.values()
              if isinstance(v, dict) and v.get('mScriptName') == 'SRU_RedBasicAttack')
assert attack['castFrame'] == int(attack['castFrame'])
manifest = json.loads(Path('public/assets/models/sru-red-base.json').read_text())
assert manifest['definitionsSha256'] == hashlib.sha256(source.read_bytes()).hexdigest()
graph = pin['records']['data/characters/sru_red/animations/skin0.bin'][pin['models']['SRU_Red']['graphKey']]
spawn_key = 0xe4cb0f58
spawn_blends = {k: v for k, v in graph['mBlendDataTable'].items()
                if int(k) >> 32 == spawn_key or int(k) & 0xffffffff == spawn_key}
assert len(spawn_blends) == 2 and all(v['mTime'] == 0 for v in spawn_blends.values())
assert graph['mCascadeBlendValue'] == 0
clips = {}
for alias, suffix in [('idle1', '_idle1.anm'), ('run', '_run.anm'), ('attack1', '_attack1.anm'),
                      ('death', '_death.anm'), ('spawn', '_spawn.anm')]:
    clip = next(c for c in manifest['clips'] if c['source'].endswith(suffix))
    clips[alias] = dict(name=clip['name'], durationSeconds=clip['durationSeconds'])
assert {c['settings']['SpawnDuration'] for c in pin['camps']} == {1.66}
assert {c['settings']['GroupsRespawnTime'] for c in pin['camps']} == {300}
assert {c['settings']['LeashRadius'] for c in pin['camps']} == {1000}


def point(v):
    return dict(x=v[0] - 7425, y=7425 - v[2])


result = dict(sourcePin=str(source), sourcePinSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
              modelSha256=manifest['output']['sha256'], rig='sru-red-base', skin=0,
              stats={key: root[field]['baseValue'] for key, field in [
                  ('maxHp', 'baseHPModifiable'), ('damage', 'baseDamageModifiable'),
                  ('armor', 'baseArmorModifiable'), ('magicResist', 'baseMR'),
                  ('speed', 'baseMoveSpeedModifiable'), ('attackSpeed', 'attackSpeedModifiable'),
                  ('range', 'attackRangeModifiable')]},
              radius=root['overrideGameplayCollisionRadius'], pathfindingRadius=root['pathfindingCollisionRadius'],
              gold=root['goldGivenOnDeath'], experience=root['expGivenOnDeath'], minionScore=root['minionScoreValue'],
              castFrame=int(attack['castFrame']), clips=clips,
              spawnBlendSeconds=graph['mCascadeBlendValue'],
              policy=dict(leadupSeconds=1.66, leashRadius=1000, sightRadius=1000,
                          resetHealthFractionPerSecond=0.2,
                          note='Legacy 1.66s SpawnDuration, 1000 leash and 300s respawn inform provisional local policies. Protection rounds to 100 ticks at 60Hz. Root supplies range 200. Normal skin 0 follows published removal of Baron corruption; placed Skin3 remains a documented conflict. Native activation, scaling, attack variants, buffs, effects and timing remain unfinished.'),
              firstReadySeconds=55, firstReadySource='https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/',
              respawnSeconds=300,
              camps=[dict(id=('order-red' if c['index'] == 4 else 'chaos-red'), sourceIndex=c['index'],
                          anchorEntity=c['anchorEntity'], point=point(c['locator']['transform'][3]),
                          facingPoint=point(c['settings']['VisualFacing'])) for c in pin['camps']],
              buffStatus='Crest of Cinders is not yet implemented; Red currently grants Root gold/XP/CS only.')
path = Path('src/content/red-brambleback.json')
text = json.dumps(result, indent=2) + '\n'
if not path.exists() or path.read_text() != text:
    path.write_text(text)
print('Exported Red Root range/stats, 32-tick melee contact, two source camp locators and explicit buff limitations')
