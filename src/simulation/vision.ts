import { BRUSH, OBSTACLES } from '../content/map';
import { distance, segmentDistance, type Vec2 } from './math';
import type { Team, Unit, ScoutFlight } from './types';

export interface VisionSource extends Vec2 {
  radius: number;
  /** Hawkshot reveals across terrain and brush; ordinary sight does not. */
  unobstructed?: boolean;
}

export interface VisionArea extends VisionSource {
  kind: 'attack' | 'scout';
  team: Team;
  endTick: number;
  flight?: ScoutFlight;
}

export function sightRadius(unit: Unit): number {
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
  return sources.some(
    (source) =>
      distance(source, point) <= source.radius && (source.unobstructed || sight(source, point))
  );
}
