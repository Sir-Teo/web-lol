import { ITEMS, TICK_RATE } from '../content/rules';
import type { ChampionState } from './types';
import { blueBuffHaste } from './blue-buff';

export function totalAbilityHaste(state: ChampionState, tick: number): number {
  return itemAbilityHaste(state) + blueBuffHaste(state, tick);
}

export function itemAbilityHaste(state: ChampionState): number {
  return state.inventory.reduce((total, id) => {
    const item = ITEMS.find((item) => item.id === id);
    return total + (item && 'abilityHaste' in item ? item.abilityHaste : 0);
  }, 0);
}

/** Each point permits 1% more casts; readiness is rounded up to a simulation tick. */
export function hastedCooldownTicks(seconds: number, haste: number): number {
  return Math.ceil((seconds * TICK_RATE * 100) / (100 + haste));
}
