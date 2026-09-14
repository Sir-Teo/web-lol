import { expect, test } from 'vitest';
import { luxChargeRayBirth, luxChargeRayParticles } from '../src/render/lux-charge-ray-particles';
import profile from '../src/content/lux-charge-rays.json';

test('rotating charge ray birth keeps correlated source endpoints', () => {
  const low = luxChargeRayBirth(0),
    high = luxChargeRayBirth(1);
  expect(low.rotation).toBe(-360);
  expect(high.rotation).toBe(360);
  expect(low.halfSize).toEqual([5, 60.00000089406967, 0]);
  expect(high.halfSize).toEqual([20, 300, 0]);
  expect(low.multOffset).toEqual([-1, -1]);
  expect(high.multOffset).toEqual([1, 1]);
  expect(() => luxChargeRayBirth(NaN)).toThrow();
  expect(() => luxChargeRayBirth(1.01)).toThrow();
});

test('charge rotation adds birth angular velocity and stepped animated rate with its 60x factor', () => {
  const seed = 918,
    age = 15.25 / 60,
    birth = luxChargeRayParticles(seed, 0),
    particles = luxChargeRayParticles(seed, age);
  expect(particles).toHaveLength(10);
  expect(new Set(birth.map((p) => p.rotation)).size).toBe(10);
  // All these steps precede the first rotation-rate knot at half lifetime.
  const a = 0.20000000298023224,
    b = 0.800000011920929,
    slope = (b - a) / 0.5;
  const rateSum =
    15 * a +
    (slope * ((15 * 16) / 2)) / (60 * profile.life) +
    0.25 * (a + (slope * 16) / (60 * profile.life));
  const scroll = -((15 * 16) / 2 + 0.25 * 16) / (3600 * profile.life);
  particles.forEach((p, i) => {
    expect(p.rotation - birth[i].rotation).toBeCloseTo(150 * age + rateSum, 10);
    expect(p.multOffset[0] - birth[i].multOffset[0]).toBeCloseTo(scroll, 12);
    expect(p.multOffset[1]).toBe(birth[i].multOffset[1]);
  });
  expect(luxChargeRayParticles(seed, age)).toEqual(particles);
  expect(luxChargeRayParticles(seed + 1, age)).not.toEqual(particles);
});

test('late rotation stays at the final rate and the burst fades and retires at source lifetime', () => {
  const seed = 918,
    a = luxChargeRayParticles(seed, 0.8),
    b = luxChargeRayParticles(seed, 0.9);
  b.forEach((p, i) => expect(p.rotation - a[i].rotation).toBeCloseTo((150 + 60 * 5) * 0.1, 10));
  const born = luxChargeRayParticles(seed, 0),
    grown = luxChargeRayParticles(seed, 0.800000011920929 * profile.life);
  grown.forEach((p, i) => {
    expect(p.halfSize[0] * 0.20000000298023224).toBeCloseTo(born[i].halfSize[0], 10);
    expect(p.halfSize[1]).toBeCloseTo(born[i].halfSize[1], 10);
  });
  const peak = luxChargeRayParticles(seed, 0.8999999761581421 * profile.life);
  peak.forEach((p) => expect(p.color[3]).toBeCloseTo(0.4299992322921753, 10));
  expect(luxChargeRayParticles(seed, profile.life)).toEqual([]);
  expect(luxChargeRayParticles(seed, -1)).toEqual([]);
  expect(luxChargeRayParticles(seed, Infinity)).toEqual([]);
});
