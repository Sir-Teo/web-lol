import { LEONA_SPELLS, LEONA_SUNLIGHT } from '../content/leona-spells';

export type LeonaSpell = keyof typeof LEONA_SPELLS;

/** Payload arithmetic only. Cast scheduling, hit dispatch and buff ownership are separate. */
export function leonaSpellResources(ability: LeonaSpell, rank: number) {
  const spec = LEONA_SPELLS[ability];
  if (!spec || !Number.isInteger(rank) || rank < 1 || rank > spec.rankCount)
    throw new RangeError(`Invalid Leona ${ability.toUpperCase()} rank: ${rank}`);
  return {
    mana: spec.manaByRank[rank - 1],
    cooldownSeconds: spec.cooldownSecondsByRank[rank - 1],
  };
}

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  return value;
}

/** Q's bonus is a separate magic payload, never a replacement for the basic hit. */
export function leonaDaybreakValues(rank: number, abilityPower: number) {
  const resources = leonaSpellResources('q', rank);
  return {
    ...resources,
    bonusMagicDamage:
      LEONA_SPELLS.q.baseDamageByRank[rank - 1] +
      LEONA_SPELLS.q.abilityPowerRatio * finite(abilityPower, 'Ability power'),
    stunSeconds: LEONA_SPELLS.q.stunSeconds,
  };
}

/** Bonus resistances supplied here exclude Eclipse itself, preventing recursive scaling. */
export function leonaEclipseValues(
  rank: number,
  abilityPower: number,
  bonusArmor: number,
  bonusMagicResist: number
) {
  const resources = leonaSpellResources('w', rank);
  const w = LEONA_SPELLS.w;
  return {
    ...resources,
    magicDamage:
      w.baseDamageByRank[rank - 1] + w.abilityPowerRatio * finite(abilityPower, 'Ability power'),
    armorBonus: w.baseArmorByRank[rank - 1] + w.bonusArmorRatio * finite(bonusArmor, 'Bonus armor'),
    magicResistBonus:
      w.baseMagicResistByRank[rank - 1] +
      w.bonusMagicResistRatio * finite(bonusMagicResist, 'Bonus magic resist'),
    flatReduction: w.flatReductionByRank[rank - 1],
    flatReductionMaximumFraction: w.flatReductionMaximumFraction,
    resistanceSeconds: w.resistanceSeconds,
  };
}

export function leonaZenithValues(rank: number, abilityPower: number) {
  const resources = leonaSpellResources('e', rank);
  return {
    ...resources,
    magicDamage:
      LEONA_SPELLS.e.baseDamageByRank[rank - 1] +
      LEONA_SPELLS.e.abilityPowerRatio * finite(abilityPower, 'Ability power'),
    rootSeconds: LEONA_SPELLS.e.rootSeconds,
  };
}

export function leonaSolarFlareValues(rank: number, abilityPower: number) {
  const resources = leonaSpellResources('r', rank);
  return {
    ...resources,
    magicDamage:
      LEONA_SPELLS.r.baseDamageByRank[rank - 1] +
      LEONA_SPELLS.r.abilityPowerRatio * finite(abilityPower, 'Ability power'),
    slowFraction: LEONA_SPELLS.r.slowFraction,
    crowdControlSeconds: LEONA_SPELLS.r.crowdControlSeconds,
  };
}

/** Standard Rift levels only; extended-mode trailing entries are not playable levels. */
export function leonaSunlightDamage(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > LEONA_SUNLIGHT.damageByLevel.length)
    throw new RangeError(`Invalid Leona level: ${level}`);
  return LEONA_SUNLIGHT.damageByLevel[level - 1];
}
