"""Project frozen Meditate declarations, keeping omitted cooldown/stat IDs explicit.

Activation, channel pulse/cancellation order, buff pauses and native graph
dispatch are separate controller policies. Existing output is never overwritten.
--output supports isolated source preparation before runtime integration.
"""
import argparse
import hashlib
import json
import runpy
from pathlib import Path

source = runpy.run_path(str(Path(__file__).with_name('export-masteryi-declarations.py')))
ROOT, require = source['ROOT'], source['require']
SPELL = 'Characters/MasterYi/Spells/MeditateAbility/Meditate'


def generate():
    pin, dd = source['load']()
    records = pin['records']
    spell = records[SPELL]['mSpell']
    require(records[source['ROOT_RECORD']]['spells'][1] == SPELL, 'W root binding changed')
    values = {row['name']: row['values'] for row in spell['DataValues']}
    require(values['BaseHeal'] == [40.0, 120.0, 200.0, 280.0, 360.0, 440.0, 520.0],
            'Standard heal ranks changed')
    require(values['DamageReduction'] == [0.42500001192092896, 0.44999998807907104,
            0.4749999940395355, 0.5, 0.5249999761581421, 0.550000011920929, 0.574999988079071],
            'Damage reduction ranks changed')
    require(values['InitialExtraDR'] == [0.2750000059604645, 0.25, 0.22499999403953552,
            0.20000000298023224, 0.17499999701976776, 0.15000000596046448, 0.125],
            'Initial extra reduction ranks changed')
    scalars = dict(HealDuration=4.0, MaxMissingHealthPercent=1.0, TickFrequency=0.5,
                   DamageReductionTowerMod=0.5, BaseManaCost=40.0,
                   PercentManaCostPerSecond=0.05999999865889549,
                   InitialExtraDRDuration=0.5, DRLinger=0.5)
    require(set(values) == {'BaseHeal', 'DamageReduction', 'InitialExtraDR', *scalars},
            'Named value set changed')
    for name, value in scalars.items():
        require(values[name] == [value]*7, 'Named scalar changed: ' + name)
    heal = spell['mSpellCalculations']['TotalHeal']
    require(heal == {'mSimpleTooltipCalculationDisplay': 6,
        'mFormulaParts': [
            {'mDataValue': 'BaseHeal', '__type': 'NamedDataValueCalculationPart'},
            {'mCoefficient': 1.0, '__type': 'StatByCoefficientCalculationPart'},
        ], '__type': 'GameCalculation'}, 'Heal formula changed')
    require(spell['mSpellCalculations']['InitialDR'] == {
        'mFormulaParts': [{'mSubparts': [
            {'mDataValue': 'DamageReduction', '__type': 'NamedDataValueCalculationPart'},
            {'mDataValue': 'InitialExtraDR', '__type': 'NamedDataValueCalculationPart'},
        ], '__type': 'SumOfSubPartsCalculationPart'}],
        'mDisplayAsPercent': True, '__type': 'GameCalculation',
    }, 'Initial reduction formula changed')
    public = dd['spells'][1]
    require(public['id'] == 'Meditate' and public['cost'] == [40]*5
            and public['cooldown'] == [10]*5 and spell['mana'] == [40.0]*6,
            'Public resources or source mana changed')
    require('cooldownTime' not in spell and 'Cooldown' not in spell,
            'Omitted source cooldown changed')
    require(spell['mTargetingTypeData']['__type'] == 'Self'
            and spell['spellCastTime'] == 0
            and spell['mAnimationName'] == spell['mAnimationLoopName'] == 'Spell2'
            and spell['mCantCancelWhileWindingUp'] is True,
            'Self/animation/windup declarations changed')
    require(spell['mSpellTags'] == ['Trait_ChannelSpell', 'Trait_AttackReset',
                                  'Trait_ActiveHeal', 'Trait_Parry'], 'Spell traits changed')
    model_bytes = (ROOT / 'docs/reference/masteryi-model.json').read_bytes()
    require(hashlib.sha256(model_bytes).hexdigest() ==
            '4295bceeba96cfb15e006d392e7d0f3c480bb51bf8cff8872a9c39fc9873c7ce',
            'Model declaration pin changed')
    model = json.loads(model_bytes)
    skin = model['skin']['data']['Characters/MasterYi/Skins/Skin0']
    graph = model['animations']['data'][skin['skinAnimationProperties']['animationGraphData']]
    require(graph['mClipDataMap']['Spell2'] == {
        'mClipNameList': ['Spell2_Loop'], '__type': 'SequencerClipData'
    }, 'Spell2 sequence changed')
    meta = json.loads((ROOT / 'public/assets/models/masteryi-base.json').read_bytes())
    for name, state in [('spell2_in', 'Spell2_In'), ('spell2_loop', 'Spell2_Loop')]:
        atom = graph['mClipDataMap'][state]
        exported = next(c for c in meta['clips'] if c['name'] == name)
        require(atom['__type'] == 'AtomicClipData' and atom['mTrackDataName'] == 'Default'
                and exported['state'] == state and exported['source'] ==
                atom['mAnimationResourceData']['mAnimationFilePath'].lower(),
                'Meditate pose alias differs: ' + state)
    data = dict(name=public['name'], description=public['description'], icon=public['id'],
                baseHealByRank=values['BaseHeal'][1:6], healCoefficient=1.0, sourceHealStatId=None,
                durationSeconds=scalars['HealDuration'], healTickSeconds=scalars['TickFrequency'],
                maximumMissingHealthBonusRatio=scalars['MaxMissingHealthPercent'],
                damageReductionByRank=values['DamageReduction'][1:6],
                initialExtraReductionByRank=values['InitialExtraDR'][1:6],
                initialExtraReductionSeconds=scalars['InitialExtraDRDuration'],
                reductionLingerSeconds=scalars['DRLinger'],
                turretReductionMultiplier=scalars['DamageReductionTowerMod'],
                manaByRank=spell['mana'][:5],
                maximumManaPerSecond=scalars['PercentManaCostPerSecond'],
                sourceCooldownSeconds=None, publicCooldownSecondsByRank=public['cooldown'],
                animationName='Spell2', graphSequence=['Spell2_Loop'],
                preparedEntryClip='spell2_in', preparedLoopClip='spell2_loop',
                authoredCastSeconds=0.0, authoredCannotCancelWindup=True,
                sourceTraits=spell['mSpellTags'], declaration=SPELL)
    return ('// Generated by tools/assets/export-masteryi-w.py.\n'
            '// Omitted cooldown/heal stat ID remain null; native channel dispatch is unresolved.\n'
            'export const MASTER_YI_W = ' + json.dumps(data, indent=2) + ' as const;\n').encode()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--output', type=Path, default=ROOT / 'src/content/masteryi-w.ts')
    args = parser.parse_args()
    source['publish'](generate(), args.output, args.check)
    print('Verified standard Meditate ranks, heal/reduction formulas, resource omissions, traits and source body aliases.')
