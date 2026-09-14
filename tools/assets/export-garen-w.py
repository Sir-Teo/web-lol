"""Export root-mode Courage values. Bonus-health interpretation: docs/GAREN-W.md."""
import json
from pathlib import Path

pin = json.loads(Path('docs/reference/garen-character.json').read_text())
spell = pin['records']['Characters/Garen/Spells/GarenWAbility/GarenW']['mSpell']
assert spell['mClientData']['mTooltipData']['mLists']['LevelUp']['levelCount'] == 5
assert spell['mTargetingTypeData']['__type'] == 'Self'
values = {v['name']: v.get('values') for v in spell['DataValues']}

def scalar(name):
    value = values[name]
    assert value is not None and len(value) == 7 and len(set(value)) == 1
    return value[0]

def ranks(value):
    assert value is not None and len(value) == 7
    return value[1:6]

assert spell['mSpellCalculations']['TotalShield'] == {
    '__type': 'GameCalculation',
    'mFormulaParts': [
        {'__type': 'NamedDataValueCalculationPart', 'mDataValue': 'BaseShield'},
        {'__type': 'StatByNamedDataValueCalculationPart', 'mStat': 12,
         'mStatFormula': 2, 'mDataValue': 'ShieldHealthRatio'},
    ],
}
# An omitted value is unknown, not an inferred zero or one.
assert values['NormalResistKillValue'] is None
out = dict(
    baseShieldByRank=ranks(values['BaseShield']),
    bonusHealthShieldRatio=scalar('ShieldHealthRatio'),
    damageReductionByRank=ranks(values['DRPercent']),
    damageReductionSeconds=scalar('DRDuration'),
    upfrontTenacity=scalar('UpfrontTenacity'),
    upfrontSeconds=scalar('UpfrontDuration'),
    cooldownSecondsByRank=ranks(spell['cooldownTime']),
    resistGainPerStack=scalar('ResistGainOnKill'),
    maxResistGain=scalar('ResistMax'),
    buffCounterPerKill=scalar('BuffCounterPerKill'),
    largeMonsterStacks=scalar('LargeMonsterStacks'),
    epicMonsterStacks=scalar('EpicMonsterStacks'),
)
Path('src/content/garen-w.ts').write_text(
    '// Generated root-mode Courage data; interpretation and integration limits: docs/GAREN-W.md.\n'
    'export const GAREN_W = ' + json.dumps(out, indent=2) + ' as const;\n')
print('Exported Courage ranks and separate defense windows; no missing kill value inferred.')
