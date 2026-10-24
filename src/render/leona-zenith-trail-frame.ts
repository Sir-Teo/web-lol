import { zenithPoseAt, type ZenithDrawGroup } from './leona-zenith-history';
import type { ZenithTrailPoint } from './leona-zenith-trails';
import type { Vec2 } from '../simulation/math';

/** Adapter only: prepared points retain their frozen upright kernel convention.
 * These two bind-zero, local, world-acceleration-free trails adopt the same
 * source-Y-forward missile frame as E's weapon surfaces. Rotate about each
 * saved birth origin, never about the current missile or a live caster. */
export function zenithMissileTrailPoints(
  group: ZenithDrawGroup,
  points: readonly ZenithTrailPoint[],
  ground: (point: Vec2) => number
): ZenithTrailPoint[] {
  return points.map((p) => {
    const born = zenithPoseAt(group.frames, p.bornTick)!;
    const c = Math.cos(born.facing),
      s = Math.sin(born.facing),
      height = ground(born);
    const turn = ([x, y, z]: readonly number[]): [number, number, number] => {
      const localX = c * x - s * z,
        localZ = s * x + c * z;
      // yaw * Rx(pi/2) * inverse(yaw)
      return [c * localX + s * y, -localZ, -s * localX + c * y];
    };
    const delta = turn([p.position[0] - born.x, p.position[1] - height, p.position[2] - born.y]);
    return {
      ...p,
      position: [born.x + delta[0], height + delta[1], born.y + delta[2]],
      side: turn(p.side),
    };
  });
}
