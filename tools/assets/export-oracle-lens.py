"""Export verified Oracle scalars and geometry bindings, without gameplay policy."""
import json
from pathlib import Path
from riot_archive import sha

p = Path('docs/reference/oracle-lens-source.json')
d = json.loads(p.read_text())
a = Path('docs/reference/oracle-lens-assets.json')
assets = json.loads(a.read_text())
assert assets['sourcePinSha256'] == sha(p.read_bytes())
item = d['items']['records']['Items/3364']
spell = d['items']['records']['Items/Spells/TrinketSweeperLvl3']['mSpell']
values = {v['mName']: v['mValue'] for v in item['mDataValues']}
rig = json.loads(Path('public/assets/models/oracle-lens-base.json').read_text())
assert rig['definitionsSha256'] == sha(p.read_bytes())
for f in [assets['rig']['output']] + [m['output'] for m in assets['meshes']]:
    raw = Path('public'+f['path']).read_bytes()
    assert sha(raw) == f['sha256'] and len(raw) == f['bytes']
for t in assets['textures']:
    raw = Path(t['path']).read_bytes()
    assert sha(raw) == t['sha256'] and len(raw) == t['bytes']
textures = {t['source']['path']: t['path'].removeprefix('public/') for t in assets['textures']}
meshes = {m['source']['path']: m['output']['path'].removeprefix('/') for m in assets['meshes']}
bindings = {}
for e in d['items']['records']['Items/3364/Particles/3364_Buff']['complexEmitterDefinitionData']:
    if e['emitterName'] not in ['Trinket_Red', 'RadarMesh', 'CoreLaser', 'Lasers']: continue
    mesh = e['primitive']['mMesh']
    bindings[e['emitterName']] = dict(
        mesh='assets/models/oracle-lens-base.glb' if 'mMeshName' in mesh else meshes[mesh['mSimpleMeshName'].lower()],
        texture=textures[e['texture'].lower()], blendMode=e['blendMode'])
profile = dict(sourceSha256=sha(p.read_bytes()), assetsSha256=sha(a.read_bytes()),
    durationSeconds=values['Duration'], maxCharges=int(values['MaxAmmo']),
    earlyRechargeSeconds=values['StartingSingleChargeTime'], lateRechargeSeconds=values['EndingSingleChargeTime'],
    startingRadius=values['StartingRadius'], endingRadius=values['EndingRadius'],
    cooldownSeconds=spell['cooldownTime'][0], preservesRecall=spell['mDoesntBreakChannels'],
    ignoresAbilityHaste=spell['mAmmoNotAffectedByCDR'], targeting=spell['mTargetingTypeData']['__type'],
    rig='oracle-lens-base', clip=rig['clips'][0]['name'],
    animationDurationSeconds=rig['clips'][0]['durationSeconds'], bindings=bindings)
out = Path('src/content/oracle-lens.json')
raw = (json.dumps(profile, indent=2)+'\n').encode()
if not out.exists() or out.read_bytes() != raw: out.write_bytes(raw)
print('Exported Oracle Lens source scalars and four geometry bindings; callback policies remain separate')
