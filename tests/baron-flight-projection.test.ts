import { expect, test } from 'vitest';
import * as THREE from 'three';
import { BaronFlightProjection } from '../src/render/baron-flight-projection';
import { sampleBaronFlight, sampleBaronFlightRoot } from '../src/render/baron-flight-history';
import type { BaronAttackVisual } from '../src/simulation/baron-attack-visuals';
const effect = () =>
  ({
    origin: { x: 0, y: 0 },
    launchTick: 0,
    stopTick: 2,
    frames: [
      { tick: 0, x: 0, y: 0, facing: Math.PI / 2, distance: 0, audience: ['blue'] },
      { tick: 1, x: 50, y: 0, facing: Math.PI / 2, distance: 50, audience: [] },
      { tick: 2, x: 100, y: 0, facing: Math.PI / 2, distance: 100, audience: ['blue'] },
      { tick: 3, x: 100, y: 0, facing: Math.PI / 2, distance: 100, audience: ['blue'] },
    ],
  }) as BaronAttackVisual;
const jaw = () => new THREE.Matrix4().makeTranslation(0.2, 3, 0.1);
test('local projection uses saved muzzle then recorded path with one supplied elevation', () => {
  const e = effect(),
    p = new BaronFlightProjection(e, jaw(), { x: 100, y: 0 }, () => 0.5, 100);
  expect(p.point(0)).toEqual([20, 300, 10]);
  expect(p.point(1)).toEqual([60, 225, 5]);
  expect(p.point(2)).toEqual([100, 150, 0]);
  expect(p.point(1.5)).toEqual([80, 187.5, 2.5]);
  expect(p.sample(3)).toEqual(p.sample(2));
});
test('projection reconstruction and future target mutation cannot rewrite saved inputs', () => {
  const e = effect(),
    matrix = jaw(),
    target = { x: 100, y: 0 },
    p = new BaronFlightProjection(e, matrix, target, () => 0, 100),
    expected = p.sample(1.5);
  target.x = 9000;
  matrix.elements.fill(999);
  expect(p.sample(1.5)).toEqual(expected);
  const copy = new BaronFlightProjection(structuredClone(e), jaw(), { x: 100, y: 0 }, () => 0, 100);
  expect(copy.sample(1.5)).toEqual(expected);
  expected.origin.fill(999);
  expected.orientation.fill(999);
  expect(p.sample(1.5)).toEqual(copy.sample(1.5));
});
test('raw roots retain hidden trajectory without making gated drawing visible', () => {
  const e = effect();
  expect(sampleBaronFlight(e, 1.5, 'blue')).toBeNull();
  expect(sampleBaronFlightRoot(e, 1.5)?.x).toBe(75);
  expect(sampleBaronFlight(e, 2, 'blue')?.x).toBe(100);
});
test('overlapping initial targets and long range tails stay finite and bounded', () => {
  const e = effect(),
    p = new BaronFlightProjection(e, jaw(), { x: 0, y: 0 }, () => 0, 100);
  expect(p.point(1)).toEqual([50, 100, 0]);
  expect(Array.from(p.sample(0).orientation).every(Number.isFinite)).toBe(true);
});
test('missing history, invalid elevations and invalid terrain reject', () => {
  for (const elevation of [-1, NaN, Infinity])
    expect(
      () => new BaronFlightProjection(effect(), jaw(), { x: 1, y: 0 }, () => 0, elevation)
    ).toThrow();
  const p = new BaronFlightProjection(effect(), jaw(), { x: 100, y: 0 }, () => 0, 100);
  for (const tick of [-1, 4, NaN]) expect(() => p.sample(tick)).toThrow('retained root');
  expect(() =>
    new BaronFlightProjection(effect(), jaw(), { x: 100, y: 0 }, () => NaN, 100).point(0)
  ).toThrow('terrain');
});
