import { HIGHLANDER_KILL_HISTORY_TICKS } from '../content/masteryi-r-kill-timing';
import { alphaVanished } from './masteryi-alpha-strike';
import {
  appendActorRoot,
  actorRootAt,
  validateActorRoots,
  type ActorRootRun,
} from './actor-root-history';
import type { ChampionState, Unit, Team } from './types';
import type { World } from './world';
export interface HighlanderKillVisual {
  castTick: number;
  tick: number;
  rank: number;
  extensionIndex: number;
  victimId: number;
  victimTeam: Team;
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
/** Local visual admission follows an actually awarded, live active-R extension. */
export function captureHighlanderKill(
  world: World,
  unit: Unit,
  owner: ChampionState,
  victim: Unit
): void {
  const buff = owner.highlander;
  if (
    unit.champion !== 'masteryi' ||
    !buff ||
    victim.kind !== 'champion' ||
    victim.team === unit.team
  )
    return;
  const frames: ActorRootRun[] = [];
  appendActorRoot(frames, frame(world, unit));
  owner.highlanderKillVisuals.push({
    castTick: buff.startTick,
    tick: world.tick,
    rank: buff.rank,
    extensionIndex: buff.extensionCount,
    victimId: victim.id,
    victimTeam: victim.team,
    audience: (['blue', 'red'] as const).filter((t) => world.visible(unit, t)),
    detachedTick: null,
    frames,
  });
}
export function advanceHighlanderKills(world: World): void {
  for (const unit of world.units) {
    if (unit.champion !== 'masteryi') continue;
    const records = world.championState(unit.id)?.highlanderKillVisuals;
    if (!records?.length) continue;
    for (const r of records) {
      if (world.tick >= r.tick + HIGHLANDER_KILL_HISTORY_TICKS) continue;
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
export function validateHighlanderKills(
  owner: ChampionState,
  unit: Unit,
  world: { tick: number; units: readonly Unit[] }
): void {
  let previous: HighlanderKillVisual | undefined;
  const seen = new Set<string>();
  for (const r of owner.highlanderKillVisuals) {
    const audio = owner.highlanderAudio.find((a) => a.startTick === r.castTick),
      buff = owner.highlander?.startTick === r.castTick ? owner.highlander : null,
      victim = world.units.find((u) => u.id === r.victimId),
      last = r.frames.at(-1)!,
      key = `${r.castTick}:${r.victimId}`;
    if (
      unit.champion !== 'masteryi' ||
      r.rank > owner.spellRanks.r ||
      r.castTick > r.tick ||
      r.tick > world.tick ||
      world.tick >= r.tick + HIGHLANDER_KILL_HISTORY_TICKS ||
      !audio ||
      audio.rank !== r.rank ||
      audio.takedownsAtCast + r.extensionIndex > owner.kills + owner.assists ||
      !r.audience.includes(unit.team as Team) ||
      !victim ||
      victim.kind !== 'champion' ||
      victim.team !== r.victimTeam ||
      victim.team === unit.team ||
      victim.id === unit.id ||
      victim.deadAt !== r.tick ||
      seen.has(key) ||
      (previous &&
        (r.tick < previous.tick ||
          (r.tick === previous.tick && r.castTick < previous.castTick) ||
          (r.castTick === previous.castTick &&
            r.extensionIndex !== previous.extensionIndex + 1))) ||
      (buff
        ? r.extensionIndex > buff.extensionCount ||
          r.tick > buff.lastExtensionTick! ||
          (r.extensionIndex === buff.extensionCount && r.tick !== buff.lastExtensionTick)
        : !audio.stop ||
          audio.stop.extensionCount < r.extensionIndex ||
          r.tick > audio.stop.tick ||
          (audio.stop.reason === 'expired' && r.tick === audio.stop.tick)) ||
      (r.detachedTick !== null &&
        (r.detachedTick < r.tick ||
          r.detachedTick > world.tick ||
          unit.deadAt !== r.detachedTick)) ||
      (r.detachedTick === null &&
        (unit.hp <= 0 || last.x !== unit.x || last.y !== unit.y || last.facing !== unit.facing))
    )
      throw Error('Saved match contains invalid Highlander takedown history.');
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
          throw Error('Saved match contains invalid frozen Highlander takedown root.');
    }
    seen.add(key);
    previous = r;
  }
  const buff = owner.highlander;
  if (
    buff &&
    buff.lastExtensionTick !== null &&
    world.tick < buff.lastExtensionTick + HIGHLANDER_KILL_HISTORY_TICKS
  ) {
    const records = owner.highlanderKillVisuals.filter((r) => r.castTick === buff.startTick),
      last = records.at(-1);
    if (
      !last ||
      last.extensionIndex !== buff.extensionCount ||
      last.tick !== buff.lastExtensionTick ||
      (world.tick < buff.startTick + HIGHLANDER_KILL_HISTORY_TICKS &&
        records[0].extensionIndex !== 1)
    )
      throw Error('Saved match lacks its accepted Highlander takedown.');
  }
}
