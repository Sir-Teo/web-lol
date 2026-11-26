import { championProfile } from '../content/champion-profiles';
import { ITEMS } from '../content/rules';
import { growthAtLevel } from './progression';
import type { ChampionState, Unit } from './types';

/** Exact base Attack Damage at the champion's current level from pinned Riot growth curve. */
export function championBaseAd(u: Unit, state: ChampionState): number {
  if (!u.champion) return u.damage;
  const prof = championProfile(u.champion);
  return prof.damage + prof.damageGrowth * growthAtLevel(state.level);
}

/** Bonus AD from items/buffs stored on Unit.damage (excludes transient adaptive rune force). */
export function championItemBonusAd(u: Unit, state: ChampionState): number {
  return Math.max(0, u.damage - championBaseAd(u, state));
}

/** Bonus AP from purchased items (excludes transient adaptive rune force to avoid circularity). */
export function championItemAp(state: ChampionState): number {
  let ap = 0;
  for (const id of state.inventory) {
    ap += ITEMS.find((item) => item.id === id)?.abilityPower ?? 0;
  }
  return ap;
}
