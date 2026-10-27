import { ALPHA_END_HISTORY_TICKS } from '../content/masteryi-q-end-timing';
import { MASTER_YI_Q } from '../content/masteryi-q';
import { ALPHA_MARK_TICKS, alphaVanished, type AlphaStrikeState } from './masteryi-alpha-strike';
import {
  appendActorRoot,
  validateActorRoots,
  actorRootAt,
  type ActorRootRun,
} from './actor-root-history';
import type { ChampionState, Unit, Team } from './types';
import type { Vec2 } from './math';
import type { World } from './world';

export interface AlphaEndVisual {
  castTick: number;
  startTick: number;
  rank: number;
  markCount: number;
  stopReason: 'complete' | 'lost';
  point: Vec2;
  audience: Team[];
  detachedTick: number | null;
  frames: ActorRootRun[];
}
function frame(world: World, unit: Unit) {
  const vanished = alphaVanished(world.championState(unit.id));
  return {
    tick: world.tick,
    x: unit.x,
    y: unit.y,
    facing: unit.facing,
    audience: (['blue', 'red'] as const).filter((t) => !vanished && world.visible(unit, t)),
  };
}
/** Explicit local creation at accepted return, before pending contacts resolve. */
export function captureAlphaEnd(world: World, unit: Unit, q: AlphaStrikeState): void {
  const owner = world.championState(unit.id);
  if (
    unit.champion !== 'masteryi' ||
    !owner ||
    q.reappearTick !== world.tick ||
    !q.returnPoint ||
    !q.stopReason
  )
    return;
  const first = frame(world, unit),
    frames: ActorRootRun[] = [];
  appendActorRoot(frames, first);
  owner.alphaEndVisuals.push({
    castTick: q.startTick,
    startTick: world.tick,
    rank: q.rank,
    markCount: q.marks.length,
    stopReason: q.stopReason,
    point: { ...q.returnPoint },
    audience: [...first.audience],
    detachedTick: null,
    frames,
  });
}
export function advanceAlphaEnds(world: World): void {
  for (const unit of world.units) {
    if (unit.champion !== 'masteryi') continue;
    const records = world.championState(unit.id)?.alphaEndVisuals;
    if (!records?.length) continue;
    for (const r of records) {
      if (world.tick >= r.startTick + ALPHA_END_HISTORY_TICKS) continue;
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
export function validateAlphaEnds(owner: ChampionState, unit: Unit, world: { tick: number }): void {
  let before = -1;
  for (const r of owner.alphaEndVisuals) {
    const audio = owner.alphaAudio.find((a) => a.startTick === r.castTick),
      last = r.frames.at(-1)!;
    const q = owner.alphaStrike?.startTick === r.castTick ? owner.alphaStrike : null;
    if (
      unit.champion !== 'masteryi' ||
      r.rank > owner.spellRanks.q ||
      r.startTick <= before ||
      r.startTick > world.tick ||
      world.tick >= r.startTick + ALPHA_END_HISTORY_TICKS ||
      r.startTick !==
        r.castTick + (r.markCount + (r.stopReason === 'lost' ? 1 : 0)) * ALPHA_MARK_TICKS ||
      (r.stopReason === 'complete'
        ? r.markCount !== MASTER_YI_Q.bounceCount
        : r.markCount >= MASTER_YI_Q.bounceCount) ||
      r.frames[0].x !== r.point.x ||
      r.frames[0].y !== r.point.y ||
      !r.audience.includes(unit.team as Team) ||
      !audio ||
      audio.rank !== r.rank ||
      (q &&
        (q.reappearTick !== r.startTick ||
          q.marks.length !== r.markCount ||
          q.stopReason !== r.stopReason ||
          q.returnPoint?.x !== r.point.x ||
          q.returnPoint?.y !== r.point.y)) ||
      (r.detachedTick !== null &&
        (r.detachedTick < r.startTick ||
          r.detachedTick > world.tick ||
          unit.deadAt !== r.detachedTick)) ||
      (r.detachedTick === null &&
        (unit.hp <= 0 || last.x !== unit.x || last.y !== unit.y || last.facing !== unit.facing))
    )
      throw Error('Saved match contains invalid Alpha Strike reappearance history.');
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
          throw Error('Saved match contains invalid frozen Alpha Strike reappearance root.');
    }
    before = r.startTick;
  }
  const q = owner.alphaStrike;
  if (
    q?.reappearTick !== null &&
    q?.reappearTick !== undefined &&
    world.tick < q.reappearTick + ALPHA_END_HISTORY_TICKS &&
    !owner.alphaEndVisuals.some((r) => r.castTick === q.startTick && r.startTick === q.reappearTick)
  )
    throw Error('Saved match lacks its accepted Alpha Strike reappearance.');
}
