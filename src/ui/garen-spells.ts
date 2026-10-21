import { GAREN_Q } from '../content/garen-q';
import { GAREN_W } from '../content/garen-w';
import { GAREN_E } from '../content/garen-e';
import { GAREN_R } from '../content/garen-r';
import type { Ability } from '../simulation/types';

export const GAREN_SPELLS = {
  q: { name: 'Decisive Strike', icon: 'GarenQ', cost: 0 },
  w: { name: 'Courage', icon: 'GarenW', cost: 0 },
  e: { name: 'Judgment', icon: 'GarenE', cost: 0 },
  r: { name: 'Demacian Justice', icon: 'GarenR', cost: 0 },
} as const;
export type GarenSpell = keyof typeof GAREN_SPELLS;
export function isGarenSpell(ability: Ability): ability is GarenSpell {
  return ability === 'q' || ability === 'w' || ability === 'e' || ability === 'r';
}
export function garenPreviewResources(ability: GarenSpell) {
  return {
    mana: 0,
    cooldownSeconds:
      ability === 'q'
        ? GAREN_Q.cooldownSeconds
        : ability === 'w'
          ? GAREN_W.cooldownSecondsByRank[0]
          : ability === 'e'
            ? GAREN_E.cooldownSecondsByRank[0]
            : GAREN_R.cooldownSecondsByRank[0],
  };
}
export function garenDescription(
  ability: GarenSpell,
  rank: number,
  ad: number,
  bonusHealth: number,
  strikes: number
): string {
  const pct = (n: number) => Math.round(n * 100);
  if (ability === 'q')
    return `Remove slows, reset your attack timer and gain ${pct(GAREN_Q.movementSpeedBonus)}% movement speed for ${Number(GAREN_Q.movementSecondsByRank[rank - 1].toFixed(2))} seconds. Your next attack within ${GAREN_Q.attackWindowSeconds} seconds gains ${Math.round(GAREN_Q.baseDamageByRank[rank - 1] + (GAREN_Q.totalAttackDamageRatio - 1) * ad)} bonus physical damage before armor and silences for ${GAREN_Q.silenceSeconds} seconds.`;
  if (ability === 'w')
    return `Shield yourself for ${Math.round(GAREN_W.baseShieldByRank[rank - 1] + GAREN_W.bonusHealthShieldRatio * bonusHealth)} damage and gain ${pct(GAREN_W.upfrontTenacity)}% tenacity for ${GAREN_W.upfrontSeconds} seconds. Reduce incoming physical and magic damage by ${pct(GAREN_W.damageReductionByRank[rank - 1])}% for ${GAREN_W.damageReductionSeconds} seconds. After learning Courage, credited champion and minion kills grant resistances, up to ${GAREN_W.maxResistGain}.`;
  if (ability === 'e')
    return `Spin ${strikes} times over ${GAREN_E.durationSeconds} seconds while moving, dealing ${Math.round(GAREN_E.baseDamageByRank[rank - 1] + GAREN_E.attackDamageRatioByRank[rank - 1] * ad)} physical damage per strike before armor. The nearest enemy takes ${pct(GAREN_E.nearestEnemyBonus)}% more damage. Six strikes reduce a champion’s armor by ${pct(GAREN_E.armorReduction)}% for ${GAREN_E.shredSeconds} seconds. Basic attacks are unavailable while spinning. Recast after 1 second to end early; the full cooldown starts when the spin ends.`;
  return `Strike an enemy champion within ${GAREN_R.castRange} range for ${GAREN_R.baseDamageByRank[rank - 1]} plus ${pct(GAREN_R.missingHealthRatioByRank[rank - 1])}% of their missing health as true damage. Reveals only that target for ${GAREN_R.revealSeconds} second. Damage is sampled when the strike lands.`;
}
