import type { SourceUvDraw } from './source-uv-layer';
export interface BaronRibbonPoint {
  position: ArrayLike<number>;
  side: ArrayLike<number>;
  halfWidth: number;
  tiling: ArrayLike<number>;
  odometer: number;
  uv: SourceUvDraw;
}
/** Current Baron closure: oldest-first inputs, WAKE mode, smoothing OFF,
 * unflipped UVs centred at .5. Outputs remain in source units, without reflection.
 * Visibility splits belong to the owner; never join independently visible runs. */
export function baronRibbon<T extends BaronRibbonPoint>(
  points: readonly T[],
  cutoff: number,
  view: ArrayLike<number> | null
) {
  if (!Number.isFinite(cutoff) || cutoff < 0) throw RangeError('Invalid Baron ribbon cutoff');
  for (const p of points)
    if (
      [p.position, p.side].some((v) => v.length !== 3 || !Array.from(v).every(Number.isFinite)) ||
      p.tiling.length !== 2 ||
      !Array.from(p.tiling).every(Number.isFinite) ||
      ![p.halfWidth, p.odometer, ...Object.values(p.uv)].every(Number.isFinite)
    )
      throw RangeError('Invalid Baron ribbon point');
  if (
    view &&
    (view.length !== 3 ||
      !Array.from(view).every(Number.isFinite) ||
      Math.hypot(...Array.from(view)) === 0)
  )
    throw RangeError('Invalid Baron ribbon view');
  const result: { position: Float32Array; uv: Float32Array; point: T }[] = [];
  if (points.length < 2) return result;
  const unit = (v: Float32Array) => {
    const length = Math.hypot(...v);
    if (!length) return false;
    for (let a = 0; a < 3; a++) v[a] /= length;
    return true;
  };
  const cross = (a: ArrayLike<number>, b: ArrayLike<number>) =>
    new Float32Array([
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ]);
  let walked = 0,
    base = 0,
    last: Float32Array | undefined,
    lastSide: Float32Array | undefined;
  const pairs: (typeof result)[] = [];
  for (let at = points.length - 1; at >= 0; at--) {
    const p = points[at],
      position = Float32Array.from(p.position),
      first = !last;
    if (last) {
      walked += Math.hypot(...Array.from(position, (v, a) => v - last![a]));
      if (cutoff > 0 && cutoff <= walked) break;
    }
    const next = first ? Float32Array.from(points[at - 1].position) : last!;
    const tangent = Float32Array.from(position, (v, a) => (first ? next[a] - v : v - next[a]));
    unit(tangent);
    let side = Float32Array.from(p.side);
    if (view) {
      side = cross(view, tangent);
      if (!unit(side)) {
        if (lastSide) side.set(lastSide);
        else {
          const abs = Array.from(view, Math.abs),
            axis = new Float32Array(3);
          axis[abs[0] <= abs[1] && abs[0] <= abs[2] ? 0 : abs[1] <= abs[2] ? 1 : 2] = 1;
          side = cross(view, axis);
          if (!unit(side)) side.set(axis);
        }
      }
    }
    let u = p.tiling[0] > 0 ? p.odometer / p.tiling[0] : 0;
    if (first) base = u - (u % 2);
    u -= base;
    const span = p.tiling[1] > 0 ? p.halfWidth / p.tiling[1] : p.tiling[1] === 0 ? 1 : -p.tiling[1];
    const transform = Float32Array.from([
      p.uv.turn,
      p.uv.scaleU,
      p.uv.scaleV,
      p.uv.offsetU,
      p.uv.offsetV,
    ]);
    const pair = [1, -1].map((sign) => {
      const v = 0.5 - (sign * span) / 2,
        pu = (u - 0.5) * transform[1],
        pv = (v - 0.5) * transform[2],
        c = Math.cos(transform[0]),
        s = Math.sin(transform[0]);
      return {
        position: Float32Array.from(position, (value, a) => value + side[a] * p.halfWidth * sign),
        uv: new Float32Array([
          pu * c - pv * s + 0.5 + transform[3],
          pu * s + pv * c + 0.5 + transform[4],
        ]),
        point: p,
      };
    });
    if (pairs.length) {
      const [a, b] = pairs.at(-1)!,
        [c, d] = pair;
      result.push(c, a, b, c, b, d);
    }
    pairs.push(pair);
    last = position;
    lastSide = side;
  }
  return result;
}
