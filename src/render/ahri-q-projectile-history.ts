import type { AhriQProjectileVisual } from '../simulation/ahri-q-projectile-visuals';
import type { Team } from '../simulation/types';
import type { SurfaceGroup } from './source-particle-surfaces';
import type { AhriQProjectileRole } from './ahri-q-projectile-particles';

export interface QProjectileGroup extends SurfaceGroup {
  role: AhriQProjectileRole;
  record: AhriQProjectileVisual;
}
/** Explicit local phase dispatch from the saved actual launch and turn.
 * Native spell aliases bind these systems but do not supply script chronology. */
export function qProjectileGroups(record: AhriQProjectileVisual): QProjectileGroup[] {
  const seed = record.id ^ Math.imul(record.launchTick, 0x9e3779b9);
  const shared = { radius: 1, record };
  const groups: QProjectileGroup[] = [
    {
      ...shared,
      key: record.id + ':missile',
      role: 'missile',
      seed,
      startTick: record.launchTick,
      stopTick: record.turn?.tick ?? record.end?.tick ?? Infinity,
    },
  ];
  if (record.turn)
    groups.push({
      ...shared,
      key: record.id + ':return',
      role: 'return',
      seed: seed ^ 0x85ebca6b,
      startTick: record.turn.tick,
      stopTick: record.end?.tick ?? Infinity,
    });
  return groups;
}
/** Endpoint lookup includes the distinct pre-movement launch anchor. Frames
 * store mathematical XY heading; scene yaw is its complementary angle. */
function endpoint(r: AhriQProjectileVisual, tick: number) {
  const index = Math.max(-1, Math.min(r.frames.length - 1, tick - r.launchTick));
  if (index < 0)
    return {
      ...r.origin,
      tick: r.launchTick - 1,
      facing: Math.atan2(r.direction.y || 0, r.direction.x || 0),
      audience: r.birthAudience,
    };
  return r.frames[index];
}
export function qProjectilePose(r: AhriQProjectileVisual, tick: number) {
  if (!Number.isFinite(tick)) return null;
  const at = Math.max(r.launchTick - 1, Math.min(r.frames.at(-1)?.tick ?? r.launchTick - 1, tick));
  const a = endpoint(r, Math.floor(at)),
    b = endpoint(r, Math.ceil(at)),
    alpha = at - Math.floor(at);
  const turn = Math.atan2(Math.sin(b.facing - a.facing), Math.cos(b.facing - a.facing));
  return {
    x: a.x + (b.x - a.x) * alpha,
    y: a.y + (b.y - a.y) * alpha,
    facing: Math.PI / 2 - (a.facing + turn * alpha),
  };
}
/** Bound particles may enter sight with their current root. Unbound births and
 * ribbons use both neighbouring saved samples, preventing hidden-path joins. */
export function qProjectileKnown(r: AhriQProjectileVisual, tick: number, team: Team = 'blue') {
  if (!Number.isFinite(tick)) return false;
  if (team === r.team) return true;
  return [Math.floor(tick), Math.ceil(tick)].every((at) => endpoint(r, at).audience.includes(team));
}
/** Monotonic birth-path distance, independent of shrinking particle lists. */
export class QProjectilePath {
  private readonly distances: number[] = [0];
  private readonly points: { x: number; y: number }[];
  constructor(private record: AhriQProjectileVisual) {
    this.points = [{ ...record.origin }];
  }
  distance(tick: number) {
    if (!Number.isFinite(tick)) return 0;
    const r = this.record;
    while (this.distances.length <= r.frames.length) {
      const i = this.distances.length - 1,
        previous = this.points[i],
        frame = r.frames[i];
      this.distances.push(
        this.distances[i] + Math.hypot(frame.x - previous.x, frame.y - previous.y)
      );
      this.points.push({ x: frame.x, y: frame.y });
    }
    const at = Math.max(0, Math.min(this.distances.length - 1, tick - (r.launchTick - 1)));
    const from = Math.floor(at),
      to = Math.ceil(at);
    return this.distances[from] + (this.distances[to] - this.distances[from]) * (at - from);
  }
}
