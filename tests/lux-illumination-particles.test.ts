import { expect, test } from 'vitest';
import { luxIlluminationParticles } from '../src/render/lux-illumination-particles';

const layer = (time: number, name: string, seed = 123) =>
  luxIlluminationParticles(seed, time).filter((p) => p.name === name);

test('all four layers begin at the first reconstruction tick and retain authored dimensions', () => {
  expect(luxIlluminationParticles(123, 0)).toEqual([]);
  const particles = luxIlluminationParticles(123, 1 / 60);
  expect(particles.map((p) => p.name)).toEqual(['luxdebuff1', 'luxdebuff2', 'rays', 'smallball']);
  expect(particles[0].size).toEqual([60, 60, 60]);
  expect(particles[1].rotation).toEqual([20, 0, 0]);
  expect(particles[2].primitive).toBe('ray');
  expect(particles[2].life).toBeGreaterThanOrEqual(0.5);
  expect(particles[2].life).toBeLessThan(1);
  expect(particles[3].size).toEqual([120, 120, 120]);
  expect(particles[3].color[3]).toBe(0);
});

test('starbursts counter-rotate for their exact six-second particle lifetime', () => {
  const time = 3 + 1 / 60;
  expect(layer(time, 'luxdebuff1')[0].rotation).toEqual([-30, 0, 0]);
  expect(layer(time, 'luxdebuff2')[0].rotation).toEqual([50, 0, 0]);
  expect(layer(time, 'luxdebuff1')[0].lookup).toEqual([0.5, 1]);
  expect(layer(6 + 1 / 60, 'luxdebuff1')).toEqual([]);
});

test('ray curves use each particle lifetime and shared birth chance rather than emitter age', () => {
  const birth = layer(1 / 60, 'rays')[0];
  const atMiddle = layer(1 / 60 + birth.life / 2, 'rays').find((p) => p.ordinal === 1)!;
  expect(atMiddle.color[3]).toBeCloseTo(0.800000011920929);
  // At phase .5: Y scale interpolates 6 -> 4 between .25 and 1.
  const chanceFactor = birth.size[0] / 2 / 90;
  expect(atMiddle.size[1]).toBeCloseTo(30 * chanceFactor * (6 - 2 / 3));
  expect(atMiddle.rotation).toEqual(birth.rotation);
});

test('stopping births preserves surviving particles and seeking is independent of call order', () => {
  const target = luxIlluminationParticles(92, 0.3, 0.2);
  expect(target.every((p) => p.birthTime < 0.2)).toBe(true);
  luxIlluminationParticles(92, 9);
  expect(luxIlluminationParticles(92, 0.3, 0.2)).toEqual(target);
  expect(luxIlluminationParticles(92, 8, 0.2)).toEqual([]);
  expect(luxIlluminationParticles(92, 1, 0)).toEqual([]);
  expect(luxIlluminationParticles(92, NaN)).toEqual([]);
});

test('small glow uses particle-relative multiplier motion and excludes Steel Legion only', () => {
  const birth = layer(1 / 60, 'smallball')[0];
  const later = layer(1 / 60 + 0.2, 'smallball')[0];
  expect(later.multOffset[0] - birth.multOffset[0]).toBeCloseTo(0.2);
  expect(later.multOffset[1]).toBe(0);
  expect(later.color[3]).toBeCloseTo(0.8599984645843506 * 0.7000076174736023);
  expect(
    luxIlluminationParticles(123, 0.2, Infinity, ['SteelLegionLux']).map((p) => p.name)
  ).not.toContain('smallball');
  expect(luxIlluminationParticles(123, 0.2, Infinity, ['Other']).map((p) => p.name)).toContain(
    'smallball'
  );
});
