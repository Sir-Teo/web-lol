import {
  PASSIVE_TRAIL_HISTORY_TICKS,
  PASSIVE_TRAIL_MARKERS,
} from '../content/masteryi-passive-trail-timing';
import { MASTER_YI_PASSIVE } from '../content/masteryi-passive';
import { appendActorRoot, validateActorRoots, type ActorRootRun } from './actor-root-history';
import { alphaVanished } from './masteryi-alpha-strike';
import { renderedEventTick } from './rendered-event-clock';
import type { ChampionState, Unit, Team, Faction } from './types';
import type { World } from './world';
export interface PassiveTrailVisual {
  startTick: number;
  releaseTick: number;
  endTick: number;
  targetId: number;
  targetTeam: Faction;
  stopTick: number | null;
  /** Actual current-pose decisions at each marker; null means not reached. */
  events: [boolean | null, boolean | null];
  frames: ActorRootRun[];
}
export function passiveTrailMarkerTick(
  record: Pick<PassiveTrailVisual, 'startTick' | 'endTick'>,
  event: 0 | 1
): number {
  return renderedEventTick(record, PASSIVE_TRAIL_MARKERS[event]);
}
export function passiveTrailExpiry(record: Pick<PassiveTrailVisual, 'startTick' | 'endTick'>) {
  return passiveTrailMarkerTick(record, 1) + 1 + PASSIVE_TRAIL_HISTORY_TICKS;
}
function frame(world: World, unit: Unit) {
  return {
    tick: world.tick,
    x: unit.x,
    y: unit.y,
    facing: unit.facing,
    audience: (['blue', 'red'] as const).filter(
      (team) => !alphaVanished(world.championState(unit.id)) && world.visible(unit, team)
    ),
  };
}
export function capturePassiveTrail(world: World, unit: Unit, target: Unit): void {
  if (unit.champion !== 'masteryi') return;
  const owner = world.championState(unit.id)!,
    strike = owner.doubleStrike!.strike!;
  const frames: ActorRootRun[] = [];
  appendActorRoot(frames, frame(world, unit));
  owner.passiveTrailVisuals.push({
    startTick: strike.startTick,
    releaseTick: strike.releaseTick,
    endTick: strike.endTick,
    targetId: target.id,
    targetTeam: target.team,
    stopTick: strike.poseStopTick,
    events: [null, null],
    frames,
  });
}
/** Resolve after all current animation clocks, never in a mid-update death pass.
 * An accepted gameplay child can survive while another pose owns its body. */
export function resolvePassiveTrailMarkers(world: World, unit: Unit): void {
  if (unit.champion !== 'masteryi') return;
  const owner = world.championState(unit.id)!,
    child = owner.doubleStrike?.strike;
  for (const record of owner.passiveTrailVisuals)
    for (const event of [0, 1] as const) {
      const marker = passiveTrailMarkerTick(record, event);
      if (world.tick < marker || record.events[event] !== null) continue;
      record.events[event] =
        world.tick === marker &&
        unit.hp > 0 &&
        child?.startTick === record.startTick &&
        (child.poseStopTick === null || child.poseStopTick > marker) &&
        unit.animationTimeline?.tick === world.tick &&
        unit.animationTimeline.primary.clip === MASTER_YI_PASSIVE.defaultPoseClip;
    }
}
/** Fully bound finite particles need current roots and their birth visibility. */
export function advancePassiveTrails(world: World): void {
  for (const unit of world.units) {
    if (unit.champion !== 'masteryi') continue;
    const owner = world.championState(unit.id)!;
    owner.passiveTrailVisuals = owner.passiveTrailVisuals.filter(
      (record) => world.tick < passiveTrailExpiry(record)
    );
    for (const record of owner.passiveTrailVisuals) {
      const child = owner.doubleStrike?.strike,
        cut = child?.startTick === record.startTick ? child.poseStopTick : null;
      for (const tick of [cut, unit.deadAt])
        if (
          tick !== null &&
          tick >= record.startTick &&
          (record.stopTick === null || tick < record.stopTick)
        )
          record.stopTick = tick;
      appendActorRoot(record.frames, frame(world, unit));
      const first = Math.max(record.startTick, world.tick - PASSIVE_TRAIL_HISTORY_TICKS + 1);
      while (record.frames[0].endTick < first) record.frames.shift();
      record.frames[0].tick = Math.max(first, record.frames[0].tick);
    }
  }
}
export function validatePassiveTrails(
  owner: ChampionState,
  unit: Unit,
  world: { tick: number; nextId: number; units: Unit[] }
): void {
  let previous = -1;
  for (const record of owner.passiveTrailVisuals) {
    const target = world.units.find((u) => u.id === record.targetId),
      last = record.frames.at(-1)!;
    if (
      unit.champion !== 'masteryi' ||
      record.startTick <= previous ||
      record.startTick > world.tick ||
      record.releaseTick <= record.startTick ||
      record.endTick <= record.releaseTick ||
      record.targetId >= world.nextId ||
      record.targetId === unit.id ||
      record.targetTeam === unit.team ||
      (target && target.team !== record.targetTeam) ||
      world.tick >= passiveTrailExpiry(record) ||
      (record.stopTick !== null &&
        (record.stopTick < record.startTick || record.stopTick > world.tick)) ||
      (unit.deadAt !== null &&
        unit.deadAt >= record.startTick &&
        (record.stopTick === null || record.stopTick > unit.deadAt)) ||
      last.x !== unit.x ||
      last.y !== unit.y ||
      last.facing !== unit.facing ||
      (alphaVanished(owner)
        ? last.audience.length !== 0
        : !last.audience.includes(unit.team as Team))
    )
      throw Error('Saved match contains invalid passive trail history');
    for (const event of [0, 1] as const)
      if (world.tick < passiveTrailMarkerTick(record, event) !== (record.events[event] === null))
        throw Error('Saved passive trail marker decision differs');
    validateActorRoots(
      record.frames,
      Math.max(record.startTick, world.tick - PASSIVE_TRAIL_HISTORY_TICKS + 1),
      world.tick
    );
    const child = owner.doubleStrike?.strike;
    if (
      child?.startTick === record.startTick &&
      (record.releaseTick !== child.releaseTick ||
        record.endTick !== child.endTick ||
        record.targetId !== child.targetId ||
        record.stopTick !== child.poseStopTick)
    )
      throw Error('Saved passive trail differs from its accepted child');
    previous = record.startTick;
  }
  const child = owner.doubleStrike?.strike;
  if (
    child &&
    world.tick < passiveTrailExpiry(child) &&
    !owner.passiveTrailVisuals.some((record) => record.startTick === child.startTick)
  )
    throw Error('Saved match lacks its accepted passive trail');
}
