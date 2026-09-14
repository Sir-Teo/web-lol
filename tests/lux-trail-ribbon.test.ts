import { expect, it } from 'vitest';
import { luxTrailRibbon } from '../src/render/lux-trail-ribbon';
import type { LuxTrailPoint } from '../src/render/lux-trail-particles';
function point(x: number, wakeU = x / 500): LuxTrailPoint {
  return {
    ordinal: x,
    birthTick: 1,
    age: 0.1,
    position: [x, 50, 0],
    facing: Math.PI / 2,
    halfWidth: 10,
    color: [1, 0.8, 0.5, 0.4],
    distance: x,
    wakeU,
    multScroll: [0.1, 0],
  };
}
it('expands the arbitrary ribbon along each particle local X and preserves per-point tint', () => {
  const a = point(600),
    b = point(500);
  b.facing = 0;
  b.halfWidth = 20;
  b.color = [0.3, 0.2, 0.1, 0.5];
  const v = luxTrailRibbon([a, b]);
  expect(v).toHaveLength(6);
  expect(v[0].position[0]).toBeCloseTo(600);
  expect(v[0].position[2]).toBeCloseTo(-10);
  expect(v[1].position[2]).toBeCloseTo(10);
  expect(v[2].position).toEqual([520, 50, 0]);
  expect(v[5].position).toEqual([480, 50, 0]);
  expect(v[0].color).toEqual(a.color);
  expect(v[2].color).toEqual(b.color);
});
it('packs wake UVs by the leading even cell while scrolling only the multiplier', () => {
  const v = luxTrailRibbon([point(2600), point(2500)]);
  expect(v[0].uv[0]).toBeCloseTo(1.2);
  expect(v[0].uv[1]).toBe(0);
  expect(v[1].uv[1]).toBe(1);
  expect(v[0].multUv[0]).toBeCloseTo(1.3);
  expect(v[2].uv).toEqual([1, 0]);
  const movedCell = luxTrailRibbon([point(3600), point(3500)]);
  expect(movedCell.map((p) => p.uv)).toEqual(v.map((p) => p.uv));
});
it('truncates at total walked cutoff rather than treating cutoff as a segment gap', () => {
  const v = luxTrailRibbon([point(1000), point(500), point(0)]);
  expect(v).toHaveLength(6);
  expect(v.every((p) => p.position[0] >= 499)).toBe(true);
  expect(luxTrailRibbon([point(1000), point(0)])).toEqual([]);
  expect(luxTrailRibbon([point(0)])).toEqual([]);
});
it('does not bridge a hidden point and restores the same vertices after revealing it', () => {
  const points = [point(600), point(500), point(400), point(300)];
  const full = luxTrailRibbon(points);
  expect(full).toHaveLength(18);
  expect(luxTrailRibbon(points, (p) => p.distance !== 400)).toEqual(full.slice(0, 6));
  expect(luxTrailRibbon(points)).toEqual(full);
});
