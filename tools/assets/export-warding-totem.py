"""Export supported Stealth Ward scalars; missing callback policy stays separate."""
import json
from pathlib import Path
from riot_archive import sha
p=Path('docs/reference/warding-totem-source.json');d=json.loads(p.read_text())
r=d['records']['data/characters/sightward/sightward.bin']['Characters/SightWard/CharacterRecords/Root']
i=d['items']['records']['Items/3340'];s=d['items']['records']['Items/Spells/TrinketTotemLvl1']['mSpell']
v={x['mName']:x['mValue'] for x in i['mDataValues']}
m=json.loads(Path('public/assets/models/sightward-base.json').read_text())
assert m['definitionsSha256']==sha(p.read_bytes())
profile=dict(sourceSha256=sha(p.read_bytes()),range=s['castRange'][0],sightRadius=r['perceptionBubbleRadius'],health=r['baseHPModifiable']['baseValue'],radius=r['overrideGameplayCollisionRadius'],pathfindingRadius=r['pathfindingCollisionRadius'],healthBarHeight=r['healthBarHeight'],sourceGold=r['goldGivenOnDeath'],sourceXP=r['expGivenOnDeath'],maxCharges=int(v['MaxAmmo']),maxPlaced=int(v['MaxWardsPlaced']),minLifeSeconds=i['mEffectAmount'][0],maxLifeSeconds=i['mEffectAmount'][2],earlyRechargeSeconds=v['StartingSingleChargeTime'],lateRechargeSeconds=v['EndingSingleChargeTime'],cooldownSeconds=s['cooldownTime'][0],preservesRecall=s['mDoesntBreakChannels'],ignoresAbilityHaste=s['mAmmoNotAffectedByCDR'],tags=r['unitTagsString'].split(' | '),placementTravelSeconds=d['shared']['records']['Shared/Spells/TrinketTotemTravel']['mSpell']['mMissileSpec']['movementComponent']['mTravelTime'],rig='sightward-base',clips={role:dict(clip=next(c['name']for c in m['clips']if c['source'].endswith(file)),durationSeconds=next(c['durationSeconds']for c in m['clips']if c['source'].endswith(file))) for role,file in [('idle','sightward_base_idle.anm'),('spawn','sightward_base_idlein.anm'),('death','sightward_base_idle_death.anm')]})
Path('src/content/warding-totem.json').write_text(json.dumps(profile,indent=2)+'\n')
print('Exported pinned Stealth Ward scalar/rig profile; callback/scaling/startup policies are separate')
