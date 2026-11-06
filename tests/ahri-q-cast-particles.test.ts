import { expect, test } from 'vitest';
import { ahriQCastParticles as sample } from '../src/render/ahri-q-cast-particles';
import data from '../src/content/ahri-q-cast-particles.json';
test('saved dispatch emits exactly three single particles immediately with independently finite source lives', () => {
  expect(sample(-1)).toEqual([]);
  expect(sample(NaN)).toEqual([]);
  expect(sample(Infinity)).toEqual([]);
  expect(sample(0).map((p) => p.profileIndex)).toEqual([0, 1, 2]);
  expect(sample(0).every((p) => p.bornTick === 0 && p.ordinal === 1 && p.bind === 1)).toBe(true);
  expect(sample(0.5).map((p) => p.profileIndex)).toEqual([2]);
  expect(sample(3.99).map((p) => p.profileIndex)).toEqual([2]);
  expect(sample(4)).toEqual([]);
});
test('source color and erosion phases seek without mutable playback or random state', () => {
  const before = JSON.stringify(data),
    a = sample(0.1),
    b = sample(2);
  expect(sample(0.1)).toEqual(a);
  expect(sample(2)).toEqual(b);
  expect(JSON.stringify(data)).toBe(before);
  expect(b[0].erosion).toBeCloseTo(0.5, 12);
  expect(a[0].color[3]).toBeGreaterThan(0);
  expect(sample(0).every((p) => p.color[3] === 0)).toBe(true);
});
test('the source scroll/clamp and 180-degree rotation remain explicit after sampling', () => {
  const p = sample(0.2).find((p) => p.profileIndex === 1)!;
  expect(p.uvRotationDegrees).toBe(180);
  expect(p.offset).toEqual([0, -50, 0]);
  expect(p.size).toEqual([1.2000000476837158, 0.75, 1.2000000476837158]);
  expect(p.uv.offset[1]).not.toBe(0);
});
