import { CONTROL_WARD_POLICY, FAELIGHT_POLICY, FARSIGHT_POLICY } from '../content/faelights';
import { BRUSH, OBSTACLES } from '../content/map';
import { distance, segmentDistance, type Vec2 } from './math';
import type { Faction, Unit, ScoutFlight } from './types';

export interface VisionSource extends Vec2 {
  radius: number;
  /** Hawkshot reveals across terrain and brush; ordinary sight does not. */
  unobstructed?: boolean;
}

export interface VisionArea extends VisionSource {
  sourceId?: number;
  kind: 'attack' | 'scout';
  team: Faction;
  endTick: number;
  flight?: ScoutFlight;
}

export function sightRadius(unit: Unit): number {
  if (unit.kind === 'ward') {
    const base =
      unit.ward?.variant === 'farsight'
        ? FARSIGHT_POLICY.sightRadius
        : unit.ward?.variant === 'control'
          ? CONTROL_WARD_POLICY.sightRadius
          : 900;
    return unit.ward?.faelightId ? Math.round(base * FAELIGHT_POLICY.sightMultiplier) : base;
  }
  return unit.kind === 'champion' ? 1300 : 1000;
}

/** Uses the same authored terrain as movement, without movement clearance padding. */
export function lineOfSight(from: Vec2, to: Vec2): boolean {
  if (OBSTACLES.some((wall) => segmentDistance(wall, from, to) < wall.radius)) return false;
  // A unit inside a brush can see out. A ray from outside stops at its near edge.
  return !BRUSH.some(
    (brush) =>
      distance(from, brush) > brush.radius && segmentDistance(brush, from, to) < brush.radius
  );
}

export function seenFrom(
  point: Vec2,
  sources: readonly VisionSource[],
  sight = lineOfSight
): boolean {
  return sources.some((source) => {
    const dx = source.x - point.x;
    if (Math.abs(dx) > source.radius) return false;
    const dy = source.y - point.y;
    if (Math.abs(dy) > source.radius) return false;
    // The box only rejects impossible candidates. Keep the exact inclusive
    // hypot test for the circle boundary rather than approximating with squares.
    return Math.hypot(dx, dy) <= source.radius && (source.unobstructed || sight(source, point));
  });
}
