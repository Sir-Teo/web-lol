import { clamp, distance, lerp, type Vec2 } from './math';
import type { Team } from './types';
import type { TerrainQueries } from './battlefield';

export interface NavGridMetadata {
  width: number;
  height: number;
  cellSize: number;
  minimum: number[];
  heightWidth: number;
  heightHeight: number;
  heightSpacing: number[];
  sections: { flags: number[]; heights: number[] };
}

const BRUSH = 1,
  WALL = 2,
  STRUCTURE = 4,
  TRANSPARENT = 64;
const BLUE_GATE = 1024,
  RED_GATE = 2048,
  NEUTRAL_VISION = 4096;
const HALF = 7425;

/** Source X/Z to centered simulation X/Y. Heights remain in source game units. */
export const fromRiot = (x: number, z: number): Vec2 => ({ x: x - HALF, y: HALF - z });
export const toRiot = (point: Vec2): Vec2 => ({ x: point.x + HALF, y: HALF - point.y });

class Heap {
  private entries: { index: number; score: number; cost: number }[] = [];
  get length(): number {
    return this.entries.length;
  }
  push(entry: { index: number; score: number; cost: number }): void {
    let i = this.entries.length;
    this.entries.push(entry);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(entry, this.entries[parent])) break;
      this.entries[i] = this.entries[parent];
      i = parent;
    }
    this.entries[i] = entry;
  }
  pop(): { index: number; score: number; cost: number } {
    const first = this.entries[0],
      last = this.entries.pop()!;
    if (!this.entries.length) return first;
    let i = 0;
    while (i * 2 + 1 < this.entries.length) {
      let child = i * 2 + 1;
      if (
        child + 1 < this.entries.length &&
        this.before(this.entries[child + 1], this.entries[child])
      )
        child++;
      if (!this.before(this.entries[child], last)) break;
      this.entries[i] = this.entries[child];
      i = child;
    }
    this.entries[i] = last;
    return first;
  }
  private before(
    a: { index: number; score: number },
    b: { index: number; score: number }
  ): boolean {
    return a.score < b.score || (a.score === b.score && a.index < b.index);
  }
}

/** Exact squared distance between a segment and an axis-aligned cell rectangle. */
function segmentBoxDistance(a: Vec2, b: Vec2, x: number, y: number, size: number): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  let lo = 0,
    hi = 1;
  for (const [origin, delta, min, max] of [
    [a.x, dx, x, x + size],
    [a.y, dy, y, y + size],
  ]) {
    if (delta === 0) {
      if (origin < min || origin > max) {
        lo = 2;
        break;
      }
    } else {
      const t1 = (min - origin) / delta,
        t2 = (max - origin) / delta;
      lo = Math.max(lo, Math.min(t1, t2));
      hi = Math.min(hi, Math.max(t1, t2));
    }
  }
  if (lo <= hi) return 0;
  const pointBox = (p: Vec2) =>
    (p.x - clamp(p.x, x, x + size)) ** 2 + (p.y - clamp(p.y, y, y + size)) ** 2;
  let best = Math.min(pointBox(a), pointBox(b));
  const length = dx * dx + dy * dy;
  for (const [cx, cy] of [
    [x, y],
    [x + size, y],
    [x, y + size],
    [x + size, y + size],
  ]) {
    const t = length ? clamp(((cx - a.x) * dx + (cy - a.y) * dy) / length, 0, 1) : 0;
    best = Math.min(best, (cx - a.x - dx * t) ** 2 + (cy - a.y - dy * t) ** 2);
  }
  return best;
}

export class NavGrid implements TerrainQueries {
  readonly flags: Uint16Array;
  private heights: Float32Array;
  private brush: Int32Array;
  private gates: Int32Array;
  private passability = new Map<string, Uint8Array>();
  private costs: Float64Array;
  private parents: Int32Array;
  private stamps: Uint32Array;
  private generation = 0;

  constructor(
    readonly metadata: NavGridMetadata,
    bytes: ArrayBuffer
  ) {
    const m = metadata,
      count = m.width * m.height,
      view = new DataView(bytes);
    if (
      !Number.isInteger(count) ||
      count <= 0 ||
      count > 4_000_000 ||
      m.cellSize <= 0 ||
      m.heightSpacing.some((x) => !Number.isFinite(x) || x <= 0)
    )
      throw new Error('Invalid navigation dimensions');
    this.flags = Uint16Array.from({ length: count }, (_, i) =>
      view.getUint16(m.sections.flags[0] + i * 2, true)
    );
    this.heights = Float32Array.from({ length: m.heightWidth * m.heightHeight }, (_, i) =>
      view.getFloat32(m.sections.heights[0] + i * 4, true)
    );
    if (this.heights.some((x) => !Number.isFinite(x)))
      throw new Error('Invalid navigation elevation');
    this.brush = this.components(BRUSH);
    this.gates = this.components(NEUTRAL_VISION);
    this.costs = new Float64Array(count);
    this.parents = new Int32Array(count);
    this.stamps = new Uint32Array(count);
  }
  private local(point: Vec2): Vec2 {
    const p = toRiot(point);
    return { x: p.x - this.metadata.minimum[0], y: p.y - this.metadata.minimum[2] };
  }
  private index(x: number, z: number): number {
    return x >= 0 && z >= 0 && x < this.metadata.width && z < this.metadata.height
      ? z * this.metadata.width + x
      : -1;
  }
  cell(point: Vec2): number {
    const p = this.local(point),
      size = this.metadata.cellSize;
    return this.index(Math.floor(p.x / size), Math.floor(p.y / size));
  }
  center(index: number): Vec2 {
    const m = this.metadata;
    return fromRiot(
      m.minimum[0] + ((index % m.width) + 0.5) * m.cellSize,
      m.minimum[2] + (Math.floor(index / m.width) + 0.5) * m.cellSize
    );
  }
  flagsAt(point: Vec2): number {
    const i = this.cell(point);
    return i < 0 ? WALL : this.flags[i];
  }
  heightAt(point: Vec2): number {
    const p = this.local(point),
      m = this.metadata;
    const x = clamp(p.x / m.heightSpacing[0], 0, m.heightWidth - 1),
      z = clamp(p.y / m.heightSpacing[1], 0, m.heightHeight - 1);
    const ix = Math.floor(x),
      iz = Math.floor(z),
      tx = x - ix,
      tz = z - iz;
    const at = (dx: number, dz: number) =>
      this.heights[
        Math.min(iz + dz, m.heightHeight - 1) * m.heightWidth + Math.min(ix + dx, m.heightWidth - 1)
      ];
    return lerp(lerp(at(0, 0), at(1, 0), tx), lerp(at(0, 1), at(1, 1), tx), tz);
  }
  private blocked(index: number, team: Team): boolean {
    if (index < 0) return true;
    const flags = this.flags[index];
    return !!(flags & (WALL | STRUCTURE)) || !!(flags & (team === 'blue' ? RED_GATE : BLUE_GATE));
  }
  private components(mask: number): Int32Array {
    const labels = new Int32Array(this.flags.length),
      queue = new Int32Array(this.flags.length);
    let next = 0;
    for (let start = 0; start < labels.length; start++) {
      if (labels[start] || !(this.flags[start] & mask)) continue;
      let read = 0,
        write = 1;
      queue[0] = start;
      labels[start] = ++next;
      while (read < write) {
        const i = queue[read++],
          x = i % this.metadata.width,
          z = Math.floor(i / this.metadata.width);
        for (const [dx, dz] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]) {
          const j = this.index(x + dx, z + dz);
          if (j >= 0 && !labels[j] && this.flags[j] & mask) {
            labels[j] = next;
            queue[write++] = j;
          }
        }
      }
    }
    return labels;
  }
  /** Supercover DDA includes both side cells when a ray crosses a grid corner. */
  private trace(a: Vec2, b: Vec2, visit: (x: number, z: number) => boolean): boolean {
    const s = this.metadata.cellSize,
      dx = b.x - a.x,
      dz = b.y - a.y;
    let x = Math.floor(a.x / s),
      z = Math.floor(a.y / s);
    const ex = Math.floor(b.x / s),
      ez = Math.floor(b.y / s),
      sx = Math.sign(dx),
      sz = Math.sign(dz);
    const stepX = dx ? s / Math.abs(dx) : Infinity,
      stepZ = dz ? s / Math.abs(dz) : Infinity;
    let tx = dx ? ((x + (sx > 0 ? 1 : 0)) * s - a.x) / dx : Infinity;
    let tz = dz ? ((z + (sz > 0 ? 1 : 0)) * s - a.y) / dz : Infinity;
    for (
      let n = 0;
      n <= Math.abs(ex - Math.floor(a.x / s)) + Math.abs(ez - Math.floor(a.y / s)) + 2;
      n++
    ) {
      if (!visit(x, z)) return false;
      if (x === ex && z === ez) return true;
      if (Math.abs(tx - tz) < 1e-12) {
        if (!visit(x + sx, z) || !visit(x, z + sz)) return false;
        x += sx;
        z += sz;
        tx += stepX;
        tz += stepZ;
      } else if (tx < tz) {
        x += sx;
        tx += stepX;
      } else {
        z += sz;
        tz += stepZ;
      }
    }
    return false;
  }
  walkable(point: Vec2, radius: number, team: Team = 'blue'): boolean {
    return this.lineWalkable(point, point, radius, team);
  }
  lineWalkable(from: Vec2, to: Vec2, radius: number, team: Team = 'blue'): boolean {
    if (![from.x, from.y, to.x, to.y, radius].every(Number.isFinite) || radius < 0) return false;
    const a = this.local(from),
      b = this.local(to),
      size = this.metadata.cellSize;
    if (
      [a, b].some(
        (p) =>
          p.x < radius ||
          p.y < radius ||
          p.x > this.metadata.width * size - radius ||
          p.y > this.metadata.height * size - radius
      )
    )
      return false;
    const pad = Math.ceil(radius / size),
      threshold = radius * radius;
    return this.trace(a, b, (x, z) => {
      for (let dz = -pad; dz <= pad; dz++)
        for (let dx = -pad; dx <= pad; dx++) {
          if (
            this.blocked(this.index(x + dx, z + dz), team) &&
            segmentBoxDistance(a, b, (x + dx) * size, (z + dz) * size, size) <= threshold
          )
            return false;
        }
      return true;
    });
  }
  lineOfSight(from: Vec2, to: Vec2): boolean {
    if (![from.x, from.y, to.x, to.y].every(Number.isFinite)) return false;
    const start = this.cell(from),
      end = this.cell(to);
    if (start < 0 || end < 0) return false;
    const brush = this.brush[start],
      sourceGate = this.gates[start],
      targetGate = this.gates[end];
    return this.trace(this.local(from), this.local(to), (x, z) => {
      const i = this.index(x, z);
      if (i < 0) return false;
      if (this.flags[i] & WALL && !(this.flags[i] & TRANSPARENT) && i !== end) return false;
      if (this.brush[i] && this.brush[i] !== brush) return false;
      if (this.gates[i] && this.gates[i] !== sourceGate && this.gates[i] !== targetGate)
        return false;
      return true;
    });
  }
  private passable(radius: number, team: Team): Uint8Array {
    const key = `${radius}:${team}`;
    let result = this.passability.get(key);
    if (!result) {
      result = Uint8Array.from(this.flags, (_, i) =>
        Number(!this.blocked(i, team) && this.walkable(this.center(i), radius, team))
      );
      this.passability.set(key, result);
    }
    return result;
  }
  reachable(point: Vec2, radius: number, team: Team = 'blue'): Vec2 {
    if (this.walkable(point, radius, team)) return { ...point };
    if (![point.x, point.y, radius].every(Number.isFinite) || radius < 0)
      throw new Error('Invalid navigation request');
    const passable = this.passable(radius, team);
    let best = -1,
      score = Infinity;
    for (let i = 0; i < passable.length; i++)
      if (passable[i]) {
        const p = this.center(i),
          d = (p.x - point.x) ** 2 + (p.y - point.y) ** 2;
        if (d < score) {
          best = i;
          score = d;
        }
      }
    if (best < 0) throw new Error('No walkable navigation cells');
    return this.center(best);
  }
  findPath(from: Vec2, requested: Vec2, radius: number, team: Team = 'blue'): Vec2[] {
    const start = this.reachable(from, radius, team),
      end = this.reachable(requested, radius, team);
    if (this.lineWalkable(start, end, radius, team)) return [end];
    const passable = this.passable(radius, team),
      ei = this.cell(end),
      width = this.metadata.width;
    let si = this.cell(start);
    // Connect arbitrary endpoints to the grid without jumping through a wall.
    if (!passable[si] || !this.lineWalkable(start, this.center(si), radius, team)) {
      const origin = si,
        ox = origin % width,
        oz = Math.floor(origin / width);
      let score = Infinity;
      si = -1;
      for (let dz = -4; dz <= 4; dz++)
        for (let dx = -4; dx <= 4; dx++) {
          const i = this.index(ox + dx, oz + dz);
          if (i < 0 || !passable[i]) continue;
          const p = this.center(i),
            d = distance(start, p);
          if (d < score && this.lineWalkable(start, p, radius, team)) {
            si = i;
            score = d;
          }
        }
      if (si < 0) return [];
    }
    if (++this.generation === 0xffffffff) {
      this.stamps.fill(0);
      this.generation = 1;
    }
    const stamp = this.generation,
      open = new Heap();
    this.costs[si] = 0;
    this.stamps[si] = stamp;
    this.parents[si] = -1;
    open.push({ index: si, score: distance(start, end), cost: 0 });
    let best = si,
      nearest = distance(start, end),
      arrived = false;
    while (open.length) {
      const current = open.pop(),
        i = current.index;
      if (current.cost !== this.costs[i]) continue;
      const point = this.center(i),
        remaining = distance(point, end);
      if (remaining < nearest) {
        best = i;
        nearest = remaining;
      }
      if (
        (i === ei || remaining < this.metadata.cellSize * 2) &&
        this.lineWalkable(point, end, radius, team)
      ) {
        best = i;
        arrived = true;
        break;
      }
      const x = i % width,
        z = Math.floor(i / width);
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const next = this.index(x + dx, z + dz);
          if (
            next < 0 ||
            !passable[next] ||
            (dx && dz && (!passable[this.index(x + dx, z)] || !passable[this.index(x, z + dz)]))
          )
            continue;
          const cost = current.cost + this.metadata.cellSize * (dx && dz ? Math.SQRT2 : 1);
          if (this.stamps[next] === stamp && cost >= this.costs[next]) continue;
          const nextPoint = this.center(next);
          if (!this.lineWalkable(point, nextPoint, radius, team)) continue;
          this.costs[next] = cost;
          this.stamps[next] = stamp;
          this.parents[next] = i;
          open.push({ index: next, score: cost + distance(nextPoint, end), cost });
        }
    }
    const raw: Vec2[] = [];
    for (let i = best; i !== -1; i = this.parents[i]) raw.push(this.center(i));
    raw.reverse();
    if (arrived) raw.push(end);
    // Greedy visibility smoothing preserves continuous radius clearance.
    const result: Vec2[] = [];
    let anchor = start,
      index = 0;
    while (index < raw.length) {
      let last = index;
      while (last + 1 < raw.length && this.lineWalkable(anchor, raw[last + 1], radius, team))
        last++;
      if (distance(anchor, raw[last]) > 0.01) result.push(raw[last]);
      anchor = raw[last];
      index = last + 1;
    }
    return result;
  }
}
