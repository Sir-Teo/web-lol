import { CREST_OF_CINDERS as C } from '../content/crest-of-cinders';
import { TICK_RATE } from '../content/rules';
import type { ChampionState, Unit } from './types';

export const RED_BUFF_DURATION_TICKS = C.durationSeconds * TICK_RATE;
export const RED_BUFF_REGEN_TICKS = C.regenerationIntervalSeconds * TICK_RATE;
export const CINDER_BURN_TICKS = C.burnDurationSeconds * TICK_RATE;
export const CINDER_BURN_INTERVAL = C.burnIntervalSeconds * TICK_RATE;
export const RED_HEAL_LOCKOUT_TICKS = C.healingLockoutSeconds * TICK_RATE;

export function grantRedBuff(state: ChampionState, tick: number): void {
  state.redBuff = {
    startTick: tick,
    endTick: tick + RED_BUFF_DURATION_TICKS,
    nextRegenTick: tick + RED_BUFF_REGEN_TICKS,
  };
}
export function redBuffActive(state: ChampionState, tick: number): boolean {
  return !!state.redBuff && state.redBuff.endTick > tick;
}
export function cinderDamagePerTick(level: number): number {
  return (
    (C.minimumBurnDamage + ((C.maximumBurnDamage - C.minimumBurnDamage) * (level - 1)) / 17) / 3
  );
}
export function cinderSlow(level: number, melee: boolean): number {
  return C.slowTiers.reduce(
    (v, t) => (level >= t.level ? (melee ? t.melee : t.ranged) : v),
    0 as number
  );
}
export function redBuffHealingPerSecond(state: ChampionState, maxHp: number, tick: number): number {
  if (!redBuffActive(state, tick) || tick < state.redBuffHealReadyTick) return 0;
  return (
    (maxHp *
      C.healTiers.reduce(
        (v, t) => (state.level >= t.level ? t.fractionPerFiveSeconds : v),
        0 as number
      )) /
    5
  );
}
/** No banked healing during death or lockout; resolve after combat each tick. */
export function advanceRedBuff(state: ChampionState, unit: Unit, tick: number): void {
  const buff = state.redBuff;
  if (!buff) return;
  if (tick >= buff.endTick) {
    state.redBuff = null;
    return;
  }
  if (tick < buff.nextRegenTick) return;
  buff.nextRegenTick =
    buff.startTick +
    (Math.floor((tick - buff.startTick) / RED_BUFF_REGEN_TICKS) + 1) * RED_BUFF_REGEN_TICKS;
  if (unit.deadAt === null && unit.hp > 0)
    unit.hp = Math.min(
      unit.maxHp,
      unit.hp + redBuffHealingPerSecond(state, unit.maxHp, tick) * C.regenerationIntervalSeconds
    );
}
