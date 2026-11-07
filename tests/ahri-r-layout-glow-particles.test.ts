import { expect, test } from 'vitest';
import {
  ahriRParticles,
  AhriRParticleSampler,
  AHRI_R_BOUND_BUFF_PROFILES,
  AHRI_R_PROFILES,
} from '../src/render/ahri-r-particles';
import { AHRI_R_LAYOUT_GLOW_BIRTH_POLICY as policy } from '../src/render/ahri-r-layout-glow-schedule';

const root = (time: number) => ({
  x: Math.fround(Math.sin(time * 0.7) * 120),
  y: Math.fround(Math.cos(time * 0.3) * 80),
  height: Math.fround(100 + Math.sin(time) * 20),
  facing: Math.sin(time / 3),
});
const context = { boundObjectSize: 100, root };
const glows = (particles: ReturnType<typeof ahriRParticles>) =>
  particles.filter((p) => p.profileIndex === 53);

test('the prepared continuous glow preserves authored lifetime draws and its required soft-depth input', () => {
  expect([...AHRI_R_BOUND_BUFF_PROFILES]).toContain(53);
  expect(AHRI_R_PROFILES[53].bindingRequirements).toContain('soft-depth-input');
  expect(AHRI_R_PROFILES[53].soft).toMatchObject({ deltaIn: 30 });
  const particles = glows(ahriRParticles('Ahri_R_Ready_tar', 927, 70.25, Infinity, context));
  expect(particles.length).toBeGreaterThan(0);
  for (const p of particles) {
    expect(p.naturalLife).toBeGreaterThanOrEqual(Math.fround(1.4));
    expect(p.naturalLife).toBeLessThanOrEqual(policy.maximumLife);
    expect(p.sourceBind).toBe(1);
    expect(p.bind).toBe(0);
    expect(p.offset[1]).toBeGreaterThanOrEqual(75);
    expect(p.worldOffset).toBeDefined();
    expect(p.worldTravel).toBeDefined();
    expect(
      [
        ...p.offset,
        ...p.worldOffset!,
        ...p.worldTravel!,
        ...p.rotation,
        ...p.size,
        ...p.color,
      ].every(Number.isFinite)
    ).toBe(true);
  }
});

test('cached continuous packets match fresh seeks beyond a source pool-counter wrap and at large ages', () => {
  const sampler = new AhriRParticleSampler('Ahri_R_Ready_tar', 927, context);
  for (const time of [0.2, 1.5, 1.501, 70.25, 0.2 + (65536 * 8) / 60, 1000000.2, 70.25, 0.2])
    for (const stop of [Infinity, 0.4, 15]) {
      expect(sampler.sample(time, stop)).toEqual(
        ahriRParticles('Ahri_R_Ready_tar', 927, time, stop, context)
      );
      expect(sampler.cachedBirths).toBeLessThanOrEqual(42);
      expect(sampler.computedBindingSteps).toBeLessThanOrEqual(602 + 19 * 146 + 22 * 62);
    }
  sampler.dispose();
  expect(sampler.cachedBirths).toBe(0);
});

test('cold long-age glow seeks query only recent owned roots, never the system birth pose', () => {
  for (const time of [70.25, 1000000.2, 1000000000]) {
    const queried: number[] = [];
    const particles = glows(
      ahriRParticles('Ahri_R_Ready_tar', 13, time, Infinity, {
        boundObjectSize: 100,
        root: (at) => {
          if (at < time - 3) throw Error('Discarded root');
          queried.push(at);
          return root(at);
        },
      })
    );
    expect(particles.length).toBeGreaterThan(0);
    expect(Math.min(...queried)).toBeGreaterThan(time - 3);
    expect(queried.length).toBeLessThan(6000);
  }
});

test('the observed stop suppresses later births and the authored half-second linger drains finitely', () => {
  const live = glows(ahriRParticles('Ahri_R_Ready_tar', 927, 15.1, 15, context));
  expect(live.length).toBeGreaterThan(0);
  expect(live.every((p) => p.bornTick / 60 < 15)).toBe(true);
  expect(live.every((p) => p.life === 0.5)).toBe(true);
  expect(glows(ahriRParticles('Ahri_R_Ready_tar', 927, 15.6, 15, context))).toEqual([]);
  expect(ahriRParticles('Ahri_R_Ready_tar', 927, 1, 0, context)).toEqual([]);
  expect(() => ahriRParticles('Ahri_R_Ready_tar', 927, 1000000001, Infinity, context)).toThrow(
    RangeError
  );
});
