"""Export the pinned Perseverance curve. The five-second unit is documented by Riot 9.20."""
import json
from pathlib import Path
pin = json.loads(Path('docs/reference/garen-character.json').read_text())
spell = pin['records']['Characters/Garen/Spells/GarenPassiveAbility/GarenPassive']['mSpell']
timer = next(v['values'] for v in spell['DataValues'] if v['name'] == 'DamageTimer')
assert len(set(timer)) == 1
calc = spell['mSpellCalculations']['RegenCalc']
assert calc['__type'] == 'GameCalculation' and len(calc['mFormulaParts']) == 1
assert calc['mMultiplier']['__type'] == 'NumberCalculationPart'
curve = calc['mFormulaParts'][0]
assert curve['__type'] == 'ByCharLevelBreakpointsCalculationPart'
assert set(curve) == {'__type', 'mLevel1Value', 'mInitialBonusPerLevel', 'mBreakpoints'}
for b in curve['mBreakpoints']:
    assert set(b) == {'__type', 'mLevel', 'mBonusPerLevelAtAndAfter'} and b['__type'] == 'Breakpoint'
assert [b['mLevel'] for b in curve['mBreakpoints']] == [7, 14]
percent = curve['mLevel1Value']
values = [percent]
for level in range(2, 19):
    scale = curve['mInitialBonusPerLevel']
    for b in curve['mBreakpoints']:
        if level >= b['mLevel']: scale = b['mBonusPerLevelAtAndAfter']
    percent += scale
    values.append(percent)
# Normalize source float noise only after evaluating each complete level value.
fractions = [round(v * calc['mMultiplier']['mNumber'], 8) for v in values]
assert fractions[0] == 0.015 and fractions[-1] == 0.101
out = dict(interruptionSeconds=timer[0], ratePeriodSeconds=5, maxHealthFractionByLevel=fractions)
Path('src/content/garen-passive.ts').write_text('// Generated from pinned GarenPassive; five-second unit and interruption policy documented in docs/GAREN-PASSIVE.md.\nexport const GAREN_PASSIVE = '+json.dumps(out, indent=2)+' as const;\n')
print('Exported all 18 Perseverance levels and the classic interruption timer.')
