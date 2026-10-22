import { CREST_OF_INSIGHT } from '../content/crest-of-insight';
import { TICK_RATE } from '../content/rules';
import type { ChampionState, Unit } from './types';

export const BLUE_BUFF_DURATION_TICKS = CREST_OF_INSIGHT.durationSeconds * TICK_RATE;
export const BLUE_BUFF_REGEN_TICKS = CREST_OF_INSIGHT.regenerationIntervalSeconds * TICK_RATE;

export function grantBlueBuff(state: ChampionState, tick: number): void {
  state.blueBuff = {
    startTick: tick,
    endTick: tick + BLUE_BUFF_DURATION_TICKS,
    nextRegenTick: tick + BLUE_BUFF_REGEN_TICKS,
  };
}

export function blueBuffHaste(state: ChampionState, tick: number): number {
  if (!state.blueBuff || tick >= state.blueBuff.endTick) return 0;
  return CREST_OF_INSIGHT.hasteTiers.reduce<number>(
    (haste, tier) => (state.level >= tier.level ? tier.haste : haste),
    0
  );
}

export function blueBuffManaPerSecond(maxMana: number): number {
  return maxMana > 0
    ? (CREST_OF_INSIGHT.flatManaPerFiveSeconds +
        maxMana * CREST_OF_INSIGHT.maxManaFractionPerFiveSeconds) /
        5
    : 0;
}

/** Resolve before recharge/commands. Death keeps time running, without banked pulses. */
export function advanceBlueBuff(state: ChampionState, unit: Unit, tick: number): void {
  const buff = state.blueBuff;
  if (!buff) return;
  if (tick >= buff.endTick) {
    state.blueBuff = null;
    return;
  }
  if (tick < buff.nextRegenTick) return;
  buff.nextRegenTick =
    buff.startTick +
    (Math.floor((tick - buff.startTick) / BLUE_BUFF_REGEN_TICKS) + 1) * BLUE_BUFF_REGEN_TICKS;
  if (unit.deadAt === null && unit.hp > 0)
    unit.mana = Math.min(
      unit.maxMana,
      unit.mana + blueBuffManaPerSecond(unit.maxMana) * CREST_OF_INSIGHT.regenerationIntervalSeconds
    );
}
