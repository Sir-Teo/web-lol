import type { SourceUvDraw } from './source-uv-layer';
export interface PackedTrailPoint {
  profileIndex: number;
  position: ArrayLike<number>;
  side: ArrayLike<number>;
  halfWidth: number;
  tiling: ArrayLike<number>;
  odometer: number;
  uv: SourceUvDraw;
  multUv: SourceUvDraw | null;
  color: ArrayLike<number>;
  lookup: ArrayLike<number>;
  erosion: number;
  visible: boolean;
}
export interface PackedTrailVertex {
  position: Float32Array;
  uv: Float32Array;
  cell: Float32Array;
  multUv: Float32Array | null;
  multCell: Float32Array | null;
  color: Float32Array;
  lookup: Float32Array;
  erosion: number;
}
const f32 = Math.fround;
const unit = (v: Float32Array) => {
  const length = Math.hypot(v[0], v[1], v[2]);
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
const transform = (uv: SourceUvDraw, u: number, v: number) => {
  const turn = f32(uv.turn),
    c = Math.cos(turn),
    s = Math.sin(turn);
  const x = (u - 0.5) * f32(uv.scaleU),
    y = (v - 0.5) * f32(uv.scaleV);
  return new Float32Array([
    x * c - y * s + 0.5 + f32(uv.offsetU),
    x * s + y * c + 0.5 + f32(uv.offsetV),
  ]);
};
/** Oldest-first inputs. All three pinned external traversal modes, float32
 * intermediate writes and independent base/mult UVs. Visibility splits before
 * filtering. Source/world attachment and sampler policy belong to the caller;
 * centred, unflipped layers and WAKE are explicit limits of this adapter. */
export function packedSourceTrailRibbon(
  points: readonly PackedTrailPoint[],
  cutoff: number,
  view: ArrayLike<number> | null,
  smoothing: 0 | 1 | 2,
  reach = 3
): PackedTrailVertex[] {
  const vector = (v: ArrayLike<number>, n: number) =>
    v.length === n && Array.from(v).every((x) => Number.isFinite(x) && Number.isFinite(f32(x)));
  if (
    !Number.isFinite(cutoff) ||
    cutoff < 0 ||
    ![0, 1, 2].includes(smoothing) ||
    !Number.isInteger(reach) ||
    reach < 0 ||
    reach > 3 ||
    (view && (!vector(view, 3) || Math.hypot(...Array.from(view)) === 0))
  )
    throw RangeError('Invalid packed trail policy');
  for (const p of points) {
    if (
      !vector(p.position, 3) ||
      !vector(p.side, 3) ||
      !vector(p.tiling, 2) ||
      !vector(p.color, 4) ||
      !vector(p.lookup, 2) ||
      ![
        p.halfWidth,
        p.odometer,
        p.erosion,
        ...Object.values(p.uv),
        ...Object.values(p.multUv ?? {}),
      ].every((v) => Number.isFinite(v) && Number.isFinite(f32(v))) ||
      p.profileIndex !== points[0].profileIndex
    )
      throw RangeError('Invalid packed trail point');
  }
  const result: PackedTrailVertex[] = [],
    runs: PackedTrailPoint[][] = [];
  let run: PackedTrailPoint[] = [];
  for (const p of points) {
    if (p.visible) run.push(p);
    else {
      if (run.length > 1) runs.push(run);
      run = [];
    }
  }
  if (run.length > 1) runs.push(run);
  for (const held of runs) {
    const positions = held.map((p) => Float32Array.from(p.position));
    const placed = (at: number, filter: boolean) => {
      if (!filter || !reach) return new Float32Array(positions[at]);
      const from = Math.max(0, at - reach),
        to = Math.min(held.length - 1, at + reach);
      const value = new Float32Array(3);
      for (let i = from; i <= to; i++)
        for (let axis = 0; axis < 3; axis++) value[axis] += positions[i][axis];
      for (let axis = 0; axis < 3; axis++) value[axis] /= to - from + 1;
      return value;
    };
    const step = smoothing === 2 ? 1 : -1,
      start = smoothing === 2 ? 0 : held.length - 1;
    let last: Float32Array | null = null,
      lastSide: Float32Array | null = null;
    let walked = 0,
      base = 0,
      previous: PackedTrailVertex[] | null = null;
    for (let seen = 0; seen < held.length; seen++) {
      const at = start + seen * step,
        p = held[at];
      const center = placed(at, smoothing !== 0 && seen !== 0 && at !== 0);
      if (last) {
        walked += Math.hypot(...Array.from(center, (v, a) => v - last![a]));
        if (cutoff > 0 && cutoff <= walked) break;
      }
      const next = last ?? placed(at + step, false);
      const tangent = Float32Array.from(center, (v, a) => (last ? v - next[a] : next[a] - v));
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
      const rawSide = new Float32Array(side);
      if (smoothing !== 0 && lastSide) {
        for (let a = 0; a < 3; a++) side[a] += lastSide[a];
        if (!unit(side)) side.set(rawSide);
      }
      const width = f32(p.halfWidth),
        tilingU = f32(p.tiling[0]),
        tilingV = f32(p.tiling[1]);
      let u = tilingU > 0 ? f32(p.odometer) / tilingU : 0;
      if (!seen) base = u - (u % 2);
      u -= base;
      const span = tilingV > 0 ? width / tilingV : tilingV === 0 ? 1 : -tilingV;
      const pair = [1, -1].map((sign): PackedTrailVertex => {
        const v = 0.5 - (sign * span) / 2;
        return {
          position: Float32Array.from(center, (value, a) => value + side[a] * width * sign),
          uv: transform(p.uv, u, v),
          cell: new Float32Array([p.uv.cellU, p.uv.cellV]),
          multUv: p.multUv ? transform(p.multUv, u, v) : null,
          multCell: p.multUv ? new Float32Array([p.multUv.cellU, p.multUv.cellV]) : null,
          color: Float32Array.from(p.color),
          lookup: Float32Array.from(p.lookup),
          erosion: f32(p.erosion),
        };
      });
      if (previous) result.push(pair[0], previous[0], previous[1], pair[0], previous[1], pair[1]);
      previous = pair;
      last = center;
      lastSide = rawSide;
    }
  }
  return result;
}
