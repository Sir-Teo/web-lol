import { expect, test } from 'vitest';
import {
  ahriRParticles,
  AhriRParticleSampler,
  AHRI_R_BOUND_BUFF_PROFILES,
  AHRI_R_PROFILES,
  type AhriRParticleContext,
} from '../src/render/ahri-r-particles';
const context: AhriRParticleContext = {
  boundObjectSize: 100,
  root: (time) => ({ x: time * 120, y: time * time * 8, height: 100, facing: time / 4 }),
};
test('the eye sampler prepares only the two finite source glow profiles with authored appearance', () => {
  expect(
    AHRI_R_BOUND_BUFF_PROFILES.filter(
      (index) =>
        AHRI_R_PROFILES[index].system === 'Ahri_R_Eyes' && AHRI_R_PROFILES[index].kind !== 'trail'
    )
  ).toEqual([45, 46]);
  const particles = ahriRParticles('Ahri_R_Eyes', 927, 1.5, Infinity, context).filter(
    (p) => p.profileIndex === 45 || p.profileIndex === 46
  );
  expect(new Set(particles.map((p) => p.profileIndex))).toEqual(new Set([45, 46]));
  for (const particle of particles) {
    const profile = AHRI_R_PROFILES[particle.profileIndex];
    expect(particle.naturalLife).toBe(2);
    expect(particle.sourceBind).toBe(1);
    expect(particle.color.every(Number.isFinite)).toBe(true);
    expect(particle.color[0]).toBe(1);
    expect(particle.color[1]).toBe(profile.birthColor.constant[1]);
    expect(particle.multUv).toBeNull();
    expect(particle.tiling).toBeNull();
  }
});
test('eye cached packets exactly match fresh fractional, backward and stopped seeks', () => {
  const sampler = new AhriRParticleSampler('Ahri_R_Eyes', 927, context);
  for (const time of [1.5, 1.501, 0.2, 3, 18.5, 49.5, 50.5, 52])
    for (const stop of [Infinity, 15, 0])
      expect(sampler.sample(time, stop)).toEqual(
        ahriRParticles('Ahri_R_Eyes', 927, time, stop, context)
      );
  expect(sampler.cachedBirths).toBeLessThanOrEqual(160);
  sampler.dispose();
  expect(sampler.cachedBirths).toBe(0);
  expect(sampler.sample(1.5)).toEqual(ahriRParticles('Ahri_R_Eyes', 927, 1.5, Infinity, context));
});
test('authored fifty-second emission and local stop/linger policy drain to an empty finite packet', () => {
  expect(ahriRParticles('Ahri_R_Eyes', 927, 49.5, Infinity, context).length).toBeGreaterThan(0);
  expect(
    ahriRParticles('Ahri_R_Eyes', 927, 52, Infinity, context).filter(
      (p) => p.profileIndex === 45 || p.profileIndex === 46
    )
  ).toEqual([]);
  expect(ahriRParticles('Ahri_R_Eyes', 927, 15.6, 15, context)).toEqual([]);
  for (const time of [-1, NaN, Infinity])
    expect(ahriRParticles('Ahri_R_Eyes', 927, time, Infinity, context)).toEqual([]);
});
test('every authored eye-glow update keeps its float32 birth and binding clocks valid', () => {
  const sampler = new AhriRParticleSampler('Ahri_R_Eyes', 927, context);
  for (let tick = 1; tick <= 52 * 60; tick++)
    expect(() => sampler.sample(tick / 60), `eye update ${tick}`).not.toThrow();
  sampler.dispose();
});
