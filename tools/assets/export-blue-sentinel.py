"""Export Root Blue scalars, normal-skin aliases and explicit local policies."""
import hashlib
import json
from pathlib import Path

source = Path('docs/reference/blue-sentinel-source.json')
pin = json.loads(source.read_text())
parent = json.loads(Path(pin['parents']['jungle-character-source']['path']).read_text())
records = parent['records']['data/characters/sru_blue/sru_blue.bin']
root = records['Characters/SRU_Blue/CharacterRecords/Root']
attack = next(v['mSpell'] for v in records.values()
              if isinstance(v, dict) and v.get('mScriptName') == 'SRU_BlueBasicAttack')
assert attack['castFrame'] == int(attack['castFrame']), 'Expected an integral authored cast frame'
manifest = json.loads(Path('public/assets/models/sru-blue-base.json').read_text())
assert 'attackRangeModifiable' not in root
clips = {}
for alias, suffix in [('idle1', '_idle_normal.anm'), ('run', '_run.anm'), ('attack1', '_attack1.anm'),
                      ('death', '_death.anm'), ('spawn', '_spawn.anm')]:
    c = next(c for c in manifest['clips'] if c['source'].endswith(suffix))
    clips[alias] = dict(name=c['name'], durationSeconds=c['durationSeconds'])


def point(v):
    return dict(x=v[0] - 7425, y=7425 - v[2])


result = dict(sourcePin=str(source), sourcePinSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
              modelSha256=manifest['output']['sha256'], rig='sru-blue-base', skin=0,
              stats={key: root[field]['baseValue'] for key, field in [
                  ('maxHp', 'baseHPModifiable'), ('damage', 'baseDamageModifiable'),
                  ('armor', 'baseArmorModifiable'), ('magicResist', 'baseMR'),
                  ('speed', 'baseMoveSpeedModifiable'), ('attackSpeed', 'attackSpeedModifiable')]},
              sourceAttackRange=None, radius=root['overrideGameplayCollisionRadius'],
              pathfindingRadius=root['pathfindingCollisionRadius'], gold=root['goldGivenOnDeath'],
              experience=root['expGivenOnDeath'], minionScore=root['minionScoreValue'],
              castFrame=int(attack['castFrame']), clips=clips,
              policy=dict(attackRange=175, leadupSeconds=1.1, leashRadius=1000,
                          sightRadius=1000, resetHealthFractionPerSecond=0.2,
                          note='Root omits attack range; 175 is a provisional local melee range, not a recovered value. Legacy 1.1s spawn duration/1000 leash and 300s respawn inform local policies. Normal skin follows published removal of Baron corruption; native activation, buffs, scaling and timing remain unverified.'),
              firstReadySeconds=55, respawnSeconds=300,
              camps=[dict(id=('order-blue' if c['index'] == 1 else 'chaos-blue'), sourceIndex=c['index'],
                          anchorEntity=c['anchorEntity'], point=point(c['locator']['transform'][3]),
                          facingPoint=point(c['settings']['VisualFacing'])) for c in pin['camps']],
              buffStatus='Crest of Insight gameplay and transfer are implemented; see docs/CREST-OF-INSIGHT.md. Native regeneration bindings, timing and sharing remain unverified.',
              buffHasteSource='https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-14-notes/')
path = Path('src/content/blue-sentinel.json')
text = json.dumps(result, indent=2) + '\n'
if not path.exists() or path.read_text() != text:
    path.write_text(text)
print('Exported normal-skin Blue Sentinel, two source-linked camps, and explicit range/buff limitations')
