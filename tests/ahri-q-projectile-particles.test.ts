import { expect, test } from 'vitest';
import data from '../src/content/ahri-q-projectile-particles.json';
import {
  AhriQProjectileSampler,
  ahriQProjectileParticles as sample,
} from '../src/render/ahri-q-projectile-particles';
import { SourceIntegratedValue } from '../src/render/source-integrated-value';
const profile = (name: string, role = 'missile') =>
  data.profiles.findIndex((p) => p.name === name && p.role === role);
test('first updates preserve source single burst counts and the distinct delayed return glow', () => {
  expect(sample('return', 7, 0)).toEqual([]);
  const first = sample('return', 7, 1 / 60);
  expect(first.filter((p) => p.profileIndex === profile('sparkles_burst', 'return'))).toHaveLength(
    75
  );
  expect(
    first.filter((p) => p.profileIndex === profile('DISSOLVE_SPHEREb', 'return'))
  ).toHaveLength(5);
  const delayed = profile('OverlayGlow', 'return');
  expect(sample('return', 7, 11 / 60).some((p) => p.profileIndex === delayed)).toBe(false);
  expect(sample('return', 7, 12 / 60).filter((p) => p.profileIndex === delayed)).toHaveLength(1);
});
test('each profile participates in deterministic seeks with stable ordinals and no returned shared buffers', () => {
  const seen = new Set<number>();
  for (const role of ['missile', 'return'] as const)
    for (const t of [1 / 60, 0.2, 0.3, 0.5, 1, 2]) {
      const a = sample(role, 41, t);
      expect(sample(role, 41, t)).toEqual(a);
      for (const p of a) {
        seen.add(p.profileIndex);
        expect(p.color.every(Number.isFinite)).toBe(true);
        expect(p.offset.every(Number.isFinite)).toBe(true);
        expect(p.life).toBeGreaterThan(0);
        expect(p.phase).toBeGreaterThanOrEqual(0);
        expect(p.phase).toBeLessThanOrEqual(1);
      }
    }
  expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: 36 }, (_, i) => i));
  const a = sample('return', 11, 0.3),
    expected = sample('return', 11, 0.3);
  a[0].offset[0] = 999;
  a[0].color[0] = 999;
  (a[0].worldTravel as number[])[0] = 999;
  expect(sample('return', 11, 0.3)).toEqual(expected);
});
test('root stops emit no future particles and capped source linger cannot revive or extend finite lives', () => {
  const stopped = sample('return', 5, 0.4, 0.35),
    burst = profile('sparkles_burst', 'return');
  expect(stopped.length).toBeGreaterThan(0);
  expect(stopped.every((p) => p.bornTick < 0.35 * 60)).toBe(true);
  expect(
    stopped.filter((p) => p.profileIndex === burst).every((p) => p.life <= 0.6499999761581421)
  ).toBe(true);
  expect(sample('return', 5, 2, 0.35)).toEqual([]);
  expect(sample('missile', 5, 2, 0.35)).toEqual([]);
  expect(sample('return', 5, 10)).toEqual([]);
  expect(sample('missile', 5, 10)).toEqual([]);
  expect(sample('return', 5, 1, 0)).toEqual([]);
});
test('particle UV uses its authored integral and emitter pan uses the root clock independently', () => {
  const time = 0.3,
    p = sample('missile', 5, time).find((p) => p.profileIndex === profile('Trail3'))!,
    source = data.profiles[p.profileIndex];
  expect(source.uv.emitterScroll).toEqual([0.5, 0]);
  expect(p.uv.offset[0]).toBeGreaterThanOrEqual(0);
  expect(p.uv.offset[0]).toBeLessThan(1);
  const indicator = sample('return', 5, 0.3).find(
      (p) => p.profileIndex === profile('Indicator', 'return')
    )!,
    layer = data.profiles[indicator.profileIndex].uv;
  const integral =
    new SourceIntegratedValue(layer.scroll).sample(indicator.phase, 1)[0] * indicator.life;
  const initial = layer.offset.values[0][0],
    rate = layer.birthScroll.values[0][0],
    ramp = initial + indicator.age * rate,
    bounded = layer.clamp ? Math.max(-1, Math.min(1, ramp)) : ramp % 1;
  const expected = (((bounded + integral) % 1) + 1) % 1;
  expect(indicator.uv.offset[0]).toBeCloseTo(expected, 6);
});
test('cylindrical births remain within the source radius and height and carry authored drag', () => {
  const index = profile('sparkles_mis', 'return'),
    particles = sample('return', 123, 0.1).filter((p) => p.profileIndex === index);
  expect(particles.length).toBeGreaterThan(0);
  expect(data.profiles[index].position.constant).toEqual([0, -50, 0]);
  expect(data.profiles[index].drag.constant).toEqual([0, 4, 0]);
  const fresh = particles.filter((p) => p.bornTick > 5);
  expect(fresh.length).toBeGreaterThan(0);
  for (const p of fresh) {
    expect(Math.hypot(p.offset[0], p.offset[2])).toBeLessThanOrEqual(100.00001);
    expect(p.offset[1]).toBeGreaterThanOrEqual(-50);
    expect(p.offset[1]).toBeLessThanOrEqual(0.00001);
  }

  expect(data.profiles[index].shape).toMatchObject({
    kind: 'cylinder',
    radius: 100,
    height: 50,
    flags: 1,
  });
  expect(
    new Set(particles.map((p) => p.offset.map((v) => v.toFixed(4)).join(':'))).size
  ).toBeGreaterThan(1);
  expect(sample('return', 124, 0.1).filter((p) => p.profileIndex === index)).not.toEqual(particles);
});
test('invalid clocks fail closed', () => {
  for (const t of [-1, NaN, Infinity]) expect(sample('return', 1, t)).toEqual([]);
  for (const stop of [-1, NaN]) expect(sample('return', 1, 0.1, stop)).toEqual([]);
  expect(sample('return', NaN, 0.1)).toEqual([]);
});

test('cached seeks preserve exact stateless output across rewinds, stops and disposal', () => {
  for (const role of ['missile', 'return'] as const) {
    const cached = new AhriQProjectileSampler(role, 31);
    for (const t of [0.05, 0.1, 0.333, 0.8, 0.15, 1.1, 0.4, 2, 0.22])
      expect(cached.sample(t), role + ':' + t).toEqual(sample(role, 31, t));
    const expected = cached.sample(0.4),
      steps = cached.computedMotionSteps;
    expect(cached.sample(0.4)).toEqual(expected);
    expect(cached.computedMotionSteps).toBe(steps);
    expect(cached.sample(0.4, 0.3)).toEqual(sample(role, 31, 0.4, 0.3));
    expect(cached.computedMotionSteps).toBe(steps);
    expect(cached.cachedBirths).toBeLessThan(2000);
    cached.dispose();
    expect(cached.cachedBirths).toBe(0);
    expect(cached.sample(0.4)).toEqual(expected);
  }
});
