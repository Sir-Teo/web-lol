import type { ChampionState, LuxImpactFrame, Projectile, Team, Unit } from './types';
import type { World } from './world';
import type { Vec2 } from './math';
import { capturePoseFrame } from './pose-history';
import { impactTargetRig, type ImpactRig } from '../content/impact-target';
import timing from '../content/leona-e-history-bounds.json';

export interface ZenithPointFrame {
  tick: number;
  x: number;
  y: number;
  facing: number;
  audience: Team[];
}
export type ZenithPoseFrame = LuxImpactFrame & { audience: Team[] };
export type ZenithDashEnd = 'arrived' | 'control' | 'target-lost' | 'flash' | 'death' | 'match-end';
export interface ZenithVisual {
  startTick: number;
  rank: number;
  radius: number;
  direction: Vec2;
  castFrame: ZenithPointFrame;
  endTick: number | null;
  endReason: ZenithDashEnd | 'range' | null;
  /** First death of this cast's owner, retained across a subsequent respawn. */
  death: { tick: number; level: number; respawnTick: number; frame: ZenithPointFrame } | null;
  /** Bounded rolling root history; event anchors remain independently retained. */
  frames: ZenithPointFrame[];
  flight: {
    id: number;
    startTick: number;
    origin: Vec2;
    audience: Team[];
    stopTick: number | null;
    endReason: 'range' | 'match-end' | null;
    frames: { tick: number; x: number; y: number; remaining: number; audience: Team[] }[];
    contacts: {
      tick: number;
      fraction: number;
      point: Vec2;
      targetId: number;
      targetKind: Unit['kind'];
      targetTeam: Unit['team'];
      targetRig: ImpactRig | null;
      radius: number;
      audience: Team[];
      detachedTick: number | null;
      frames: ZenithPoseFrame[];
    }[];
  } | null;
  dash: {
    startTick: number;
    targetId: number;
    startFrame: ZenithPointFrame;
    stopTick: number | null;
    endReason: ZenithDashEnd | null;
    stopFrame: ZenithPointFrame | null;
    stopCause: {
      attemptPoint: Vec2;
      rootUntil: number;
      stunUntil: number;
      charmUntil?: number;
      targetAlive: boolean;
      targetPoint: Vec2 | null;
      targetRadius: number;
    } | null;
  } | null;
  arrival: { tick: number; detachedTick: number | null; frames: ZenithPoseFrame[] } | null;
}
const teams = ['blue', 'red'] as const;
const pointFrame = (world: World, unit: Unit): ZenithPointFrame => ({
  tick: world.tick,
  x: unit.x,
  y: unit.y,
  facing: unit.facing,
  audience: teams.filter((team) => world.visible(unit, team)),
});
function poseFrame(world: World, unit: Unit): ZenithPoseFrame {
  return {
    ...capturePoseFrame(unit, world.tick),
    audience: teams.filter((team) => world.visible(unit, team)),
  };
}
function append<T extends { tick: number }>(frames: T[], value: T) {
  if (frames.at(-1)?.tick === value.tick) frames[frames.length - 1] = value;
  else frames.push(value);
}
function record(world: World, source: Unit, castTick: number) {
  const r = world.championState(source.id)?.leonaEVisuals.find((r) => r.startTick === castTick);
  if (!r) throw Error('Zenith phase lacks its accepted cast history.');
  return r;
}
export function beginZenithVisual(world: World, source: Unit, state: ChampionState) {
  if (!state.leonaEWindup) throw Error('Zenith history requires an accepted windup.');
  const first = pointFrame(world, source);
  state.leonaEVisuals.push({
    startTick: world.tick,
    rank: state.leonaEWindup.rank,
    radius: source.radius,
    direction: { ...state.leonaEWindup.direction },
    castFrame: first,
    endTick: null,
    endReason: null,
    death: null,
    frames: [structuredClone(first)],
    flight: null,
    dash: null,
    arrival: null,
  });
}
export function launchZenithVisual(world: World, source: Unit, p: Projectile) {
  const r = record(world, source, p.zenith!.castTick);
  if (r.flight || r.endTick !== null)
    throw Error('Zenith flight was already launched or cancelled.');
  r.flight = {
    id: p.id,
    startTick: world.tick,
    origin: { ...p.origin! },
    audience: teams.filter((team) => world.projectileVisible(p, team)),
    stopTick: null,
    endReason: null,
    frames: [],
    contacts: [],
  };
}
export function captureZenithFlightFrame(world: World, source: Unit, p: Projectile) {
  const f = record(world, source, p.zenith!.castTick).flight;
  if (!f || f.id !== p.id) throw Error('Zenith flight identity changed.');
  append(f.frames, {
    tick: world.tick,
    x: p.x,
    y: p.y,
    remaining: p.remaining,
    audience: teams.filter((team) => world.projectileVisible(p, team)),
  });
}
export function contactZenithVisual(
  world: World,
  source: Unit,
  p: Projectile,
  target: Unit,
  fraction: number,
  end: Vec2
) {
  const f = record(world, source, p.zenith!.castTick).flight;
  if (!f || f.contacts.some((c) => c.targetId === target.id))
    throw Error('Zenith contact is missing its flight or is duplicated.');
  f.contacts.push({
    tick: world.tick,
    fraction,
    point: { x: p.x + (end.x - p.x) * fraction, y: p.y + (end.y - p.y) * fraction },
    targetId: target.id,
    targetKind: target.kind,
    targetTeam: target.team,
    targetRig: impactTargetRig(target),
    radius: target.radius,
    audience: teams.filter((team) => world.visible(target, team)),
    detachedTick: null,
    frames: [poseFrame(world, target)],
  });
}
export function finishZenithFlight(world: World, source: Unit, p: Projectile) {
  captureZenithFlightFrame(world, source, p);
  const f = record(world, source, p.zenith!.castTick).flight!;
  f.stopTick = world.tick;
  f.endReason = 'range';
}
export function settleZenithFlight(world: World, source: Unit, p: Projectile) {
  const r = record(world, source, p.zenith!.castTick);
  if (!r.dash && r.endTick === null) {
    r.endTick = world.tick;
    r.endReason = 'range';
  }
}
export function beginZenithDashVisual(world: World, source: Unit) {
  const dash = world.championState(source.id)!.leonaDash!,
    r = record(world, source, dash.castTick);
  if (!r.flight || r.flight.stopTick !== world.tick || r.dash)
    throw Error('Zenith dash lacks its completed flight.');
  r.dash = {
    startTick: world.tick,
    targetId: dash.targetId,
    startFrame: pointFrame(world, source),
    stopTick: null,
    endReason: null,
    stopFrame: null,
    stopCause: null,
  };
}
/** Capture the event endpoint before a later movement/Flash can replace it. */
export function stopZenithDashVisual(
  world: World,
  source: Unit,
  reason: ZenithDashEnd,
  attemptPoint: Vec2 = source,
  castTick = world.championState(source.id)?.leonaDash?.castTick,
  control: { rootUntil: number; stunUntil: number; charmUntil?: number } = {
    rootUntil: source.rootUntil,
    stunUntil: source.stunUntil,
    ...(source.charm ? { charmUntil: source.charm.endTick } : {}),
  }
) {
  if (castTick === undefined) return;
  const r = record(world, source, castTick),
    d = r.dash;
  if (!d || d.stopTick !== null) throw Error('Zenith dash has no active presentation.');
  d.stopTick = world.tick;
  d.endReason = reason;
  d.stopFrame = pointFrame(world, source);
  const target = world.unit(d.targetId);
  d.stopCause = {
    attemptPoint: { x: attemptPoint.x, y: attemptPoint.y },
    ...control,
    targetAlive: !!target && world.alive(target),
    targetPoint: target ? { x: target.x, y: target.y } : null,
    targetRadius:
      target?.radius ?? r.flight!.contacts.find((c) => c.targetId === d.targetId)!.radius,
  };
  r.endTick = world.tick;
  r.endReason = reason;
  if (reason === 'arrived')
    r.arrival = { tick: world.tick, detachedTick: null, frames: [poseFrame(world, source)] };
}
export function stopZenithVisual(world: World, source: Unit, reason: 'death' | 'match-end') {
  const state = world.championState(source.id);
  if (!state) return;
  if (reason === 'death')
    for (const r of state.leonaEVisuals)
      if (!r.death) {
        if (source.deadAt === null || source.respawnTick === null)
          throw Error('Zenith owner death lacks its respawn clock.');
        r.death = {
          tick: source.deadAt,
          level: state.level,
          respawnTick: source.respawnTick,
          frame: pointFrame(world, source),
        };
      }
  stopZenithDashVisual(world, source, reason);
  for (const r of state.leonaEVisuals) {
    if (r.endTick !== null) continue;
    if (reason === 'death' && r.flight) continue; // Launched flight survives its owner.
    if (r.flight && r.flight.stopTick === null) {
      const p = world.projectiles.find((p) => p.id === r.flight!.id);
      if (!p) throw Error('Active Zenith flight was removed before its terminal capture.');
      captureZenithFlightFrame(world, source, p);
      r.flight.stopTick = world.tick;
      r.flight.endReason = 'match-end';
    }
    r.endTick = world.tick;
    r.endReason = reason;
  }
}
export function zenithExpiry(r: ZenithVisual) {
  return r.endTick === null ? Infinity : r.endTick + timing.bounds.history;
}
export function advanceZenithVisuals(world: World) {
  for (const source of world.units) {
    if (source.champion !== 'leona') continue;
    const state = world.championState(source.id);
    if (!state?.leonaEVisuals.length) continue;
    state.leonaEVisuals = state.leonaEVisuals.filter((r) => world.tick < zenithExpiry(r));
    for (const r of state.leonaEVisuals) {
      const old = r.frames.at(-1)!;
      if (r.death?.tick === world.tick) r.death.frame = pointFrame(world, source);
      append(
        r.frames,
        r.death && world.tick > r.death.tick
          ? { ...structuredClone(old), tick: world.tick }
          : pointFrame(world, source)
      );
      if (r.frames.length > timing.bounds.sourceWindow)
        r.frames.splice(0, r.frames.length - timing.bounds.sourceWindow);
      const f = r.flight;
      if (f && f.stopTick === null) {
        const p = world.projectiles.find((p) => p.id === f.id);
        if (p) captureZenithFlightFrame(world, source, p);
      }
      if (f)
        for (const c of f.contacts) {
          if (world.tick >= c.tick + timing.bounds.contact) continue;
          const target = world.unit(c.targetId),
            old = c.frames.at(-1)!;
          const next =
            (c.detachedTick === null || c.detachedTick === world.tick) && target
              ? poseFrame(world, target)
              : { ...structuredClone(old), tick: world.tick };
          if (c.detachedTick === null && (!target || !world.alive(target)))
            c.detachedTick = world.tick;
          append(c.frames, next);
        }
      const a = r.arrival;
      if (a && world.tick < a.tick + timing.bounds.arrival) {
        const old = a.frames.at(-1)!;
        const next =
          a.detachedTick === null || a.detachedTick === world.tick
            ? poseFrame(world, source)
            : { ...structuredClone(old), tick: world.tick };
        if (a.detachedTick === null && !world.alive(source)) a.detachedTick = world.tick;
        append(a.frames, next);
      }
    }
  }
}
