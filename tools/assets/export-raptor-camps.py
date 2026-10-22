"""Export source-linked six-raptor camps and exact side-specific emergence."""
import hashlib
import json
from pathlib import Path
from cdtb.binfile import compute_binhash

source = Path('docs/reference/raptor-camps-source.json')
pin = json.loads(source.read_text())
parent = json.loads(Path(pin['parents']['jungle-character-source']['path']).read_text())
profiles = {}
for species, name, slug in [('raptor', 'SRU_Razorbeak', 'sru-razorbeak'), ('raptor-mini', 'SRU_RazorbeakMini', 'sru-razorbeakmini')]:
    records = parent['records'][f'data/characters/{name.lower()}/{name.lower()}.bin']
    root = records[f'Characters/{name}/CharacterRecords/Root']
    attack = next(v['mSpell'] for v in records.values() if isinstance(v, dict) and v.get('mScriptName') == name + 'BasicAttack')
    manifest = json.loads(Path(f'public/assets/models/{slug}-base.json').read_text())
    aliases = {'idle1': 'idle_normal1_base' if species == 'raptor' else 'idle_normal1',
               'run': 'run', 'attack1': 'attack1', 'death': 'death_base'}
    aliases.update({'spawn': 'spawn', 'north_spawn': 'north_spawn'} if species == 'raptor' else
                   {'spawn': 'spawn2', **{key: key for key in
                     ['spawn2', 'spawn3', 'spawn4', 'north_spawn2', 'north_spawn3', 'north_spawn4']}})
    clips = {}
    for alias, state in aliases.items():
        match = [c for c in manifest['clips'] if c['state'].lower() == state or c['state'] == f'{{{compute_binhash(state):08x}}}']
        assert len(match) == 1, (name, alias)
        clips[alias] = dict(name=match[0]['name'], durationSeconds=match[0]['durationSeconds'], sourceState=state)
    damage = root.get('baseDamageModifiable', {}).get('baseValue')
    score = root.get('minionScoreValue')
    profiles[species] = dict(rig=slug + '-base', modelSha256=manifest['output']['sha256'],
        stats={key: root[field]['baseValue'] for key, field in [
            ('maxHp', 'baseHPModifiable'), ('armor', 'baseArmorModifiable'), ('magicResist', 'baseMR'),
            ('speed', 'baseMoveSpeedModifiable'), ('range', 'attackRangeModifiable'), ('attackSpeed', 'attackSpeedModifiable')]},
        sourceDamage=damage, localDamage=damage,
        sourceMinionScore=score, localMinionScore=round(score, 6),
        gold=root['goldGivenOnDeath'], experience=root['expGivenOnDeath'],
        radius=root['overrideGameplayCollisionRadius'], pathfindingRadius=root['pathfindingCollisionRadius'],
        castFrame=attack['castFrame'], clips=clips)
def point(p):
    return dict(x=p[0] - 7425, y=7425 - p[2])
result = dict(sourcePin=str(source), sourcePinSha256=hashlib.sha256(source.read_bytes()).hexdigest(), profiles=profiles,
    firstReadySeconds=55, respawnSeconds=135, leashRadius=650, cleanupSeconds=10,
    camps=[dict(id='order-raptors' if c['index'] == 3 else 'chaos-raptors', sourceIndex=c['index'],
                anchorEntity=c['anchorEntity'], leadupSeconds=c['settings']['SpawnDuration'], facingPoint=point(c['settings']['VisualFacing']),
                members=[dict(species='raptor' if m['character'] == 'SRU_Razorbeak' else 'raptor-mini',
                              point=point(m['locator']['transform'][3]), spawnClip=m['spawnClip']) for m in c['members']]) for c in pin['camps']],
    policies=['Root fractional minion score is preserved as sourceMinionScore. Local score rounds to six decimal places and displayed CS floors the accumulated total.',
              '55s first spawn and 650-unit leash use published baselines; precise native patience/reset timing remains unverified.',
              'Per-camp lead-up uses legacy SpawnDuration: order 1s and chaos 0.67s (60/40 ticks). 135s respawn adopts a legacy default.',
              'Raptor camp homes project legacy locators to the nearest valid imported navigation position using each species navigation radius; original locators remain unchanged in content.',
              'Base skin 0 is a local selection; the legacy script reads an unresolved external SkinOverrides table.',
              'Camp retaliation and nearby shared hard resets use the existing local group policy. Each survivor has a ten-second marked clock; cleanup grants no last-hit rewards. Native initialization/scaling, ranged attack dispatch, percentage-health damage, soft reset and complete effects/audio remain unverified.'],
    officialSources=['https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/',
                     'https://www.leagueoflegends.com/en-us/news/game-updates/patch-12-22-notes/'])
path = Path('src/content/raptor-camps.json')
text = json.dumps(result, indent=2) + '\n'
if not path.exists() or path.read_text() != text:
    path.write_text(text)
print('Exported both six-member raptor camps, source fractional CS and side-specific spawn bindings/timing')
