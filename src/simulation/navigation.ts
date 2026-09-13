import { MAP_HALF, OBSTACLES } from '../content/map';
import { clamp, distance, segmentDistance, type Vec2 } from './math';

/** Visibility graph around padded obstacle rings. Pure, deterministic, and independent of meshes. */
export function reachable(p: Vec2, radius: number): Vec2 {
  const q = {
    x: clamp(p.x, -MAP_HALF + radius, MAP_HALF - radius),
    y: clamp(p.y, -MAP_HALF + radius, MAP_HALF - radius),
  };
  for (let pass = 0; pass < 4; pass++)
    for (const o of OBSTACLES) {
      const d = distance(q, o),
        r = o.radius + radius + 2;
      if (d < r) {
        q.x = o.x + (d ? (q.x - o.x) / d : 1) * r;
        q.y = o.y + (d ? (q.y - o.y) / d : 0) * r;
      }
    }
  return q;
}
export function lineWalkable(a: Vec2, b: Vec2, radius: number): boolean {
  return OBSTACLES.every((o) => segmentDistance(o, a, b) >= o.radius + radius);
}
export function findPath(start: Vec2, requested: Vec2, radius: number): Vec2[] {
  const end = reachable(requested, radius);
  if (lineWalkable(start, end, radius)) return [end];
  const nodes: Vec2[] = [start, end];
  for (const o of OBSTACLES)
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      // Circumscribed ring leaves straight edges outside the inflated circle.
      const r = (o.radius + radius + 5) / Math.cos(Math.PI / 12);
      const p = { x: o.x + Math.cos(angle) * r, y: o.y + Math.sin(angle) * r };
      if (OBSTACLES.every((other) => distance(p, other) >= other.radius + radius)) nodes.push(p);
    }
  const costs = nodes.map(() => Infinity),
    previous = nodes.map(() => -1),
    open = new Set(nodes.map((_, i) => i));
  costs[0] = 0;
  while (open.size) {
    let current = -1,
      score = Infinity;
    for (const n of open) {
      const s = costs[n] + distance(nodes[n], end);
      if (s < score) {
        score = s;
        current = n;
      }
    }
    if (current < 0) break;
    if (current === 1) {
      const path: Vec2[] = [];
      for (let p = 1; p !== 0; p = previous[p]) path.unshift(nodes[p]);
      return path;
    }
    open.delete(current);
    for (const n of open) {
      const cost = costs[current] + distance(nodes[current], nodes[n]);
      if (cost < costs[n] && lineWalkable(nodes[current], nodes[n], radius)) {
        costs[n] = cost;
        previous[n] = current;
      }
    }
  }
  return [];
}
