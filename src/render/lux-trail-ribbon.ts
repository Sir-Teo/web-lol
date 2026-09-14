import { LUX_BASIC_TRAIL as trail } from '../content/lux-basic-trail';
import type { LuxTrailPoint } from './lux-trail-particles';

export interface LuxRibbonVertex {
  position: readonly [number, number, number];
  uv: readonly [number, number];
  multUv: readonly [number, number];
  color: readonly number[];
}
/** Source units, newest-first arbitrary trail, no smoothing authored. Visibility
 * removes whole adjacent segments; it never joins across a hidden point.
 */
export function luxTrailRibbon(
  points: readonly LuxTrailPoint[],
  visible: (point: LuxTrailPoint) => boolean = () => true
): LuxRibbonVertex[] {
  if (points.length < 2) return [];
  const vertices: LuxRibbonVertex[] = [];
  const baseU = points[0].wakeU - (points[0].wakeU % 2);
  const pair = (p: LuxTrailPoint): [LuxRibbonVertex, LuxRibbonVertex] => {
    const dx = Math.cos(p.facing) * p.halfWidth;
    const dz = -Math.sin(p.facing) * p.halfWidth;
    const u = p.wakeU - baseU;
    const corner = (side: number): LuxRibbonVertex => {
      const v = side === 1 ? 0 : 1;
      return {
        position: [p.position[0] + side * dx, p.position[1], p.position[2] + side * dz],
        uv: [u, v],
        multUv: [u + p.multScroll[0], v + p.multScroll[1]],
        color: p.color,
      };
    };
    return [corner(1), corner(-1)];
  };
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    walked += Math.hypot(...a.position.map((v, axis) => v - b.position[axis]));
    // The source excludes the first point at or beyond cutoff, with no invented cap.
    if (walked >= trail.cutoff) break;
    if (!visible(a) || !visible(b)) continue;
    const [a0, a1] = pair(a),
      [b0, b1] = pair(b);
    vertices.push(a0, a1, b0, b0, a1, b1);
  }
  return vertices;
}
