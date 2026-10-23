import { GAREN_PASSIVE_TAIL_TICKS } from '../content/garen-passive-presentation';
import type { ChampionState, Unit } from './types';

/** Local dispatch: emit while alive, injured and ready. Stop births immediately
 * on interruption/full recovery/death/victory; already-born sparks finish their
 * authored lives at the saved stop point. No gameplay IDs or RNG are consumed. */
export function stopPerseveranceVisual(state: ChampionState, unit: Unit, tick: number) {
  const active = state.garenPassiveVisuals.at(-1);
  if (!active || active.stopTick !== null) return;
  active.stopTick = tick;
  active.point = { x: unit.x, y: unit.y };
}
export function advancePerseveranceVisual(state: ChampionState, unit: Unit, tick: number) {
  state.garenPassiveVisuals = state.garenPassiveVisuals.filter(
    (r) => r.stopTick === null || tick < r.stopTick + GAREN_PASSIVE_TAIL_TICKS
  );
  const emit =
    unit.champion === 'garen' &&
    unit.deadAt === null &&
    unit.hp > 0 &&
    unit.hp < unit.maxHp &&
    tick >= state.garenPassiveReadyTick;
  const active = state.garenPassiveVisuals.at(-1);
  if (!emit) stopPerseveranceVisual(state, unit, tick);
  else if (!active || active.stopTick !== null)
    state.garenPassiveVisuals.push({ startTick: tick, stopTick: null, point: null });
}
export function validatePerseveranceVisual(
  state: ChampionState,
  unit: Unit,
  tick: number,
  winner: unknown
) {
  let previous = -1;
  for (const [index, r] of state.garenPassiveVisuals.entries()) {
    if (
      unit.champion !== 'garen' ||
      r.startTick <= previous ||
      r.startTick > tick ||
      (r.stopTick === null
        ? r.point !== null ||
          index !== state.garenPassiveVisuals.length - 1 ||
          unit.deadAt !== null ||
          winner !== null ||
          state.garenPassiveReadyTick > tick
        : r.point === null ||
          r.stopTick < r.startTick ||
          r.stopTick > tick ||
          tick >= r.stopTick + GAREN_PASSIVE_TAIL_TICKS ||
          (unit.deadAt !== null && r.stopTick > unit.deadAt))
    )
      throw Error('Saved match contains invalid Perseverance presentation.');
    if (index && state.garenPassiveVisuals[index - 1].stopTick! >= r.startTick)
      throw Error('Saved match contains overlapping Perseverance presentation.');
    previous = r.startTick;
  }
}
