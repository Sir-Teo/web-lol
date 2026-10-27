import { expect, test } from 'vitest';
import {
  redirectOrbitalVelocity,
  orbitalParticleTravel,
} from '../src/render/particle-orbital-motion';
const up = [0, 1, 0];

test('radial horizontal motion redirects tangentially while preserving vertical motion and speed', () => {
  const velocity = new Float32Array([3, 4, 0]);
  redirectOrbitalVelocity(velocity, [10, 0, 0], up);
  expect([...velocity]).toEqual([0, 4, 3]);
});
test('opposite transverse direction keeps its sense and magnitude', () => {
  const velocity = new Float32Array([-3, 4, -2]);
  redirectOrbitalVelocity(velocity, [10, 0, 0], up);
  expect([...velocity]).toEqual([0, 4, -Math.fround(Math.sqrt(13))]);
});
test('the small positive-axis guard is deliberately one-sided', () => {
  const positive = new Float32Array([3, 4, 0]),
    negative = new Float32Array(positive);
  redirectOrbitalVelocity(positive, [0.01, 10, 0], up);
  redirectOrbitalVelocity(negative, [0.01, -10, 0], up);
  expect([...positive]).toEqual([3, 4, 0]);
  expect([...negative]).toEqual([0, 4, 3]);
});
for (const point of [
  [0, 0, 0],
  [0, 10, 0],
  [0, -10, 0],
])
  test(`undefined tangents leave velocity unchanged at ${point}`, () => {
    const velocity = new Float32Array([3, 4, 0]);
    redirectOrbitalVelocity(velocity, point, up);
    expect([...velocity]).toEqual([3, 4, 0]);
  });
test('almost still transverse motion does not acquire an arbitrary turn', () => {
  const velocity = new Float32Array([0.0001, 4, 0]),
    before = [...velocity];
  redirectOrbitalVelocity(velocity, [10, 0, 0], up);
  expect([...velocity]).toEqual(before);
});
test('a zero-time birth changes velocity without moving either position', () => {
  const result = orbitalParticleTravel([3, 4, 0], [0, 600, 0], [10, 0, 0], 0, up);
  expect(result.local.position).toEqual([0, 0, 0]);
  expect(result.world.position).toEqual([0, 0, 0]);
  expect(result.local.travel).toEqual([0, 4, 3]);
  expect(result.world.travel).toEqual([0, 0, 0]);
});
test('world-up acceleration stays separate and a partial step interpolates the same endpoint', () => {
  const full = orbitalParticleTravel([3, 4, 0], [0, 600, 0], [10, 0, 0], 1 / 60, up),
    half = orbitalParticleTravel([3, 4, 0], [0, 600, 0], [10, 0, 0], 0.5 / 60, up);
  expect(full.world.travel).toEqual([0, 10, 0]);
  expect(full.world.position[1]).toBe(1 / 6);
  expect(half.local.position).toEqual(full.local.position.map((v) => v * 0.5));
  expect(half.world.position).toEqual(full.world.position.map((v) => v * 0.5));
  expect(half.local.travel).toEqual(full.local.travel);
});
test('seeks do not mutate birth inputs and reject unsupported force frames', () => {
  const velocity = [3, 4, 0],
    acceleration = [0, 600, 0],
    origin = [10, 0, 0],
    before = orbitalParticleTravel(velocity, acceleration, origin, 0.1, up);
  orbitalParticleTravel(velocity, acceleration, origin, 0.2, up);
  expect(orbitalParticleTravel(velocity, acceleration, origin, 0.1, up)).toEqual(before);
  expect(velocity).toEqual([3, 4, 0]);
  expect(acceleration).toEqual([0, 600, 0]);
  expect(origin).toEqual([10, 0, 0]);
  expect(() => orbitalParticleTravel(velocity, [1, 0, 0], origin, 0.1, up)).toThrow('frame/time');
  expect(() => orbitalParticleTravel(velocity, acceleration, origin, 0.1, [1, 0, 0])).toThrow(
    'frame/time'
  );
  expect(() => orbitalParticleTravel(velocity, [0, NaN, 0], origin, 0.1, up)).toThrow('frame/time');
});
