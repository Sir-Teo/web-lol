import type { ImpactRig } from '../content/impact-target';
import { impactTargetRig } from '../content/impact-target';
import {
  BARON_ATTACK_FLIGHT_TAIL_TICKS,
  BARON_ATTACK_HIT_HISTORY_TICKS,
  BARON_ATTACK_PATH_FRAMES,
} from '../content/baron-attack-presentation';
import type { LuxImpactFrame, Projectile, Team, Unit } from './types';
import type { Vec2 } from './math';
import type { World } from './world';
import { capturePoseFrame } from './pose-history';

export interface BaronFlightFrame {
  tick: number;
  x: number;
  y: number;
  facing: number;
  distance: number;
  audience: Team[];
}
export interface BaronAttackContact {
  startTick: number;
  point: Vec2;
  targetTeam: Team;
  targetRadius: number;
  targetRig: ImpactRig | null;
  detachedTick: number | null;
  frames: (LuxImpactFrame & { audience: Team[] })[];
}
/** Owns no gameplay IDs or RNG. Contact shares the released projectile identity. */
export interface BaronAttackVisual {
  id: number;
  sourceId: number;
  targetId: number;
  team: 'neutral';
  origin: Vec2;
  launchTick: number;
  stopTick: number | null;
  stopReason: 'hit' | 'target-lost' | 'range' | 'match-end' | null;
  frames: BaronFlightFrame[];
  impact: BaronAttackContact | null;
}
const teams = ['blue', 'red'] as const;
const flightAudience = (world: World, point: Vec2) =>
  teams.filter((team) => world.pointVisible(point, team));
const impactFrame = (world: World, target: Unit) => ({
  ...capturePoseFrame(target, world.tick),
  audience: teams.filter((team) => world.visible(target, team)),
});

export function startBaronAttackVisual(
  world: World,
  source: Unit,
  target: Unit,
  projectile: Projectile
) {
  if (
    source.monster?.species !== 'baron' ||
    projectile.type !== 'attack' ||
    projectile.source !== source.id ||
    projectile.target !== target.id ||
    projectile.launchTick !== world.tick ||
    !projectile.origin ||
    world.baronAttackVisuals.some((visual) => visual.id === projectile.id)
  )
    throw Error('Baron visual lacks its released attack');
  world.baronAttackVisuals.push({
    id: projectile.id,
    sourceId: source.id,
    targetId: target.id,
    team: 'neutral',
    origin: { ...projectile.origin },
    launchTick: world.tick,
    stopTick: null,
    stopReason: null,
    frames: [
      {
        tick: world.tick,
        x: projectile.x,
        y: projectile.y,
        facing: Math.atan2(projectile.direction.x, projectile.direction.y),
        distance: 0,
        // The finalizer captures the post-step audience; do not query vision
        // while the unit-advancement loop is still releasing attacks.
        audience: [],
      },
    ],
    impact: null,
  });
}

export function contactBaronAttackVisual(
  world: World,
  projectile: Projectile,
  target: Unit,
  point: Vec2
) {
  const visual = world.baronAttackVisuals.find((visual) => visual.id === projectile.id);
  if (
    !visual ||
    visual.impact ||
    visual.stopTick !== null ||
    target.team === 'neutral' ||
    target.id !== visual.targetId
  )
    throw Error('Baron contact lacks its released flight');
  visual.impact = {
    startTick: world.tick,
    point: { ...point },
    targetTeam: target.team,
    targetRadius: target.radius,
    targetRig: impactTargetRig(target),
    detachedTick: null,
    frames: [impactFrame(world, target)],
  };
}

export function baronAttackExpiry(visual: BaronAttackVisual): number {
  return visual.stopTick === null
    ? Infinity
    : Math.max(
        visual.stopTick + BARON_ATTACK_FLIGHT_TAIL_TICKS,
        visual.impact ? visual.impact.startTick + BARON_ATTACK_HIT_HISTORY_TICKS : 0
      );
}
export function pruneBaronAttackVisuals(world: World) {
  if (world.baronAttackVisuals.length)
    world.baronAttackVisuals = world.baronAttackVisuals.filter(
      (visual) => world.tick < baronAttackExpiry(visual)
    );
}

/** Post-step endpoints and an absolute odometer survive prefix retirement.
 * Stopped roots keep their fixed pose while capturing subsequent visibility. */
export function advanceBaronAttackVisuals(
  world: World,
  frames: ReadonlyMap<number, { tick: number; x: number; y: number; facing: number }>
) {
  if (!world.baronAttackVisuals.length) return;
  const surviving = new Set(world.projectiles.map((projectile) => projectile.id));
  for (const visual of world.baronAttackVisuals) {
    const previous = visual.frames.at(-1)!;
    const frame =
      visual.stopTick === null
        ? (frames.get(visual.id) ?? { ...previous, tick: world.tick })
        : { ...previous, tick: world.tick };
    const before = previous.tick === world.tick ? visual.frames.at(-2) : previous;
    const base = before ?? { ...visual.origin, distance: 0 };
    const recorded = {
      ...frame,
      distance: base.distance + Math.hypot(frame.x - base.x, frame.y - base.y),
      audience: flightAudience(world, frame),
    };
    if (previous.tick === world.tick) visual.frames[visual.frames.length - 1] = recorded;
    else visual.frames.push(recorded);
    if (visual.frames.length > BARON_ATTACK_PATH_FRAMES) visual.frames.shift();
    if (visual.stopTick === null && !surviving.has(visual.id)) {
      const target = world.unit(visual.targetId);
      visual.stopTick = world.tick;
      visual.stopReason = visual.impact
        ? 'hit'
        : world.winner
          ? 'match-end'
          : !target || !world.targetable(target)
            ? 'target-lost'
            : 'range';
    }
  }
}

/** Follow the accepted target's finalized pose; death/removal detaches once. */
export function advanceBaronAttackContacts(world: World) {
  for (const visual of world.baronAttackVisuals) {
    const impact = visual.impact;
    if (!impact) continue;
    const previous = impact.frames.at(-1)!,
      target = world.unit(visual.targetId);
    const frame =
      impact.detachedTick === null && target
        ? impactFrame(world, target)
        : { ...structuredClone(previous), tick: world.tick };
    if (impact.detachedTick === null && (!target || !world.alive(target)))
      impact.detachedTick = world.tick;
    if (previous.tick === world.tick) impact.frames[impact.frames.length - 1] = frame;
    else impact.frames.push(frame);
  }
}
