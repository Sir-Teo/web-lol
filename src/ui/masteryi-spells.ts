import { MASTER_YI_Q } from '../content/masteryi-q';
import { MASTER_YI_W } from '../content/masteryi-w';
import { MASTER_YI_E } from '../content/masteryi-e';
import { MASTER_YI_R } from '../content/masteryi-r';
import type { Ability } from '../simulation/types';

type YiSpell = 'q' | 'w' | 'e' | 'r';
export function isMasterYiSpell(a: Ability): a is YiSpell {
  return ['q', 'w', 'e', 'r'].includes(a);
}
export function masterYiPreviewResources(a: YiSpell) {
  return {
    mana:
      a === 'q'
        ? MASTER_YI_Q.manaByRank[0]
        : a === 'w'
          ? MASTER_YI_W.manaByRank[0]
          : a === 'e'
            ? MASTER_YI_E.publicManaByRank[0]
            : MASTER_YI_R.manaByRank[0],
    cooldownSeconds:
      a === 'q'
        ? MASTER_YI_Q.cooldownSecondsByRank[0]
        : a === 'w'
          ? MASTER_YI_W.publicCooldownSecondsByRank[0]
          : a === 'e'
            ? MASTER_YI_E.cooldownSecondsByRank[0]
            : MASTER_YI_R.cooldownSecondsByRank[0],
  };
}
const number = (v: number) => String(Math.round(v * 10) / 10);
export function masterYiDescription(
  a: YiSpell,
  rank: number,
  damage: number,
  bonusAD: number,
  power: number
): string {
  const r = Math.max(1, rank) - 1;
  if (a === 'q')
    return `Vanish and strike up to four nearby enemies, dealing ${number(MASTER_YI_Q.baseDamageByRank[r] + damage * MASTER_YI_Q.attackDamageRatio)} physical damage to each. Repeated hits deal 25% damage. Applies on-hit damage at 75% effectiveness, or 18.75% on repeats. Reappear beside your first target; right-click while vanished to choose your return side. Basic attacks reduce the remaining cooldown.`;
  if (a === 'w')
    return `Channel for up to 4 seconds to restore ${number(MASTER_YI_W.baseHealByRank[r] + power * MASTER_YI_W.healCoefficient)} base health, increased by up to 100% with missing health. Reduce incoming physical and magic damage by ${Math.round(MASTER_YI_W.damageReductionByRank[r] * 100)}%, increased to 70% for the first 0.5 seconds. Reduction is halved against turrets and lingers for 0.5 seconds after ending. Costs 6% maximum mana each second. Resets your attack timer, builds Double Strike stacks and pauses Wuju Style and Highlander. Move or Stop to end the channel.`;
  if (a === 'e')
    return `Empower your attacks for 5 seconds, dealing ${number(MASTER_YI_E.baseDamageByRank[r] + bonusAD * MASTER_YI_E.bonusAttackDamageRatio)} additional true damage on-hit. Both contacts of Double Strike receive the full effect.`;
  return `Gain ${MASTER_YI_R.attackSpeedPercentByRank[r]}% bonus attack speed, ${MASTER_YI_R.movementSpeedPercentByRank[r]}% movement speed and immunity to slows for 7 seconds. Cleanses existing slows. Champion kills and assists extend the effect by 7 seconds. Passively reduces your other abilities' remaining cooldowns by 70% on champion kills or assists.`;
}
export function masterYiPassiveDescription(stacks: number): string {
  return `Double Strike: basic attacks build up to 3 stacks. Your next attack strikes twice; the second strike deals 50% attack damage and applies on-hit effects. ${stacks === 3 ? 'Double Strike is ready.' : `${stacks} of 3 stacks.`}`;
}
