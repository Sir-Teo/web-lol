"""Derive the controlled Gromp encounter's scalars and clip aliases from pinned sources."""
import hashlib
import json
from pathlib import Path

raw = Path('docs/reference/jungle-character-source.json').read_bytes()
pin = json.loads(raw)
records = pin['records']['data/characters/sru_gromp/sru_gromp.bin']
root = records['Characters/SRU_Gromp/CharacterRecords/Root']
attack = next(v['mSpell'] for v in records.values()
              if isinstance(v, dict) and v.get('mScriptName') == 'SRU_GrompBasicAttack')
manifest = json.loads(Path('public/assets/models/sru-gromp-base.json').read_text())
clips = {}
for alias, suffix in [('idle1', '_idle1.anm'), ('run', '_run.anm'),
                      ('attack1', '_attack1.anm'), ('death', '_death.anm'), ('spawn', '_spawn.anm')]:
    # The ranged basic-attack state references the same attack file as the
    # ordinary attack state. Preserve the original full graph in its model pin.
    clip = next(v for v in manifest['clips'] if v['source'].endswith(suffix))
    clips[alias] = dict(name=clip['name'], durationSeconds=clip['durationSeconds'])
spawn_path = Path('docs/reference/gromp-spawn-source.json')
spawn = json.loads(spawn_path.read_text())
assert spawn['characterSourcePinSha256'] == hashlib.sha256(raw).hexdigest()
skin = pin['records']['data/characters/sru_gromp/skins/skin0.bin']['Characters/SRU_Gromp/Skins/Skin0']
spawn_submesh = next(v for v in skin['skinMeshProperties']['initialSubmeshToHide'].split(',')
                     if v.lower() == 'toad_spawn_mat')
result = dict(sourcePinSha256=hashlib.sha256(raw).hexdigest(),
    modelSha256=manifest['output']['sha256'],
    stats={key: root[field]['baseValue'] for key, field in [
        ('maxHp', 'baseHPModifiable'), ('damage', 'baseDamageModifiable'),
        ('armor', 'baseArmorModifiable'), ('magicResist', 'baseMR'),
        ('range', 'attackRangeModifiable'), ('speed', 'baseMoveSpeedModifiable'),
        ('attackSpeed', 'attackSpeedModifiable')]},
    radius=root['overrideGameplayCollisionRadius'],
    pathfindingRadius=root['pathfindingCollisionRadius'],
    gold=root['goldGivenOnDeath'], experience=root['expGivenOnDeath'],
    minionScore=root['minionScoreValue'], missileSpeed=attack['missileSpeed'],
    castFrame=attack['castFrame'], clips=clips,
    spawn=dict(sourcePin=str(spawn_path), sourcePinSha256=hashlib.sha256(spawn_path.read_bytes()).hexdigest(),
               leadupSeconds=spawn['legacySpawnDurationSeconds'], blendSeconds=spawn['cascadeBlendSeconds'],
               submesh=spawn_submesh,
               policy='Local protected lead-up ends at the existing camp ready deadline. The source spawn submesh is shown only during the spawn clip. Native timer/visibility dispatch, events/audio and active flags remain unverified.'),
    policy='Uses Root scalars and last-hit rewards. Frame conversion, leash/reset and spawn scheduling remain local policies, not verified native camp behavior.')
path = Path('src/content/gromp.json')
encoded = json.dumps(result, indent=2) + '\n'
if not path.exists() or path.read_text() != encoded:
    path.write_text(encoded)
print('Exported pinned Gromp encounter profile.')
