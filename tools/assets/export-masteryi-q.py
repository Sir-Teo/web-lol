"""Project frozen Alpha Strike declarations without inferring native bounce dispatch.

Use --output for preparation outside runtime fingerprint roots. Immutable output
and explicit guards remain active under optimized Python.
"""
import argparse
import json
import runpy
from pathlib import Path

source = runpy.run_path(str(Path(__file__).with_name('export-masteryi-declarations.py')))
ROOT, require = source['ROOT'], source['require']
ABILITY = 'Characters/MasterYi/Spells/AlphaStrikeAbility'
SPELL = ABILITY + '/AlphaStrike'


def generate():
    pin, dd = source['load']()
    records = pin['records']
    spell = records[SPELL]['mSpell']
    require(records[source['ROOT_RECORD']]['spells'][0] == SPELL, 'Q spellbook binding changed')
    require(records[ABILITY]['mRootSpell'] == SPELL and records[ABILITY]['mChildSpells'] == [
        ABILITY + '/' + name for name in ['AlphaStrike', 'AlphaStrikeBounce', 'AlphaStrikeMissile',
        'AlphaStrikeMissileReturn', 'AlphaStrikeTeleport', 'Alpha_Strike', 'Alpha_Striking',
        'AlphaStrikeCDR']], 'Q ability root/children changed')
    values = {row['name']: row['values'] for row in spell['DataValues']}
    require(values == {
        'SubsequentHitMultiplier': [0.25]*7,
        'BaseDamage': [0.0, 20.0, 40.0, 60.0, 80.0, 100.0, 120.0],
        'BonusMonsterDamage': [35.0, 60.0, 85.0, 110.0, 135.0, 160.0, 185.0],
        'AttackDamageRatio': [0.699999988079071]*7,
        'BonusCritDamageRatio': [1.0]*7,
        'BaseBasicAttackCDR': [1.0]*7,
        'AlphaStrikeBounces': [4.0]*7,
        'BaseOnHitMultiplier': [0.75]*7,
    }, 'Standard Q named values changed')
    public = dd['spells'][0]
    require(public['id'] == 'AlphaStrike' and public['maxrank'] == 5
            and public['cost'] == [50, 55, 60, 65, 70]
            and public['cooldown'] == [20, 19.5, 19, 18.5, 18]
            and public['range'] == [600]*5, 'Public Q identity/resources/range changed')
    require(spell['mana'] == [50.0, 55.0, 60.0, 65.0, 70.0, 75.0]
            and spell['cooldownTime'] == [20.5, 20.0, 19.5, 19.0, 18.5, 18.0, 17.5]
            and spell['castRange'] == [600.0]*7
            and spell['castRadius'] == [300.0]*7
            and spell['castRadiusSecondary'] == [550.0]*7, 'Source Q rank/radius slices changed')
    require('mAnimationName' not in spell and 'mTargetingTypeData' not in spell,
            'Q omitted animation/targeting declarations changed')
    require(spell['cantCastWhileRooted'] is True and spell['mCantCancelWhileWindingUp'] is True
            and spell['spellCastTime'] == 0.25 and spell['spellTotalTime'] == 1.0,
            'Q root/cast declarations changed')
    calculations = spell['mSpellCalculations']
    total = calculations['TotalDamage']['mFormulaParts']
    require(total == [
        {'mDataValue': 'BaseDamage', '__type': 'NamedDataValueCalculationPart'},
        {'mStat': 2, 'mDataValue': 'AttackDamageRatio',
         '__type': 'StatByNamedDataValueCalculationPart'}], 'Q damage formula/stat omission changed')
    require(calculations['SubesquentDamage']['mMultiplier']['mDataValue'] == 'SubsequentHitMultiplier'
            and calculations['SingleTotalDamage']['mModifiedGameCalculation'] == 'TotalDamage'
            and calculations['CritBonus']['mModifiedGameCalculation'] == 'TotalDamage'
            and calculations['{b0f66055}']['mModifiedGameCalculation'] == 'SubesquentDamage',
            'Q repeated/critical formula references changed')
    cdr = calculations['BasicAttackCDR']['mFormulaParts']
    require(cdr == [{'mPart1': {'__type': 'CooldownMultiplierCalculationPart'},
                    'mPart2': {'mDataValue': 'BaseBasicAttackCDR',
                              '__type': 'NamedDataValueCalculationPart'},
                    '__type': 'ProductOfSubPartsCalculationPart'}], 'Q basic-hit CDR formula changed')
    travel = {}
    for name, duration in [('AlphaStrikeMissile', 0.20000000298023224),
                           ('AlphaStrikeBounce', 0.18000000715255737),
                           ('AlphaStrikeMissileReturn', 0.15000000596046448)]:
        child = records[ABILITY + '/' + name]['mSpell']
        movement = child['mMissileSpec']['movementComponent']
        require(movement['__type'] == 'FixedTimeMovement' and movement['mTravelTime'] == duration,
                'Q fixed-time child movement changed: ' + name)
        travel[name] = duration
    data = dict(name=public['name'], description=public['description'], icon=public['id'],
                baseDamageByRank=values['BaseDamage'][1:6],
                bonusMonsterDamageByRank=values['BonusMonsterDamage'][1:6],
                attackDamageRatio=values['AttackDamageRatio'][0],
                damageStatId=total[1]['mStat'], sourceDamageStatFormula=None,
                subsequentHitMultiplier=values['SubsequentHitMultiplier'][0],
                bounceCount=4, onHitMultiplier=values['BaseOnHitMultiplier'][0],
                bonusCritDamageRatio=values['BonusCritDamageRatio'][0],
                basicAttackCooldownReductionSeconds=values['BaseBasicAttackCDR'][0],
                basicAttackCooldownReductionUsesCooldownMultiplier=True,
                manaByRank=spell['mana'][:5], cooldownSecondsByRank=spell['cooldownTime'][1:6],
                castRange=spell['castRange'][0], authoredRadius=spell['castRadius'][0],
                authoredSecondaryRadius=spell['castRadiusSecondary'][0],
                sourceAnimationName=None, sourceTargetingType=None,
                cantCastWhileRooted=True, authoredCastSeconds=spell['spellCastTime'],
                authoredTotalSeconds=spell['spellTotalTime'], childTravelSeconds=travel,
                declaration=SPELL)
    return ('// Generated by tools/assets/export-masteryi-q.py.\n'
            '// Targeting, bounce timing, on-hit dispatch and immunity are unresolved controller policies.\n'
            'export const MASTER_YI_Q = ' + json.dumps(data, indent=2) + ' as const;\n').encode()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--output', type=Path, default=ROOT / 'src/content/masteryi-q.ts')
    args = parser.parse_args()
    source['publish'](generate(), args.output, args.check)
    print('Verified standard Alpha Strike ranks, formula references/omissions, root restriction and child travel declarations.')
