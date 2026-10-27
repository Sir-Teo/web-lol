import { HIGHLANDER_CAST_HISTORY_TICKS } from '../content/masteryi-r-cast-timing';
import {
  appendActorRoot,
  validateActorRoots,
  actorRootAt,
  type ActorRootRun,
} from './actor-root-history';
import { alphaVanished } from './masteryi-alpha-strike';
import type { ChampionState, Unit, Team } from './types';
import type { Vec2 } from './math';
import type { World } from './world';
export interface HighlanderCastVisual {
  startTick: number;
  rank: number;
  origin: Vec2;
  audience: Team[];
  detachedTick: number | null;
  frames: ActorRootRun[];
}
/** Known admission stays separate from current actor body visibility. */
function frame(world: World, unit: Unit) {
  return {
    tick: world.tick,
    x: unit.x,
    y: unit.y,
    facing: unit.facing,
    audience: (['blue', 'red'] as const).filter(
      (t) => !alphaVanished(world.championState(unit.id)) && world.visible(unit, t)
    ),
  };
}
export function captureHighlanderCast(world: World, unit: Unit): void {
  const owner = world.championState(unit.id),
    buff = owner?.highlander;
  if (unit.champion !== 'masteryi' || !owner || !buff) return;
  const first = frame(world, unit),
    frames: ActorRootRun[] = [];
  appendActorRoot(frames, first);
  owner.highlanderCastVisuals.push({
    startTick: buff.startTick,
    rank: buff.rank,
    origin: { x: unit.x, y: unit.y },
    audience: (['blue', 'red'] as const).filter((t) => world.visible(unit, t)),
    detachedTick: null,
    frames,
  });
}
export function advanceHighlanderCasts(world: World): void {
  for (const unit of world.units) {
    if (unit.champion !== 'masteryi') continue;
    const records = world.championState(unit.id)?.highlanderCastVisuals;
    if (!records?.length) continue;
    for (const r of records) {
      if (world.tick >= r.startTick + HIGHLANDER_CAST_HISTORY_TICKS) continue;
      const previous = r.frames.at(-1)!;
      let next = r.detachedTick === null ? frame(world, unit) : { ...previous, tick: world.tick };
      if (!world.alive(unit) && r.detachedTick === null) {
        r.detachedTick = world.tick;
        if (world.tick === r.startTick) next = { ...next, audience: [...r.audience] };
      }
      appendActorRoot(r.frames, next);
    }
  }
}
export function validateHighlanderCasts(
  owner: ChampionState,
  unit: Unit,
  world: { tick: number }
): void {
  let before = -1;
  for (const r of owner.highlanderCastVisuals) {
    const last = r.frames.at(-1)!,
      audio = owner.highlanderAudio.find((a) => a.startTick === r.startTick);
    if (
      unit.champion !== 'masteryi' ||
      r.rank > owner.spellRanks.r ||
      r.startTick <= before ||
      r.startTick > world.tick ||
      world.tick >= r.startTick + HIGHLANDER_CAST_HISTORY_TICKS ||
      !r.audience.includes(unit.team as Team) ||
      !audio ||
      audio.rank !== r.rank ||
      audio.origin.x !== r.origin.x ||
      audio.origin.y !== r.origin.y ||
      JSON.stringify(audio.castAudience) !== JSON.stringify(r.audience) ||
      (r.detachedTick !== null &&
        (r.detachedTick < r.startTick ||
          r.detachedTick > world.tick ||
          unit.deadAt !== r.detachedTick)) ||
      (r.detachedTick === null &&
        (unit.hp <= 0 || last.x !== unit.x || last.y !== unit.y || last.facing !== unit.facing))
    )
      throw Error('Saved match contains invalid Highlander cast history.');
    validateActorRoots(r.frames, r.startTick, world.tick);
    if (r.detachedTick !== null) {
      const death = actorRootAt(r.frames, r.detachedTick);
      for (const run of r.frames)
        if (
          run.tick > r.detachedTick &&
          (run.x !== death.x ||
            run.y !== death.y ||
            run.facing !== death.facing ||
            JSON.stringify(run.audience) !== JSON.stringify(death.audience))
        )
          throw Error('Saved match contains invalid frozen Highlander cast root.');
    }
    before = r.startTick;
  }
  const buff = owner.highlander;
  if (
    buff &&
    world.tick < buff.startTick + HIGHLANDER_CAST_HISTORY_TICKS &&
    !owner.highlanderCastVisuals.some((r) => r.startTick === buff.startTick)
  )
    throw Error('Saved match lacks its accepted Highlander cast.');
}
