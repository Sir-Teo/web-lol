import { ASHE_Q } from '../content/ashe-q';
import { ASHE_W } from '../content/ashe-w';
import { ASHE_E } from '../content/ashe-e';
import { ASHE_R } from '../content/ashe-r';
import { ASHE_SPELL_RANKS } from '../content/ashe-spell-ranks';

export type AsheSpell = keyof typeof ASHE_SPELL_RANKS;

/** Learned ranks only. Rank zero must be handled by cast/learning validation. */
export function asheSpellResources(ability: AsheSpell, rank: number) {
  const spec = ASHE_SPELL_RANKS[ability];
  if (!Number.isInteger(rank) || rank < 1 || rank > spec.rankCount)
    throw new RangeError(`Invalid ${ability.toUpperCase()} rank: ${rank}`);
  return {
    mana: spec.manaByRank[rank - 1],
    cooldownSeconds: spec.cooldownSecondsByRank[rank - 1],
  };
}

export function asheFocusValues(rank: number) {
  return {
    ...asheSpellResources('q', rank),
    bonusAttackSpeed: ASHE_Q.bonusAttackSpeedByRank[rank - 1],
    damageMultiplier: ASHE_Q.damageMultiplierByRank[rank - 1],
  };
}

/** Per-arrow payload preparation. Release timing and hit dispatch are separate. */
export function asheFocusFlurry(rank: number, attackDamage: number) {
  if (!Number.isFinite(attackDamage) || attackDamage < 0)
    throw new RangeError('Attack damage must be finite and nonnegative');
  const total = attackDamage * asheFocusValues(rank).damageMultiplier;
  return ASHE_Q.flurrySpellNames.map((spell, index) => ({
    spell,
    damage: total / ASHE_Q.shotsPerStrike,
    appliesOnHit: index === 0,
  }));
}

export function asheVolleyValues(rank: number, bonusAttackDamage: number) {
  return {
    ...asheSpellResources('w', rank),
    arrows: ASHE_W.arrowsByRank[rank - 1],
    damage:
      ASHE_W.baseDamageByRank[rank - 1] +
      Math.max(0, bonusAttackDamage) * ASHE_W.bonusADRatioByRank[rank - 1],
  };
}

export function asheHawkshotValues(rank: number) {
  return {
    ...asheSpellResources('e', rank),
    rechargeSeconds: ASHE_E.rechargeSecondsByRank[rank - 1],
  };
}

export function asheCrystalArrowValues(rank: number, abilityPower: number) {
  return {
    ...asheSpellResources('r', rank),
    damage: ASHE_R.baseDamageByRank[rank - 1] + abilityPower * ASHE_R.abilityPowerRatio,
  };
}
