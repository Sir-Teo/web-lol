"""Export pinned companion inputs; controlled runtime policies stay separate."""
import hashlib
import json
from pathlib import Path


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def data_values(spell):
    # Omitted native values remain absent, rather than silently becoming zero.
    return {v['name']: v.get('values', [None])[0] for v in spell['DataValues']}


source = Path('docs/reference/jungle-companions-source.json')
pin = json.loads(source.read_text())
records = pin['records']['data/characters/sru_jungle_companions/sru_jungle_companions.bin']
controller = next(
    v['mSpell'] for v in records.values()
    if isinstance(v, dict) and v.get('mScriptName') == 'PuppyControllerBuff'
)
profiles = {}
for identity, skin, item, prefix in [
    ('gustwalker', 0, '1102', 'fox_'),
    ('scorchclaw', 1, '1101', ''),
    ('mosstomper', 2, '1103', 'sal_'),
]:
    manifest = json.loads(Path(
        f'public/assets/models/sru-jungle-companions-skin{skin}-base.json'
    ).read_text())
    assert manifest['definitionsSha256'] == sha(source)
    # Keep the first retained graph alias when multiple states share an ANM.
    by_file = {Path(c['source']).name: c for c in reversed(manifest['clips'])}
    files = dict(
        idle=prefix + 'idle.anm',
        run=prefix + 'run.anm',
        attack=prefix + ('attack1.anm' if skin == 1 else 'attack01.anm'),
        smite='sal_smite.anm' if skin == 2 else 'smite.anm',
        heal='sal_heal.anm' if skin == 2 else 'heal.anm',
        transform=prefix + 'transform.anm',
        spawn=prefix + 'spawn.anm',
    )
    profiles[identity] = dict(
        name=pin['dataDragon']['items'][item]['name'],
        skinIndex=skin,
        rig=Path(manifest['output']['path']).stem,
        modelSha256=manifest['output']['sha256'],
        clips={
            role: dict(name=by_file[file]['name'],
                       durationSeconds=by_file[file]['durationSeconds'])
            for role, file in files.items()
        },
    )

icons = json.loads(Path('docs/reference/owned-companion-icons.json').read_text())['icons']
assert len(icons) == 4
for icon in icons:
    assert sha(icon['path']) == icon['sha256']
shared = pin['shared']['records']
smite = shared['Shared/Spells/SummonerSmite']['mSpell']
values = data_values(smite)
heal = shared['Shared/Spells/Monster_Heal_Mis']['mSpell']
assert values['FirstPVPDamage'] == values['SecondPVPDamage']
radii = [
    shared[f'Shared/Spells/SummonerSmiteAvatar{variant}']['mSpell']['castRadius']
    for variant in ['Offensive', 'Utility', 'Defensive']
]
assert all(value == radii[0][0] for radius in radii for value in radius)
result = dict(
    sourcePin=str(source),
    sourceSha256=sha(source),
    status=('Controlled Gromp encounter adapter inputs. Native callbacks, timing, '
            'target/area gates, treat phase/caps, source graph dispatch and final '
            'item/role passives remain unverified.'),
    profiles=profiles,
    controllerValues=data_values(controller),
    petCalculations=smite['mSpellCalculations'],
    killRecovery=data_values(heal),
    icons=icons,
    firstEvolutionFeeds=pin['published']['firstEvolutionKills'],
    fullGrowthFeeds=pin['published']['fullQuestCounters'],
    upgradedSmiteDamage=int(values['SmiteUpgradedDamage']),
    finalSmiteDamage=int(values['Smite2ndUpgradedDamage']),
    championSmiteDamage=int(values['FirstPVPDamage']),
    # Normalize the source float32 fraction for the local 20% slow policy.
    championSmiteSlow=round(values['SmiteSlowAmount'], 6),
    championSmiteSlowSeconds=int(values['SmiteSlowDuration']),
    finalSmiteRadius=int(radii[0][0]),
    finalPassives={
        identity: dict(
            values={v['mName']: v.get('mValue') for v in record['mDataValues']},
            calculations=record['mItemCalculations'],
        )
        for identity, item in [('gustwalker', '1102'), ('scorchclaw', '1101'), ('mosstomper', '1103')]
        for record in [pin['itemSource']['records'][f'Items/{item}']]
    },
)
Path('src/content/owned-companions.json').write_text(json.dumps(result, indent=2) + '\n')
print('Exported three companion clips/rigs, controller/calculation inputs and four official upgrade icons')
