import type { ChampionState, LuxImpactFrame, Team, Unit } from './types';
import type { World } from './world';
import type { Vec2 } from './math';
import { capturePoseFrame } from './pose-history';
import { impactTargetRig, type ImpactRig } from '../content/impact-target';
import { championDeathTicks } from './champion-death';
import timing from '../content/leona-r-history-bounds.json';

export type SolarPoseFrame = LuxImpactFrame & { audience: Team[] };
export type SolarSourceFrame = SolarPoseFrame & { areaAudience: Team[] };
export interface SolarPointFrame {
  tick: number;
  x: number;
  y: number;
  facing: number;
  audience: Team[];
}
/** Saved simulation facts only. Source alias/color dispatch remains a separate
 * presentation policy; no particle, audio or native timing is inferred here. */
export interface SolarFlareVisual {
  startTick: number;
  rank: number;
  radius: number;
  point: Vec2;
  castFrame: SolarPointFrame;
  areaAudience: Team[];
  release: SolarPointFrame | null;
  endTick: number | null;
  endReason: 'impact' | 'death' | 'match-end' | null;
  death: { tick: number; level: number; respawnTick: number; frame: SolarPoseFrame } | null;
  frames: SolarSourceFrame[];
  impact: {
    tick: number;
    audience: Team[];
    contacts: {
      targetId: number;
      targetKind: Unit['kind'];
      targetTeam: Unit['team'];
      targetRig: ImpactRig | null;
      radius: number;
      center: boolean;
      point: Vec2;
      audience: Team[];
      detachedTick: number | null;
      frames: SolarPoseFrame[];
    }[];
  } | null;
}
const teams = ['blue', 'red'] as const;
const audience = (world: World, unit: Unit) => teams.filter((t) => world.visible(unit, t));
const areaAudience = (world: World, point: Vec2) =>
  teams.filter((t) => world.pointVisible(point, t));
const pointFrame = (world: World, unit: Unit): SolarPointFrame => ({
  tick: world.tick,
  x: unit.x,
  y: unit.y,
  facing: unit.facing,
  audience: audience(world, unit),
});
const poseFrame = (world: World, unit: Unit): SolarPoseFrame => ({
  ...capturePoseFrame(unit, world.tick),
  audience: audience(world, unit),
});
function append<T extends { tick: number }>(frames: T[], value: T) {
  if (frames.at(-1)?.tick === value.tick) frames[frames.length - 1] = value;
  else frames.push(value);
}
function active(state: ChampionState) {
  const r = state.leonaRVisuals.at(-1);
  if (!r || r.endTick !== null || r.startTick !== state.leonaR?.startTick)
    throw Error('Solar Flare phase lacks its accepted history.');
  return r;
}
export function beginSolarVisual(world: World, source: Unit, state: ChampionState) {
  if (!state.leonaR) throw Error('Solar Flare history requires an accepted cast.');
  state.leonaRVisuals.push({
    startTick: world.tick,
    rank: state.leonaR.rank,
    radius: source.radius,
    point: { ...state.leonaR.point },
    castFrame: pointFrame(world, source),
    areaAudience: areaAudience(world, state.leonaR.point),
    release: null,
    endTick: null,
    endReason: null,
    death: null,
    impact: null,
    frames: [
      { ...poseFrame(world, source), areaAudience: areaAudience(world, state.leonaR.point) },
    ],
  });
}
export function releaseSolarVisual(world: World, source: Unit, state: ChampionState) {
  const r = active(state);
  r.release ??= pointFrame(world, source);
}
export function finishSolarVisual(
  state: ChampionState,
  tick: number,
  reason: NonNullable<SolarFlareVisual['endReason']>
) {
  if (!state.leonaR) return;
  const r = active(state);
  r.endTick = tick;
  r.endReason = reason;
}
/** Capture every participant before damage, death, retaliation or same-tick Flash. */
export function impactSolarVisual(
  world: World,
  state: ChampionState,
  victims: readonly { target: Unit; center: boolean }[]
) {
  const r = active(state);
  r.impact = {
    tick: world.tick,
    audience: areaAudience(world, r.point),
    contacts: victims.map(({ target, center }) => ({
      targetId: target.id,
      targetKind: target.kind,
      targetTeam: target.team,
      targetRig: impactTargetRig(target),
      radius: target.radius,
      center,
      point: { x: target.x, y: target.y },
      audience: audience(world, target),
      detachedTick: null,
      frames: [poseFrame(world, target)],
    })),
  };
  finishSolarVisual(state, world.tick, 'impact');
}
export function solarVisualExpiry(r: SolarFlareVisual) {
  return r.endTick === null ? Infinity : r.endTick + timing.bounds.history;
}
export function advanceSolarVisuals(world: World) {
  for (const source of world.units) {
    const state = world.championState(source.id);
    if (!state?.leonaRVisuals.length) continue;
    state.leonaRVisuals = state.leonaRVisuals.filter((r) => world.tick < solarVisualExpiry(r));
    for (const r of state.leonaRVisuals) {
      if (!r.death && !world.alive(source)) {
        r.death = {
          tick: world.tick,
          level: state.level,
          respawnTick: world.tick + championDeathTicks(state.level, world.tick),
          frame: poseFrame(world, source),
        };
      }
      if (r.death?.tick === world.tick) r.death.frame = poseFrame(world, source);
      const f = r.death
        ? { ...structuredClone(r.death.frame), tick: world.tick }
        : poseFrame(world, source);
      append(r.frames, { ...f, areaAudience: areaAudience(world, r.point) });
      r.frames = r.frames.filter((f) => f.tick > world.tick - timing.bounds.sourceWindow);
      if (!r.impact || world.tick >= r.impact.tick + timing.bounds.contact) continue;
      for (const c of r.impact.contacts) {
        const target = world.unit(c.targetId),
          last = c.frames.at(-1)!;
        const f =
          (c.detachedTick === null || c.detachedTick === world.tick) && target
            ? poseFrame(world, target)
            : { ...structuredClone(last), tick: world.tick };
        if (c.detachedTick === null && (!target || !world.alive(target)))
          c.detachedTick = world.tick;
        append(c.frames, f);
      }
    }
  }
}
