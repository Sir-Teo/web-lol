import { MEDITATE_BUFF_TAIL_TICKS } from '../content/masteryi-w-buff-timing';
import { MEDITATE_TICKS } from './masteryi-meditate';
import { alphaVanished } from './masteryi-alpha-strike';
import {
  appendActorRoot,
  validateActorRoots,
  type ActorRootRun,
  type ActorRootFrame,
} from './actor-root-history';
import type { ChampionState, Unit, Team } from './types';
import type { World } from './world';
export type MeditateBuffStop = 'complete' | 'order' | 'control' | 'mana' | 'death' | 'victory';
export interface MeditateBuffVisual {
  startTick: number;
  endTick: number;
  rank: number;
  audience: Team[];
  stopTick: number | null;
  stopReason: MeditateBuffStop | null;
  detachedTick: number | null;
  frames: ActorRootRun[];
}
function frame(world: World, unit: Unit, owner: ChampionState): ActorRootFrame {
  const hidden = alphaVanished(owner);
  return {
    tick: world.tick,
    x: unit.x,
    y: unit.y,
    facing: unit.facing,
    audience: (['blue', 'red'] as const).filter((team) => !hidden && world.visible(unit, team)),
  };
}
export function captureMeditateBuff(world: World, unit: Unit): void {
  const owner = world.championState(unit.id),
    channel = owner?.meditate;
  if (unit.champion !== 'masteryi' || !owner || !channel) return;
  const first = frame(world, unit, owner),
    frames: ActorRootRun[] = [];
  appendActorRoot(frames, first);
  owner.meditateBuffVisuals.push({
    startTick: channel.startTick,
    endTick: channel.endTick,
    rank: channel.rank,
    audience: [...first.audience],
    stopTick: null,
    stopReason: null,
    detachedTick: null,
    frames,
  });
}
export function stopMeditateBuff(
  owner: ChampionState,
  tick: number,
  reason: MeditateBuffStop
): void {
  for (const record of owner.meditateBuffVisuals) {
    if (record.stopTick !== null) continue;
    record.stopTick = Math.min(tick, record.endTick);
    record.stopReason = reason;
  }
}
export function meditateBuffExpiry(record: MeditateBuffVisual): number {
  return (record.stopTick ?? record.endTick) + MEDITATE_BUFF_TAIL_TICKS;
}
export function advanceMeditateBuffs(world: World): void {
  for (const unit of world.units) {
    if (unit.champion !== 'masteryi') continue;
    const owner = world.championState(unit.id);
    if (!owner?.meditateBuffVisuals.length) continue;
    const current = frame(world, unit, owner);
    for (const record of owner.meditateBuffVisuals) {
      if (world.tick >= meditateBuffExpiry(record)) continue;
      const previous = record.frames.at(-1)!;
      let captured = record.detachedTick === null ? current : { ...previous, tick: world.tick };
      if (!world.alive(unit) && record.detachedTick === null) {
        record.detachedTick = world.tick;
        if (world.tick === record.startTick)
          captured = { ...captured, audience: [...record.audience] };
      }
      appendActorRoot(record.frames, captured);
    }
  }
}
export function validateMeditateBuffs(
  owner: ChampionState,
  unit: Unit,
  world: { tick: number; winner: Team | null }
): void {
  let previous = -1;
  for (const record of owner.meditateBuffVisuals) {
    const last = record.frames.at(-1)!;
    if (
      unit.champion !== 'masteryi' ||
      record.rank > owner.spellRanks.w ||
      record.startTick <= previous ||
      record.startTick > world.tick ||
      record.endTick !== record.startTick + MEDITATE_TICKS ||
      world.tick >= meditateBuffExpiry(record) ||
      !record.audience.includes(unit.team as Team) ||
      (record.stopTick === null) !== (record.stopReason === null) ||
      (record.stopTick !== null &&
        (record.stopTick < record.startTick ||
          record.stopTick > world.tick ||
          record.stopTick > record.endTick)) ||
      (record.stopReason === 'complete' && record.stopTick !== record.endTick) ||
      (record.stopReason === 'death' &&
        (unit.deadAt === null || record.stopTick !== unit.deadAt)) ||
      (record.stopReason === 'victory' &&
        (world.winner === null || record.stopTick !== world.tick)) ||
      (record.stopTick === null &&
        (!owner.meditate ||
          owner.meditate.startTick !== record.startTick ||
          owner.meditate.stopTick !== null ||
          unit.hp <= 0 ||
          world.winner !== null)) ||
      (owner.meditate?.startTick === record.startTick &&
        (owner.meditate.rank !== record.rank ||
          owner.meditate.stopTick !== record.stopTick ||
          owner.meditate.stopReason !== record.stopReason)) ||
      (record.detachedTick !== null &&
        (record.detachedTick < record.startTick ||
          record.detachedTick > world.tick ||
          unit.deadAt !== record.detachedTick)) ||
      (record.detachedTick === null &&
        (unit.hp <= 0 || last.x !== unit.x || last.y !== unit.y || last.facing !== unit.facing))
    )
      throw Error('Saved match contains invalid Meditate buff history.');
    validateActorRoots(record.frames, record.startTick, world.tick);
    if (record.detachedTick !== null) {
      const death = record.frames.find(
        (run) => run.tick <= record.detachedTick! && run.endTick >= record.detachedTick!
      )!;
      for (const run of record.frames)
        if (
          run.tick > record.detachedTick &&
          (run.x !== death.x ||
            run.y !== death.y ||
            run.facing !== death.facing ||
            JSON.stringify(run.audience) !== JSON.stringify(death.audience))
        )
          throw Error('Saved match contains invalid frozen Meditate buff root.');
    }
    previous = record.startTick;
  }
  if (
    owner.meditate &&
    !owner.meditateBuffVisuals.some((record) => record.startTick === owner.meditate!.startTick)
  )
    throw Error('Saved match lacks its Meditate buff history.');
}
