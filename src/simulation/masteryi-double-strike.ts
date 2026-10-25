import { MASTER_YI_PASSIVE } from '../content/masteryi-passive';
import { TICK_RATE } from '../content/rules';
import { isStructureKind, type ChampionState, type Unit, type Team } from './types';

/** Development controller policy, separate from the recovered declarations.
 * Accepted contacts build the counter; the fourth consumes it. A successful
 * child contributes one contact to the next cycle, without recursive dispatch.
 * The child keeps its committed target and captured damage/timing through orders
 * and disables. Death, victory or invalid target at release discard it. Native
 * counter dispatch, retargeting, crit/proc order and timing remain unverified.
 */
export interface DoubleStrikeState {
  stacks: number;
  expiresTick: number;
  strike: {
    startTick: number;
    releaseTick: number;
    endTick: number;
    targetId: number;
    damage: number;
    critical: boolean;
    result: 'pending' | 'hit' | 'lost';
  } | null;
}

export const DOUBLE_STRIKE_STACK_TICKS = MASTER_YI_PASSIVE.stackDurationSeconds * TICK_RATE;

export function createDoubleStrikeState(): DoubleStrikeState {
  return { stacks: 0, expiresTick: 0, strike: null };
}

export function expireDoubleStrike(state: DoubleStrikeState, tick: number): void {
  if (state.stacks && tick >= state.expiresTick) {
    state.stacks = 0;
    state.expiresTick = 0;
  }
  if (state.strike && tick >= state.strike.endTick) state.strike = null;
}

/** Returns true only for a primary contact that consumes the ready counter. */
export function countDoubleStrikeContact(
  state: DoubleStrikeState,
  tick: number,
  primary: boolean
): boolean {
  expireDoubleStrike(state, tick);
  if (primary && state.stacks === MASTER_YI_PASSIVE.attackCount - 1) {
    state.stacks = 0;
    state.expiresTick = 0;
    return true;
  }
  state.stacks = Math.min(MASTER_YI_PASSIVE.attackCount - 1, state.stacks + 1);
  state.expiresTick = tick + DOUBLE_STRIKE_STACK_TICKS;
  return false;
}

export function validateDoubleStrikes(
  owners: readonly Pick<ChampionState, 'id' | 'doubleStrike'>[],
  units: readonly Unit[],
  tick: number,
  winner: Team | null
): void {
  for (const owner of owners) {
    const unit = units.find((u) => u.id === owner.id);
    const state = owner.doubleStrike;
    if ((unit?.champion === 'masteryi') !== (state !== null))
      throw new Error('Saved match contains foreign Double Strike ownership.');
    if (!state) continue;
    if (
      (state.stacks === 0) !== (state.expiresTick === 0) ||
      (state.stacks > 0 &&
        (state.expiresTick <= tick || state.expiresTick > tick + DOUBLE_STRIKE_STACK_TICKS)) ||
      ((!unit || unit.hp <= 0 || winner !== null) && (state.stacks !== 0 || state.strike !== null))
    )
      throw new Error('Saved match contains invalid Double Strike counter clocks.');
    const strike = state.strike;
    if (!strike) continue;
    const target = units.find((u) => u.id === strike.targetId);
    if (
      !unit ||
      !target ||
      target.team === unit.team ||
      strike.startTick > tick ||
      strike.releaseTick <= strike.startTick ||
      strike.endTick <= strike.releaseTick ||
      strike.endTick <= tick ||
      (strike.result === 'pending') !== strike.releaseTick > tick ||
      (strike.critical && isStructureKind(target.kind)) ||
      (strike.result === 'pending' && state.stacks !== 0)
    )
      throw new Error('Saved match contains invalid Double Strike contact history.');
  }
}
