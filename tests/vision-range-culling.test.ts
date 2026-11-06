import { expect, test, vi } from 'vitest';
import { distance, type Vec2 } from '../src/simulation/math';
import { seenFrom, type VisionSource } from '../src/simulation/vision';

const original = (
  point: Vec2,
  sources: readonly VisionSource[],
  sight: (a: Vec2, b: Vec2) => boolean
) =>
  sources.some(
    (source) =>
      distance(source, point) <= source.radius && (source.unobstructed || sight(source, point))
  );

test('range rejection preserves inclusive and floating-point circle boundaries and sight call order', () => {
  const sources = [
    { x: 0, y: 0, radius: 5 },
    { x: 5, y: 0, radius: 5 },
    { x: 10000, y: -10000, radius: 1300, unobstructed: true },
  ];
  const points = [
    { x: 3, y: 4 },
    { x: 5, y: 0 },
    { x: 0, y: 5 },
    { x: 5 + Number.EPSILON * 4, y: 0 },
    { x: 3, y: 4 + Number.EPSILON * 4 },
    { x: 0, y: 0 },
    { x: -1e6, y: 1e6 },
  ];
  let seed = 12345;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0; i < 2000; i++)
    points.push({ x: (next() - 0.5) * 30000, y: (next() - 0.5) * 30000 });
  for (const point of points) {
    const oldCalls: number[] = [],
      newCalls: number[] = [];
    const query = (calls: number[]) => (a: Vec2, b: Vec2) => {
      calls.push(sources.indexOf(a as VisionSource));
      return a.x <= b.x;
    };
    expect(seenFrom(point, sources, query(newCalls))).toBe(
      original(point, sources, query(oldCalls))
    );
    expect(newCalls).toEqual(oldCalls);
  }
});

test('far vision sources skip distance evaluation without changing unobstructed or blocked sight', () => {
  const sources: VisionSource[] = Array.from({ length: 40 }, (_, i) => ({
    x: 5000 + i * 100,
    y: 5000,
    radius: 1300,
  }));
  sources.push({ x: 0, y: 0, radius: 100, unobstructed: true });
  const hypot = vi.spyOn(Math, 'hypot');
  try {
    expect(original({ x: 0, y: 0 }, sources, () => false)).toBe(true);
    expect(hypot).toHaveBeenCalledTimes(41);
    hypot.mockClear();
    expect(seenFrom({ x: 0, y: 0 }, sources, () => false)).toBe(true);
    expect(hypot).toHaveBeenCalledTimes(1);
  } finally {
    hypot.mockRestore();
  }
});

test('degenerate and nonfinite diagnostic inputs retain the previous query result', () => {
  for (const radius of [0, -1, Infinity, -Infinity, NaN])
    for (const x of [0, 1, Infinity, NaN]) {
      const sources = [{ x: 0, y: 0, radius }];
      expect(seenFrom({ x, y: 0 }, sources, () => true)).toBe(
        original({ x, y: 0 }, sources, () => true)
      );
    }
});
