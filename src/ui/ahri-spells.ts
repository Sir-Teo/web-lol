import { AHRI_Q } from '../content/ahri-q';
import { AHRI_W } from '../content/ahri-w';
import { AHRI_E } from '../content/ahri-e';
import { AHRI_R } from '../content/ahri-r';
import { AHRI_PASSIVE } from '../content/ahri-passive';
import { essenceHeal } from '../simulation/ahri-essences';
import type { Ability } from '../simulation/types';

type AhriSpell = 'q' | 'w' | 'e' | 'r';
export function isAhriSpell(ability: Ability): ability is AhriSpell {
  return ['q', 'w', 'e', 'r'].includes(ability);
}
export function ahriPreviewResources(ability: AhriSpell) {
  const spell =
    ability === 'q' ? AHRI_Q : ability === 'w' ? AHRI_W : ability === 'e' ? AHRI_E : AHRI_R;
  return { mana: spell.manaByRank[0], cooldownSeconds: spell.cooldownSecondsByRank[0] };
}
const number = (value: number) => String(Math.round(value * 10) / 10);
const duration = (value: number) => String(Math.round(value * 100) / 100);
export function ahriDescription(ability: AhriSpell, rank: number, power: number): string {
  const r = Math.max(1, rank) - 1;
  if (ability === 'q') {
    const damage = number(AHRI_Q.namedDamageByRank[r] + AHRI_Q.namedStatCoefficient * power);
    return `Send an orb forward, dealing ${damage} magic damage outward and ${damage} true damage as it returns to you. Each enemy can be hit once on each leg.`;
  }
  if (ability === 'w') {
    const damage = number(AHRI_W.damageByRank[r] + AHRI_W.abilityPowerRatio * power);
    return `Gain ${Math.round(AHRI_W.movementSpeedFraction * 100)}% movement speed, decaying over 2 seconds. Three fox-fires seek nearby enemies and deal ${damage} magic damage each. Further hits on the same enemy deal ${Math.round(AHRI_W.repeatDamageMultiplier * 100)}% damage. Minions at 20% health or less take double damage.`;
  }
  if (ability === 'e')
    return `Deal ${number(AHRI_E.damageByRank[r] + AHRI_E.abilityPowerRatio * power)} magic damage to the first enemy hit and Charm them for ${duration(AHRI_E.charmSecondsByRank[r])} seconds. Charm slows movement by ${Math.round(-AHRI_E.negativeSlowPercent * 100)}% and forces them to walk toward you.`;
  return `Dash up to ${AHRI_R.dashDistance} units and fire up to ${AHRI_R.maxTargets} bolts at nearby enemies, prioritizing champions. Each deals ${number(AHRI_R.damageByRank[r] + AHRI_R.abilityPowerRatio * power)} magic damage. Recast twice within ${AHRI_R.recastWindowSeconds} seconds. Champion Essence restores one cast, up to three stored, and leaves at least ten seconds to recast.`;
}
export function ahriPassiveDescription(level: number, power: number): string {
  return `Essence Theft: after ${AHRI_PASSIVE.maxStacks} minion or monster kills, returning Essence heals up to ${number(essenceHeal('minion', level, power))} health. Enemy champion Essence heals up to ${number(essenceHeal('champion', level, power))} and can restore Spirit Rush during its active window.`;
}
