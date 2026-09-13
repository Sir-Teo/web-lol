import { ASHE_E } from '../content/ashe-e';
import { asheHawkshotValues } from './ashe-spell-values';
import { ASHE_Q } from '../content/ashe-q';
import { TICK_RATE } from '../content/rules';
import type { ChampionState } from './types';

export function createChampionState(id: number): ChampionState {
  return {
    revealContributors: [],
    assists: 0,
    damageContributors: [],
    id,
    gold: 500,
    cs: 0,
    kills: 0,
    deaths: 0,
    xp: 0,
    level: 1,
    skillPoints: 0,
    spellRanks: { q: 1, w: 1, e: 1, r: 1 },
    cooldowns: { q: 0, w: 0, e: 0, r: 0, d: 0, f: 0 },
    qStacks: 0,
    qUntil: 0,
    qStackExpiry: 0,
    eCharges: ASHE_E.maximumCharges,
    eRechargeTick: null,
    eRechargeDurationTicks: ASHE_E.rechargeSecondsByRank[0] * TICK_RATE,
    recallEnd: null,
    castAnimation: null,
    pendingCast: null,
    inventory: [],
  };
}
/** Recharge precedes commands, including while dead. */
export function rechargeChampion(state: ChampionState, tick: number): void {
  while (state.eRechargeTick !== null && tick >= state.eRechargeTick) {
    state.eCharges++;
    state.eRechargeDurationTicks =
      asheHawkshotValues(state.spellRanks.e).rechargeSeconds * TICK_RATE;
    state.eRechargeTick =
      state.eCharges < ASHE_E.maximumCharges
        ? state.eRechargeTick + state.eRechargeDurationTicks
        : null;
  }
}
/** Focus expiry follows combat so a fresh attack can refresh the deadline. */
export function expireChampionFocus(state: ChampionState, tick: number): void {
  while (state.qStacks > 0 && tick >= state.qStackExpiry && tick >= state.qUntil) {
    state.qStacks--;
    state.qStackExpiry =
      state.qStacks > 0 ? state.qStackExpiry + ASHE_Q.falloffSeconds * TICK_RATE : 0;
  }
}
