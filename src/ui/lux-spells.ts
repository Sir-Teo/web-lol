import { LUX_BINDING } from '../content/lux-binding';
import { LUX_W } from '../content/lux-w';
import { LUX_E_SOURCE as E } from '../content/lux-e';
import { LUX_R } from '../content/lux-r';
import { LUX_ILLUMINATION as PASSIVE } from '../content/lux-illumination';
import type { Ability } from '../simulation/types';

export const LUX_SPELLS = {
  q: { name: 'Light Binding', icon: 'LuxLightBinding', cost: LUX_BINDING.mana },
  w: { name: 'Prismatic Barrier', icon: 'LuxPrismaticWave', cost: LUX_W.mana[0] },
  e: { name: 'Lucent Singularity', icon: 'LuxLightStrikeKugel', cost: E.mana[0] },
  r: { name: 'Final Spark', icon: 'LuxR', cost: LUX_R.mana },
} as const;
export type LuxSpell = keyof typeof LUX_SPELLS;
export function isLuxSpell(ability: Ability): ability is LuxSpell {
  return ability === 'q' || ability === 'w' || ability === 'e' || ability === 'r';
}
export function luxPreviewResources(ability: LuxSpell) {
  const cooldownSeconds =
    ability === 'q'
      ? LUX_BINDING.cooldownSeconds
      : ability === 'w'
        ? LUX_W.cooldownSeconds[0]
        : ability === 'e'
          ? E.cooldownSeconds[0]
          : LUX_R.cooldownSeconds[0];
  return { mana: LUX_SPELLS[ability].cost, cooldownSeconds };
}
export function luxDescription(ability: LuxSpell, rank: number, ap: number, level: number): string {
  const mark = Math.round(PASSIVE.baseDamageByLevel[level - 1] + PASSIVE.abilityPowerRatio * ap);
  const illumination = ` Applies Illumination for ${PASSIVE.durationSeconds} seconds. A basic attack consumes your mark for ${mark} bonus magic damage before resistance.`;
  if (ability === 'q')
    return (
      `Fire a bolt that deals ${Math.round(LUX_BINDING.baseDamage[rank - 1] + LUX_BINDING.abilityPowerRatio * ap)} magic damage before resistance and roots up to ${LUX_BINDING.maximumTargets} enemies for ${LUX_BINDING.rootSeconds} seconds.` +
      illumination
    );
  if (ability === 'w')
    return `Throw a wand that shields you and allied champions for ${Math.round(LUX_W.baseShield[rank - 1] + LUX_W.abilityPowerRatio * ap)} damage for ${LUX_W.shieldSeconds} seconds. The returning wand can shield each ally again.`;
  if (ability === 'e')
    return (
      `Launch a zone that grants vision and slows enemies by ${E.slowPercent[rank - 1]}%. It lasts up to ${E.zoneSeconds} seconds. Press E again to detonate, dealing ${Math.round(E.baseDamage[rank - 1] + E.abilityPowerRatio * ap)} magic damage before resistance. An early recast requests detonation on arrival.` +
      illumination
    );
  return `After a ${LUX_R.castSeconds}-second windup, fire a beam dealing ${Math.round(LUX_R.baseDamage[rank - 1] + LUX_R.abilityPowerRatio * ap)} magic damage before resistance. It consumes your existing Illumination mark for ${mark} additional magic damage and applies a fresh mark.`;
}
