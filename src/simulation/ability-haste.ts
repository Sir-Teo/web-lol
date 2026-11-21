import {
  MID_QUEST_BONUS_HASTE,
  SUPPORT_QUEST_POLICY,
  isRoleQuestComplete,
} from '../content/role-quests';
import { ITEMS, TICK_RATE } from '../content/rules';
import { blueBuffHaste } from './blue-buff';
import { runeAbilityHaste } from './runes';
import type { ChampionState } from './types';

export function totalAbilityHaste(state: ChampionState, tick: number, extraHaste = 0): number {
  let questHaste = 0;
  if (isRoleQuestComplete(state.roleQuest)) {
    if (state.roleQuest!.role === 'mid') questHaste += MID_QUEST_BONUS_HASTE;
    if (state.roleQuest!.role === 'support')
      questHaste += SUPPORT_QUEST_POLICY.completionBonusHaste;
  }
  return (
    itemAbilityHaste(state) +
    blueBuffHaste(state, tick) +
    runeAbilityHaste(state) +
    questHaste +
    extraHaste
  );
}

export function itemAbilityHaste(state: ChampionState): number {
  return state.inventory.reduce((total, id) => {
    const item = ITEMS.find((item) => item.id === id);
    return total + (item && 'abilityHaste' in item ? (item.abilityHaste ?? 0) : 0);
  }, 0);
}

/** Each point permits 1% more casts; readiness is rounded up to a simulation tick. */
export function hastedCooldownTicks(seconds: number, haste: number): number {
  return Math.ceil((seconds * TICK_RATE * 100) / (100 + haste));
}
