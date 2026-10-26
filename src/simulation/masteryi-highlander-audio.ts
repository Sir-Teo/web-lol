import {
  MASTER_YI_R_ACTIVATE_TICKS,
  MASTER_YI_R_DEACTIVATE_TICKS,
} from '../content/masteryi-r-audio-timing';
import { HIGHLANDER_TICKS, HIGHLANDER_EXTENSION_TICKS } from './masteryi-highlander';
import type { ChampionState, Unit, Team } from './types';
import type { Vec2 } from './math';

type Observation = { tick: number; visible(unit: Unit, team: Team): boolean };
export type HighlanderAudioStop = 'expired' | 'death' | 'match-end' | 'recast';
export interface HighlanderAudioRecord {
  startTick: number;
  rank: number;
  takedownsAtCast: number;
  origin: Vec2;
  castAudience: Team[];
  stop: {
    tick: number;
    reason: HighlanderAudioStop;
    endTick: number;
    pausedTicks: number;
    extensionCount: number;
    point: Vec2;
    audience: Team[];
  } | null;
}
export function highlanderAudioExpiry(r: HighlanderAudioRecord): number {
  return r.stop === null
    ? Infinity
    : Math.max(
        r.startTick + MASTER_YI_R_ACTIVATE_TICKS,
        r.stop.tick + MASTER_YI_R_DEACTIVATE_TICKS
      );
}
export function beginHighlanderAudio(state: ChampionState, unit: Unit, world: Observation): void {
  const buff = state.highlander!;
  state.highlanderAudio.push({
    startTick: buff.startTick,
    rank: buff.rank,
    takedownsAtCast: buff.takedownsAtCast,
    origin: { x: unit.x, y: unit.y },
    castAudience: (['blue', 'red'] as const).filter((t) => world.visible(unit, t)),
    stop: null,
  });
}
/** Only natural expiry dispatches the declared ending cue. Other removals retain
 * a finite onset without claiming native death/recast/victory callbacks. */
export function stopHighlanderAudio(
  state: ChampionState,
  unit: Unit,
  world: Observation,
  reason: HighlanderAudioStop
): void {
  const buff = state.highlander;
  if (!buff) return;
  const record = state.highlanderAudio.find((r) => r.startTick === buff.startTick);
  if (!record || record.stop) return;
  record.stop = {
    tick: world.tick,
    reason,
    endTick: buff.endTick,
    pausedTicks: buff.pausedTicks,
    extensionCount: buff.extensionCount,
    point: { x: unit.x, y: unit.y },
    audience: (['blue', 'red'] as const).filter((t) => world.visible(unit, t)),
  };
}
export function validateHighlanderAudio(
  state: ChampionState,
  unit: Unit,
  world: { tick: number; winner: Team | null }
): void {
  let previous = -1,
    active = 0;
  for (const r of state.highlanderAudio) {
    const stop = r.stop,
      buff = state.highlander;
    if (
      unit.champion !== 'masteryi' ||
      r.startTick <= previous ||
      r.startTick > world.tick ||
      r.rank > state.spellRanks.r ||
      r.takedownsAtCast > state.kills + state.assists ||
      !r.castAudience.includes(unit.team as Team) ||
      world.tick >= highlanderAudioExpiry(r)
    )
      throw Error('Saved match contains invalid Highlander audio history.');
    if (!stop) {
      active++;
      if (
        !buff ||
        buff.startTick !== r.startTick ||
        buff.rank !== r.rank ||
        buff.takedownsAtCast !== r.takedownsAtCast ||
        unit.deadAt !== null ||
        world.winner !== null
      )
        throw Error('Saved match contains unowned Highlander audio history.');
    } else if (
      stop.tick < r.startTick ||
      stop.tick > world.tick ||
      !stop.audience.includes(unit.team as Team) ||
      stop.pausedTicks > stop.tick - r.startTick ||
      r.takedownsAtCast + stop.extensionCount > state.kills + state.assists ||
      stop.endTick !==
        r.startTick +
          HIGHLANDER_TICKS +
          stop.extensionCount * HIGHLANDER_EXTENSION_TICKS +
          stop.pausedTicks ||
      (stop.reason === 'expired' ? stop.tick !== stop.endTick : stop.tick >= stop.endTick) ||
      (stop.reason === 'death' && unit.deadAt !== stop.tick) ||
      (stop.reason === 'match-end' && (world.winner === null || world.tick !== stop.tick)) ||
      (stop.reason === 'recast' &&
        !state.highlanderAudio.some(
          (next) => next.startTick === stop.tick && next.startTick > r.startTick
        ))
    )
      throw Error('Saved match contains invalid Highlander audio stop.');
    previous = r.startTick;
  }
  if (active !== (state.highlander ? 1 : 0))
    throw Error('Saved match lacks its active Highlander audio history.');
}
