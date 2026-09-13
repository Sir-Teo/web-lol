export interface Vec2 { x: number; y: number }
export const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function direction(a: Vec2, b: Vec2): Vec2 {
  const d = distance(a, b);
  return d > 0.0001 ? { x: (b.x - a.x) / d, y: (b.y - a.y) / d } : { x: 0, y: 0 };
}
export function segmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return distance(p, { x: a.x + dx * t, y: a.y + dy * t });
}
/** First contact along a swept circle, including an initial overlap. */
export function sweepCircle(a: Vec2, b: Vec2, c: Vec2, radius: number): number | null {
  const dx = b.x - a.x, dy = b.y - a.y, fx = a.x - c.x, fy = a.y - c.y;
  const cc = fx * fx + fy * fy - radius * radius;
  if (cc <= 0) return 0;
  const aa = dx * dx + dy * dy;
  if (aa === 0) return null;
  const bb = 2 * (fx * dx + fy * dy), disc = bb * bb - 4 * aa * cc;
  if (disc < 0) return null;
  const t = (-bb - Math.sqrt(disc)) / (2 * aa);
  return t >= 0 && t <= 1 ? t : null;
}
export class Random {
  constructor(public state: number) { this.state >>>= 0; }
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  between(a: number, b: number): number { return a + (b - a) * this.next(); }
}
