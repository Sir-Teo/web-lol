"""Export prepared Scuttler evidence; no ordinary-monster combat policy is inferred."""
import hashlib
import json
from pathlib import Path

source = Path('docs/reference/scuttler-source.json')
pin = json.loads(source.read_text())
parent = json.loads(Path(pin['parents']['jungle-character-source']['path']).read_text())
records = parent['records']['data/characters/sru_crab/sru_crab.bin']
root = records['Characters/Sru_Crab/CharacterRecords/Root']
manifest = json.loads(Path('public/assets/models/sru-crab-base.json').read_text())
clips = {}
for clip in manifest['clips']:
    # Filename-derived review labels preserve the original graph key separately.
    alias = Path(clip['source']).stem.removeprefix('sru_crab_')
    assert alias not in clips
    clips[alias] = dict(name=clip['name'], sourceState=clip['state'], durationSeconds=clip['durationSeconds'])
shrine = next(v['mSpell'] for v in records.values() if isinstance(v, dict) and v.get('mScriptName') == 'Sru_CrabShrineStats')
def point(p):
    return dict(x=p[0] - 7425, y=7425 - p[2])
def points(table):
    return [point(table[key]) for key in sorted(table, key=int)]
result = dict(sourcePin=str(source), sourcePinSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    status='Source evidence for the provisional live Scuttler adapter. Native timing, callbacks and visual calibration remain unverified.',
    rig='sru-crab-base', modelSha256=manifest['output']['sha256'],
    stats={key: root[field]['baseValue'] for key, field in [
        ('maxHp', 'baseHPModifiable'), ('damage', 'baseDamageModifiable'), ('armor', 'baseArmorModifiable'),
        ('magicResist', 'baseMR'), ('speed', 'baseMoveSpeedModifiable'), ('range', 'attackRangeModifiable'),
        ('attackSpeed', 'attackSpeedModifiable')]},
    unitTags=root['unitTagsString'], peacefulTag='Special_Peaceful',
    gold=root['goldGivenOnDeath'], experience=root['expGivenOnDeath'], minionScore=root['minionScoreValue'],
    radius=root['overrideGameplayCollisionRadius'], pathfindingRadius=root['pathfindingCollisionRadius'],
    rootUntargetableSpawnSeconds=root['untargetableSpawnTime'], clips=clips,
    shrineEffectAmountCandidates=[item.get('value') for item in shrine['mEffectAmount'][:3]],
    firstReadyBaselineSeconds=175,
    firstReadyBaselineUrl='https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/',
    camps=[dict(id=c['side'] + '-scuttler', sourceIndex=c['index'], anchorEntity=c['anchorEntity'],
                point=point(c['members'][0]['locator']['transform'][3]),
                facingPoint=point(c['settings']['VisualFacing']),
                legacySpawnClip=c['members'][0]['spawnClip'], legacyLeadupSeconds=c['settings']['SpawnDuration'],
                legacyFirstReadySeconds=c['settings']['GroupDelaySpawnTime'],
                legacyRespawnSeconds=c['settings']['GroupsRespawnTime']) for c in pin['camps']],
    rivers={side: dict(path=points(v['region']['Path']), topBorder=points(v['region']['TopBorder']),
                       bottomBorder=points(v['region']['BottomBorder']), center=point(v['region']['CenterPos']),
                       start=point(v['region']['StartPos']), end=point(v['region']['EndPos']),
                       initialOneBasedDestination=v['region']['Dest'], initialDirection=v['region']['Dir'])
            for side, v in pin['rivers'].items()},
    limits=['Root damage/range do not establish an attack: Special_Peaceful and component behavior must be respected.',
            'All seventeen clips are retained. The source graph has no attack/death atomic clip; review labels are filename-derived, not invented source states.',
            'The 1.5s Root untargetability, 2.2s legacy lead-up and ~1.6s emergence clip remain separate; active callback/graph timing requires calibration.',
            'The legacy feature-gated controller starts with two rivers, then coordinates a later selected location, with streak-biased random thresholds. Current native feature flags and lifecycle need verification.',
            'Shrine arrays 90/0.3/2 are retained as effect-slot candidates, not certified callback bindings. Runtime policy is separate.',
            'Base skin 0 is a local review choice; SkinOverrides, later forms, scaling, collision, graph dispatch, shrine visuals/audio and complete native integration remain unfinished.'])
path = Path('src/content/scuttler.json')
text = json.dumps(result, indent=2) + '\n'
if not path.exists() or path.read_text() != text:
    path.write_text(text)
print('Exported Scuttler source evidence, both river paths and distinct timing values; live adapters remain in scuttler-policy.ts')
