"""Export source-linked three-wolf camps and explicit missing-field policies."""
import hashlib
import json
from pathlib import Path
from cdtb.binfile import compute_binhash

source = Path('docs/reference/wolf-camps-source.json')
pin = json.loads(source.read_text())
parent = json.loads(Path(pin['parents']['jungle-character-source']['path']).read_text())
profiles = {}
for species, name, slug in [('wolf', 'SRU_Murkwolf', 'sru-murkwolf'), ('wolf-mini', 'SRU_MurkwolfMini', 'sru-murkwolfmini')]:
    records = parent['records'][f'data/characters/{name.lower()}/{name.lower()}.bin']
    root = records[f'Characters/{name}/CharacterRecords/Root']
    attack = next(v['mSpell'] for v in records.values() if isinstance(v, dict) and v.get('mScriptName') == name + 'BasicAttack')
    manifest = json.loads(Path(f'public/assets/models/{slug}-base.json').read_text())
    aliases = {'idle1': '{92e3d68c}', 'run': 'run_base', 'attack1': 'attack1_base',
               'death': 'death1_base' if species == 'wolf' else 'death_base'}
    aliases.update({'spawn': 'spawn_base'} if species == 'wolf' else
                   {'spawn': 'spawn_mini1_base', 'spawn_mini1': 'spawn_mini1_base', 'spawn_mini2': 'spawn_mini2_base'})
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
        sourceDamage=damage, localDamage=damage if damage is not None else 20,
        sourceMinionScore=score, localMinionScore=score if score is not None else 1,
        gold=root['goldGivenOnDeath'], experience=root['expGivenOnDeath'],
        radius=root['overrideGameplayCollisionRadius'], pathfindingRadius=root['pathfindingCollisionRadius'],
        castFrame=attack['castFrame'], clips=clips)
def point(p):
    return dict(x=p[0] - 7425, y=7425 - p[2])
result = dict(sourcePin=str(source), sourcePinSha256=hashlib.sha256(source.read_bytes()).hexdigest(), profiles=profiles,
    firstReadySeconds=55, respawnSeconds=135, leadupSeconds=0.66, leashRadius=650, cleanupSeconds=10,
    camps=[dict(id='order-wolves' if c['index'] == 2 else 'chaos-wolves', sourceIndex=c['index'],
                anchorEntity=c['anchorEntity'], facingPoint=point(c['settings']['VisualFacing']),
                members=[dict(species='wolf' if m['character'] == 'SRU_Murkwolf' else 'wolf-mini',
                              point=point(m['locator']['transform'][3]), spawnClip=m['spawnClip']) for m in c['members']]) for c in pin['camps']],
    policies=['Small-wolf Root omits damage and CS. Local 20 damage and 1 CS remain provisional; absent source fields remain null.',
              '55s first spawn and 650-unit leash use published baselines; precise native patience/reset timing remains unverified.',
              '0.66s lead-up rounds to 40 ticks; 135s respawn adopts a legacy default.',
              'Camp retaliation is local; nearby members share resets only while the leader lives. Each survivor has its own ten-second marked clock using local combat classification; cleanup grants no last-hit rewards. Native timing, source animation selection, scaling and complete rewards remain unverified.'],
    officialSources=['https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/',
                     'https://www.leagueoflegends.com/en-us/news/game-updates/patch-12-22-notes/'])
path = Path('src/content/wolf-camps.json')
text = json.dumps(result, indent=2) + '\n'
if not path.exists() or path.read_text() != text:
    path.write_text(text)
print('Exported both three-member wolf camps, exact spawn-variant bindings and explicit small-wolf omissions')
