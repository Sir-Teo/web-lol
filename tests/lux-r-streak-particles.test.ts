import { expect, test } from 'vitest';
import { luxRStreakBirth, luxRStreakParticles } from '../src/render/lux-r-streak-particles';
import profile from '../src/content/lux-r-streaks.json';

test('streak birth retains correlated source distribution endpoints and velocity knot', () => {
  const low = luxRStreakBirth(0),
    high = luxRStreakBirth(1),
    middle = luxRStreakBirth(0.5);
  expect(low.life).toBe(0.4000000059604645);
  expect(high.life).toBe(0.800000011920929);
  expect(low.offset).toEqual([100, 0, -1299.9999523162842]);
  expect(high.offset).toEqual([-100, 35, 1299.9999523162842]);
  expect(low.halfSize).toEqual([50, 30.000001192092896, 0]);
  expect(high.halfSize).toEqual([100, 50, 0]);
  expect(low.velocity[2]).toBeCloseTo(-130, 4);
  expect(middle.velocity[2]).toBeCloseTo(-260, 4);
  expect(high.velocity[2]).toBe(-2600);
  expect(low.multOffset).toEqual([-1, 0]);
  expect(high.multOffset).toEqual([1, 0]);
  expect(() => luxRStreakBirth(NaN)).toThrow();
  expect(() => luxRStreakBirth(-0.1)).toThrow();
  expect(() => luxRStreakBirth(1.1)).toThrow();
});

test('45 streaks match independently stepped drag and fractional interpolation', () => {
  const seed = 1234,
    age = 10.25 / 60,
    particles = luxRStreakParticles(seed, age);
  expect(particles).toHaveLength(45);
  expect(new Set(particles.map((p) => p.life)).size).toBe(45);
  for (const p of particles) {
    const birth = luxRStreakBirth(p.chance),
      position = birth.offset.map((v, i) => v + profile.emitterPosition[i]),
      velocity = [...birth.velocity];
    for (let tick = 0; tick < 10; tick++)
      for (let axis = 0; axis < 3; axis++) {
        velocity[axis] *= 1 - profile.drag[axis] / 60;
        position[axis] += velocity[axis] / 60;
      }
    for (let axis = 0; axis < 3; axis++) {
      position[axis] += (0.25 * velocity[axis] * (1 - profile.drag[axis] / 60)) / 60;
      expect(p.position[axis]).toBeCloseTo(position[axis], 9);
    }
    expect(p.halfSize[0]).toBeCloseTo(birth.halfSize[0] * (1 - (0.5 * age) / birth.life), 10);
    expect(p.halfSize[1]).toBeCloseTo(birth.halfSize[1] * (1 - age / birth.life), 10);
    expect(p.multOffset[0]).toBeCloseTo(birth.multOffset[0] + 2 * age, 10);
  }
  expect(luxRStreakParticles(seed, age)).toEqual(particles);
  expect(luxRStreakParticles(seed + 1, age)).not.toEqual(particles);
});

test('streak lifetimes retire separately and alpha retains the authored flicker', () => {
  const seed = 1234,
    birth = luxRStreakParticles(seed, 0),
    selected = birth[0];
  for (const [phase, alpha] of [
    [0.7, 0.39000535011291504],
    [0.8, 0],
    [0.9, 0.39000535011291504],
  ]) {
    const p = luxRStreakParticles(seed, phase * selected.life).find(
      (p) => p.ordinal === selected.ordinal
    )!;
    expect(p.color[3]).toBeCloseTo(alpha, 5);
  }
  expect(luxRStreakParticles(seed, 0.6).map((p) => p.ordinal)).toEqual(
    birth.filter((p) => p.life > 0.6).map((p) => p.ordinal)
  );
  expect(luxRStreakParticles(seed, 0.81)).toEqual([]);
  expect(luxRStreakParticles(seed, -1)).toEqual([]);
  expect(luxRStreakParticles(seed, Infinity)).toEqual([]);
});
