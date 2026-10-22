"""Export source-linked Krug profiles, initial camps and explicit splitting adapters."""
import hashlib
import json
from pathlib import Path
from cdtb.binfile import compute_binhash

source = Path('docs/reference/krug-camps-source.json')
pin = json.loads(source.read_text())
parent = json.loads(Path(pin['parents']['jungle-character-source']['path']).read_text())
profiles = {}
for species, name, slug in [('krug', 'SRU_Krug', 'sru-krug'), ('krug-medium', 'SRU_KrugMini', 'sru-krugmini'), ('krug-mini', 'SRU_KrugMiniMini', 'sru-krugminimini')]:
    records = parent['records'][f'data/characters/{name.lower()}/{name.lower()}.bin']
    root = records[f'Characters/{name}/CharacterRecords/Root']
    attack = next(v['mSpell'] for v in records.values() if isinstance(v, dict) and v.get('mScriptName') == name + 'BasicAttack')
    manifest = json.loads(Path(f'public/assets/models/{slug}-base.json').read_text())
    aliases = {'idle1': 'idle_normal_base' if species == 'krug' else '{2f4723e4}',
               'run': 'run', 'attack1': 'attack1' if species == 'krug' else 'attack1_base', 'death': 'death',
               'spawn': 'spawn'}
    aliases.update({'spawn_nj': 'spawn_nj'} if species == 'krug' else {'spawn_north_jung': 'spawn_north_jung'})
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
    firstReadySeconds=67, respawnSeconds=135, leashRadius=650, cleanupSeconds=10,
    camps=[dict(id='order-krugs' if c['index'] == 5 else 'chaos-krugs', sourceIndex=c['index'],
                anchorEntity=c['anchorEntity'], leadupSeconds=c['settings']['SpawnDuration'], facingPoint=point(c['settings']['VisualFacing']),
                members=[dict(species='krug' if m['character'] == 'SRU_Krug' else 'krug-medium',
                              point=point(m['locator']['transform'][3]), spawnClip=m['spawnClip']) for m in c['members']]) for c in pin['camps']],
    splits=[dict(parentSlot=0, childSlots=[2, 3, 4, 5], species='krug-mini'),
            dict(parentSlot=1, childSlots=[6, 7], species='krug-mini')],
    splitDelaySeconds=1, splitRadius=90,
    policies=['67s first ready uses the published 26.1 baseline; 135s respawn adopts the legacy default.',
              '0.86s initial emergence rounds to 52 ticks; the legacy 900 leash is retained as evidence while local gameplay uses the published 650 baseline.',
              'Published 12.22 changes Ancient Krug to four minis after one second. Medium-to-two-mini is a local retained splitting policy; current native callbacks remain unavailable in the character stubs/spawn-manager metadata.',
              'Local split homes use a 90-unit radial layout at the parent death point, projected through the imported navigation grid. Mini launch missiles/particles and native placement remain unimplemented.',
              'Local cleanup suppresses new split children and grants no rewards. Native cleanup/splitting ordering remains unverified.',
              'Base skin 0 is a local selection; the legacy script reads an unresolved external SkinOverrides table.',
              'Root stats/rewards, six-decimal CS and source clip durations are retained. Native scaling, attack-speed modifiers, percentage-health damage, full patience, graph transitions and effects/audio remain unfinished.'],
    officialSources=['https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/',
                     'https://www.leagueoflegends.com/en-us/news/game-updates/patch-12-22-notes/'])
path = Path('src/content/krug-camps.json')
text = json.dumps(result, indent=2) + '\n'
if not path.exists() or path.read_text() != text:
    path.write_text(text)
print('Exported all three Krug profiles, both initial camps and explicit split policies')
