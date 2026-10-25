import { LEONA_DEATH_AUDIO_TICKS } from '../content/leona-death-audio-timing';
import type { ChampionState, SimEvent, Team, Unit } from './types';
import type { World } from './world';
import type { Vec2 } from './math';

/** Fixed accepted death fact; the source layers outlive the transient event log. */
export interface LeonaDeathVisual {
  startTick: number;
  point: Vec2;
  audience: Team[];
}
export function captureLeonaDeath(state: ChampionState, unit: Unit, event: SimEvent) {
  if (
    unit.champion !== 'leona' ||
    unit.hp !== 0 ||
    event.type !== 'death' ||
    event.unit !== unit.id ||
    event.tick !== unit.deadAt ||
    event.x !== unit.x ||
    event.y !== unit.y ||
    state.leonaDeathVisuals.length
  )
    throw Error('Leona death lacks its accepted event or has duplicate source history.');
  state.leonaDeathVisuals.push({
    startTick: event.tick,
    point: { x: event.x, y: event.y },
    audience: [...event.audience],
  });
}
export function advanceLeonaDeaths(world: World) {
  for (const unit of world.units) {
    if (unit.champion !== 'leona') continue;
    const state = world.championState(unit.id)!;
    state.leonaDeathVisuals = state.leonaDeathVisuals.filter(
      (r) => world.tick < r.startTick + LEONA_DEATH_AUDIO_TICKS
    );
  }
}
/** The complete 338-tick tail ends before the minimum 600-tick respawn. One
 * retained fact must match the current death, while its audience stays historical.
 * No live visibility is used to reconstruct an earlier audience. */
export function validateLeonaDeaths(state: ChampionState, unit: Unit, tick: number) {
  const leona = unit.champion === 'leona',
    fresh = leona && unit.deadAt !== null && tick < unit.deadAt + LEONA_DEATH_AUDIO_TICKS;
  if (
    (leona && (unit.hp === 0) !== (unit.deadAt !== null)) ||
    state.leonaDeathVisuals.length !== (fresh ? 1 : 0)
  )
    throw Error('Saved Leona death lacks its bounded source history.');
  for (const r of state.leonaDeathVisuals) {
    if (
      r.startTick !== unit.deadAt ||
      r.startTick > tick ||
      unit.respawnTick === null ||
      r.point.x !== unit.x ||
      r.point.y !== unit.y ||
      !r.audience.includes(unit.team as Team) ||
      r.audience.join(',') !==
        (['blue', 'red'] as const).filter((t) => r.audience.includes(t)).join(',')
    )
      throw Error('Saved match contains invalid Leona death history.');
  }
}
