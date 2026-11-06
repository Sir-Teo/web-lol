/** Source-space points ordered newest first, from one emitter profile. */
export interface SourceTrailPoint {
  profileIndex: number;
  position: [number, number, number];
  halfWidth: number;
  wakeU: number;
  uvOffset: number[];
  uvScale: number[];
  side: [number, number, number];
  lookup: [number, number];
  erosion: number;
  color: number[];
  visible: boolean;
}

export interface SourceRibbonVertex {
  position: [number, number, number];
  uv: [number, number];
  color: number[];
  lookup: [number, number];
  erosion: number;
}
/** Mode-1 external reconstruction: newest first, a quality-selected box filter,
 * and the bisector of current/previous raw local-X sides, with unchanged width.
 * Default reach 3 follows the pinned high-quality table; the project still uses
 * a local 60 Hz scheduler. This is not native target-patch/cadence certification.
 * Fog splits runs before smoothing, and never joins across hidden neighbours. */
export function sourceTrailRibbon<T extends SourceTrailPoint>(
  points: readonly T[],
  cutoff: number,
  visible: (point: T) => boolean = (p) => p.visible,
  reach = 3
): SourceRibbonVertex[] {
  if (
    !Number.isFinite(cutoff) ||
    cutoff < 0 ||
    points.length < 2 ||
    !Number.isInteger(reach) ||
    reach < 0 ||
    reach > 3
  )
    return [];
  if (points.some((p) => p.profileIndex !== points[0].profileIndex))
    throw Error('A source ribbon must contain exactly one source trail profile');
  const vertices: SourceRibbonVertex[] = [],
    runs: number[][] = [],
    placed = points.map((p) => [...p.position]);
  let run: number[] = [];
  const flush = () => {
    if (run.length > 1) runs.push(run);
    run = [];
  };
  for (let i = 0; i < points.length; i++) {
    if (!points[i].visible || !visible(points[i])) {
      flush();
      continue;
    }
    run.push(i);
  }
  flush();
  for (const run of runs)
    for (let i = 1; i < run.length - 1; i++) {
      const from = Math.max(0, i - reach),
        to = Math.min(run.length - 1, i + reach);
      placed[run[i]] = [0, 1, 2].map((axis) => {
        let sum = 0;
        for (let k = from; k <= to; k++) sum += points[run[k]].position[axis];
        return sum / (to - from + 1);
      });
    }
  let distance = 0,
    end = points.length;
  for (let i = 1; i < points.length; i++) {
    distance += Math.hypot(...placed[i].map((v, a) => v - placed[i - 1][a]));
    if (cutoff > 0 && distance >= cutoff) {
      end = i;
      break;
    }
  }
  const base = points[0].wakeU - (points[0].wakeU % 2);
  for (const run of runs) {
    let previousSide: number[] | null = null;
    const pairs = run
      .filter((i) => i < end)
      .map((i) => {
        const p = points[i],
          sum = p.side.map((v, a) => v + (previousSide?.[a] ?? 0)),
          length = Math.hypot(...sum),
          across = length > 1e-8 ? sum.map((v) => v / length) : p.side;
        previousSide = p.side;
        return [1, -1].map((sign): SourceRibbonVertex => ({
          position: placed[i].map((v, a) => v + sign * across[a] * p.halfWidth) as [
            number,
            number,
            number,
          ],
          uv: [
            (p.wakeU - base - 0.5) * p.uvScale[0] + 0.5 + p.uvOffset[0],
            ((sign === 1 ? 0 : 1) - 0.5) * p.uvScale[1] + 0.5 + p.uvOffset[1],
          ],
          color: [...p.color],
          lookup: [...p.lookup],
          erosion: p.erosion,
        }));
      });
    for (let i = 1; i < pairs.length; i++) {
      const [a, b] = pairs[i - 1],
        [c, d] = pairs[i];
      // Same corner order as the pinned writer, after the source/world reflection.
      vertices.push(c, a, b, c, b, d);
    }
  }
  return vertices;
}
