import { expect, test } from 'vitest';
import {
  luxBindingTargetBirth,
  luxBindingTargetBirths,
} from '../src/render/lux-binding-target-births';
import { LUX_BINDING_TARGET_BIRTHS } from '../src/content/lux-binding-target-births';

test('first update preserves all eleven layers and source-sized single bursts', () => {
  expect(luxBindingTargetBirths(7, 0)).toEqual([]);
  const particles = luxBindingTargetBirths(7, 1 / 60);
  expect(new Set(particles.map((p) => p.name)).size).toBe(11);
  expect(particles.filter((p) => p.name === 'energy_Float')).toHaveLength(10);
  expect(particles.filter((p) => p.name === 'up_glow')).toHaveLength(3);
  expect(particles.filter((p) => p.name === 'up_glow1')).toHaveLength(3);
  expect(particles.every((p) => p.birthTime === 1 / 60)).toBe(true);
});
test('explicit probability endpoints and omitted lifetime defaults are retained', () => {
  expect(luxBindingTargetBirth(8, 0).life).toBe(0.75);
  expect(luxBindingTargetBirth(8, 1).life).toBeCloseTo(1.9499999284744263, 12);
  for (const i of [4, 5, 6, 7]) expect(luxBindingTargetBirth(i, 0.5).life).toBe(3);
  expect(luxBindingTargetBirth(3, 0.5).spawnOffset).toEqual([0, 230, 0]);
  expect(LUX_BINDING_TARGET_BIRTHS[3].spawnType).toBe('{ee39916f}');
  expect(luxBindingTargetBirth(2, 0.5).spawnAngles).toEqual([180]);
  expect(() => luxBindingTargetBirth(0, NaN)).toThrow();
});
test('stopping prevents births but retains tails and exact repeatable seeking', () => {
  expect(luxBindingTargetBirths(7, 1, 1 / 60)).toEqual([]);
  const stop = 0.25;
  const a = luxBindingTargetBirths(17, 0.4, stop);
  expect(a.every((p) => p.birthTime < stop)).toBe(true);
  expect(a.filter((p) => p.name === 'bars')).toHaveLength(23);
  expect(luxBindingTargetBirths(17, 0.4, stop)).toEqual(a);
  // Three-second ring particles born on the first tick survive emitter shutdown.
  expect(luxBindingTargetBirths(17, 2.8, stop).map((p) => p.name)).toEqual([
    'fireCircleTimer',
    'fireCircleTimer1',
    'Constelations',
    'Constelations1',
  ]);
  expect(luxBindingTargetBirths(17, 3.1, stop)).toEqual([]);
});
test('birth parameters and birth color draw stay fixed while particle age advances', () => {
  const early = luxBindingTargetBirths(23, 0.1).filter((p) => p.name === 'energy_Float');
  const late = luxBindingTargetBirths(23, 0.3).filter((p) => p.name === 'energy_Float');
  expect(late).toHaveLength(10);
  late.forEach((p, i) => {
    const { age: before, ...a } = early[i],
      { age: after, ...b } = p;
    expect(b).toEqual(a);
    expect(after - before).toBeCloseTo(0.2);
  });
});
