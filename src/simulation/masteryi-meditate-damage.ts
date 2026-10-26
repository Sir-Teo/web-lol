import { MEDITATE_DAMAGE_HISTORY_TICKS } from '../content/masteryi-w-damage-timing';
import { MEDITATE_LINGER_TICKS } from './masteryi-meditate';
import { alphaVanished } from './masteryi-alpha-strike';
import {
  appendActorRoot,
  actorRootAt,
  validateActorRoots,
  type ActorRootRun,
} from './actor-root-history';
import type { ChampionState, Unit, Team } from './types';
import type { World } from './world';
export interface MeditateDamageVisual {
  castTick: number;
  tick: number;
  rank: number;
  audience: Team[];
  detachedTick: number | null;
  frames: ActorRootRun[];
}
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
/** Local positive reduced-damage admission coalesces one reaction per owner/tick. */
export function captureMeditateDamage(world: World, unit: Unit, owner: ChampionState): void {
  const channel = owner.meditate;
  if (
    unit.champion !== 'masteryi' ||
    !channel ||
    owner.meditateDamageVisuals.at(-1)?.tick === world.tick
  )
    return;
  const frames: ActorRootRun[] = [];
  appendActorRoot(frames, frame(world, unit));
  owner.meditateDamageVisuals.push({
    castTick: channel.startTick,
    tick: world.tick,
    rank: channel.rank,
    audience: (['blue', 'red'] as const).filter((t) => world.visible(unit, t)),
    detachedTick: null,
    frames,
  });
}
export function advanceMeditateDamage(world: World): void {
  for (const unit of world.units) {
    if (unit.champion !== 'masteryi') continue;
    const records = world.championState(unit.id)?.meditateDamageVisuals;
    if (!records?.length) continue;
    for (const r of records) {
      if (world.tick >= r.tick + MEDITATE_DAMAGE_HISTORY_TICKS) continue;
      const previous = r.frames.at(-1)!;
      let next = r.detachedTick === null ? frame(world, unit) : { ...previous, tick: world.tick };
      if (!world.alive(unit) && r.detachedTick === null) {
        r.detachedTick = world.tick;
        if (world.tick === r.tick) next = { ...next, audience: [...r.audience] };
      }
      appendActorRoot(r.frames, next);
    }
  }
}
export function validateMeditateDamage(
  owner: ChampionState,
  unit: Unit,
  world: { tick: number }
): void {
  let previous = -1;
  for (const r of owner.meditateDamageVisuals) {
    const audio = owner.meditateAudio.find((a) => a.startTick === r.castTick),
      last = r.frames.at(-1)!;
    if (
      unit.champion !== 'masteryi' ||
      r.rank > owner.spellRanks.w ||
      r.castTick > r.tick ||
      r.tick <= previous ||
      r.tick > world.tick ||
      world.tick >= r.tick + MEDITATE_DAMAGE_HISTORY_TICKS ||
      !audio ||
      audio.rank !== r.rank ||
      !r.audience.includes(unit.team as Team) ||
      r.tick >= (audio.stop?.tick ?? audio.endTick) + MEDITATE_LINGER_TICKS ||
      (audio.stop &&
        ['death', 'victory'].includes(audio.stop.reason) &&
        r.tick > audio.stop.tick) ||
      (r.detachedTick !== null &&
        (r.detachedTick < r.tick ||
          r.detachedTick > world.tick ||
          unit.deadAt !== r.detachedTick)) ||
      (r.detachedTick === null &&
        (unit.hp <= 0 || last.x !== unit.x || last.y !== unit.y || last.facing !== unit.facing))
    )
      throw Error('Saved match contains invalid Meditate damage history.');
    validateActorRoots(r.frames, r.tick, world.tick);
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
          throw Error('Saved match contains invalid frozen Meditate damage root.');
    }
    previous = r.tick;
  }
}
