import { ALPHA_CAST_HISTORY_TICKS } from '../content/masteryi-q-cast-timing';
import {
  appendActorRoot,
  validateActorRoots,
  actorRootAt,
  type ActorRootRun,
} from './actor-root-history';
import type { ChampionState, Unit, Team } from './types';
import type { Vec2 } from './math';
import type { World } from './world';
export interface AlphaCastVisual {
  startTick: number;
  rank: number;
  origin: Vec2;
  audience: Team[];
  detachedTick: number | null;
  frames: ActorRootRun[];
}
/** Q's own cast effect remains visible while the actor body is vanished. */
function frame(world: World, unit: Unit) {
  return {
    tick: world.tick,
    x: unit.x,
    y: unit.y,
    facing: unit.facing,
    audience: (['blue', 'red'] as const).filter((t) => world.visible(unit, t)),
  };
}
export function captureAlphaCast(world: World, unit: Unit): void {
  const owner = world.championState(unit.id),
    q = owner?.alphaStrike;
  if (unit.champion !== 'masteryi' || !owner || !q) return;
  const first = frame(world, unit),
    frames: ActorRootRun[] = [];
  appendActorRoot(frames, first);
  owner.alphaCastVisuals.push({
    startTick: q.startTick,
    rank: q.rank,
    origin: { ...q.origin },
    audience: [...first.audience],
    detachedTick: null,
    frames,
  });
}
export function advanceAlphaCasts(world: World): void {
  for (const unit of world.units) {
    if (unit.champion !== 'masteryi') continue;
    const records = world.championState(unit.id)?.alphaCastVisuals;
    if (!records?.length) continue;
    for (const r of records) {
      if (world.tick >= r.startTick + ALPHA_CAST_HISTORY_TICKS) continue;
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
export function validateAlphaCasts(
  owner: ChampionState,
  unit: Unit,
  world: { tick: number }
): void {
  let before = -1;
  for (const r of owner.alphaCastVisuals) {
    const last = r.frames.at(-1)!,
      audio = owner.alphaAudio.find((a) => a.startTick === r.startTick);
    if (
      unit.champion !== 'masteryi' ||
      r.rank > owner.spellRanks.q ||
      r.startTick <= before ||
      r.startTick > world.tick ||
      world.tick >= r.startTick + ALPHA_CAST_HISTORY_TICKS ||
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
      throw Error('Saved match contains invalid Alpha Strike cast history.');
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
          throw Error('Saved match contains invalid frozen Alpha Strike cast root.');
    }
    before = r.startTick;
  }
  const q = owner.alphaStrike;
  if (
    q &&
    world.tick < q.startTick + ALPHA_CAST_HISTORY_TICKS &&
    !owner.alphaCastVisuals.some((r) => r.startTick === q.startTick)
  )
    throw Error('Saved match lacks its accepted Alpha Strike cast.');
}
