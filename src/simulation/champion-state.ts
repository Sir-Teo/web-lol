import { newTrinket } from './wards';
import { ASHE_E } from '../content/ashe-e';
import { DEFAULT_SUMMONERS } from '../content/summoners';
import { rechargeSmite } from './smite';
import { asheHawkshotValues } from './ashe-spell-values';
import { ASHE_Q } from '../content/ashe-q';
import { TICK_RATE } from '../content/rules';
import type { ChampionState } from './types';
import { hastedCooldownTicks, totalAbilityHaste } from './ability-haste';

export function createChampionState(id: number, unlocked = true, tick = 0): ChampionState {
  return {
    role: null,
    jungle: null,
    summoners: { ...DEFAULT_SUMMONERS },
    smite: null,
    trinket: newTrinket(tick),
    observedStats: { blue: null, red: null },
    revealContributors: [],
    assists: 0,
    damageContributors: [],
    supportContributors: [],
    id,
    gold: 500,
    cs: 0,
    kills: 0,
    deaths: 0,
    xp: 0,
    level: 1,
    skillPoints: unlocked ? 0 : 1,
    spellRanks: unlocked ? { q: 1, w: 1, e: 1, r: 1 } : { q: 0, w: 0, e: 0, r: 0 },
    cooldowns: { q: 0, w: 0, e: 0, r: 0, d: 0, f: 0 },
    qStacks: 0,
    qUntil: 0,
    qStackExpiry: 0,
    garenAAVisuals: [],
    leonaAAVisuals: [],
    garenPassiveReadyTick: 0,
    garenPassiveVisuals: [],
    garenCourageStacks: 0,
    garenRReveal: null,
    garenRVisual: null,
    garenEVisual: null,
    garenE: null,
    garenQ: null,
    leonaQ: null,
    leonaQVisuals: [],
    leonaW: null,
    leonaWVisuals: [],
    leonaEWindup: null,
    leonaEVisuals: [],
    leonaR: null,
    leonaRVisuals: [],
    leonaDash: null,
    garenQVisuals: [],
    garenW: null,
    garenWVisual: null,
    garenWDeflects: [],
    eCharges: unlocked ? ASHE_E.maximumCharges : 0,
    eRechargeTick: null,
    eRechargeDurationTicks: ASHE_E.rechargeSecondsByRank[0] * TICK_RATE,
    recallEnd: null,
    enlighten: null,
    blueBuff: null,
    redBuff: null,
    redBuffHealReadyTick: 0,
    castAnimation: null,
    pendingCast: null,
    inventory: [],
  };
}
/** Recharge precedes commands, including while dead. */
export function rechargeChampion(state: ChampionState, tick: number): void {
  rechargeSmite(state, tick);
  while (state.eRechargeTick !== null && tick >= state.eRechargeTick) {
    state.eCharges++;
    state.eRechargeDurationTicks = hastedCooldownTicks(
      asheHawkshotValues(state.spellRanks.e).rechargeSeconds,
      totalAbilityHaste(state, tick)
    );
    state.eRechargeTick =
      state.eCharges < ASHE_E.maximumCharges
        ? state.eRechargeTick + state.eRechargeDurationTicks
        : null;
  }
}
/** Also run on consumption so a match-ending hit cannot retain an expired buff. */
export function expireGarenQ(state: ChampionState, tick: number): void {
  const q = state.garenQ;
  if (q?.consumed) finishGarenQPresentation(state, tick, 'consumed');
  else if (q && tick >= q.attackUntil) finishGarenQPresentation(state, tick, 'expired');
  if (q && tick >= q.speedUntil && (q.consumed || tick >= q.attackUntil)) state.garenQ = null;
}
export function finishGarenQPresentation(
  state: ChampionState,
  tick: number,
  reason: NonNullable<ChampionState['garenQVisuals'][number]['endReason']>
): void {
  const record = state.garenQVisuals.at(-1);
  if (record && record.stopTick === null) {
    record.stopTick = tick;
    record.endReason = reason;
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
