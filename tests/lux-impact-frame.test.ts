import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { luxImpactSparkAnchor } from '../src/render/lux-impact-frame';
it('accumulates three-dimensional binding without losing inherited motion when weight reaches zero', () => {
  const point = (tick: number) => {
    const i = Math.max(0, Math.min(31, tick - 100));
    return new Vector3(i * 10, i * 3, i < 15 ? 0 : (i - 15) * 20);
  };
  const anchor = (tick: number) => luxImpactSparkAnchor(100, tick, point);
  expect(anchor(101)).toEqual(point(101));
  expect(anchor(102)).toEqual(new Vector3(15, 4.5, 0));
  const p = anchor(130);
  expect(p.x).toBeGreaterThan(point(101).x);
  expect(p.y).toBeGreaterThan(point(101).y);
  expect(p.z).toBeGreaterThan(0);
  expect(anchor(131)).toEqual(p);
  expect(anchor(110.5)).toEqual(anchor(110).lerp(anchor(111), 0.5));
  const saved = anchor(120);
  anchor(131);
  expect(anchor(120)).toEqual(saved);
  // Sampling may return borrowed cached endpoints; integration must not mutate them.
  const fixed = new Vector3(1, 2, 3);
  expect(luxImpactSparkAnchor(100, 105, () => fixed)).toEqual(fixed);
  expect(fixed.toArray()).toEqual([1, 2, 3]);
});
