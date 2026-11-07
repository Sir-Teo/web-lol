import { expect, test } from 'vitest';
import {
  AhriRParticleSampler,
  ahriRParticles,
  AHRI_R_PREPARED_EYE_TRAIL_PROFILES,
  type AhriRParticleContext,
} from '../src/render/ahri-r-particles';
const context: AhriRParticleContext = {
  boundObjectSize: 100,
  root: (time) => ({ x: time * 20, y: Math.sin(time) * 40, height: 150, facing: time / 20 }),
};
const trails = (time: number, stop = Infinity) =>
  ahriRParticles('Ahri_R_Eyes', 927, time, stop, context).filter(
    (p) => p.profileIndex === 47 || p.profileIndex === 48
  );
test('periodic eye particles honor both authored windows after the glow emitters have ended', () => {
  expect(AHRI_R_PREPARED_EYE_TRAIL_PROFILES).toEqual([47, 48]);
  expect(new Set(trails(70.3).map((p) => p.profileIndex))).toEqual(new Set([47, 48]));
  expect(trails(71).some((p) => p.profileIndex === 48)).toBe(false);
  for (const particle of trails(70.3)) {
    expect(particle.tiling).not.toBeNull();
    expect(particle.life).toBeLessThan(0.21);
    expect(particle.sourceBind).toBeGreaterThan(0);
    expect(particle.sourceBind).toBeLessThan(1);
    expect(particle.worldOffset?.every(Number.isFinite)).toBe(true);
  }
});
test('periodic particle clocks stay precise at distant ages and cached seeks match fresh packets', () => {
  const sampler = new AhriRParticleSampler('Ahri_R_Eyes', 927, context);
  for (const time of [2.6, 2.601, 3, 70.3, 5000.3, 1e6 + 0.3, 1.3, 70.3])
    for (const stop of [Infinity, time - 0.1, 0])
      expect(sampler.sample(time, stop)).toEqual(
        ahriRParticles('Ahri_R_Eyes', 927, time, stop, context)
      );
  expect(sampler.cachedBirths).toBeLessThanOrEqual(160);
  expect(trails(5000.6, 5000.3)).toEqual([]);
  sampler.dispose();
  expect(sampler.cachedBirths).toBe(0);
});
test('repeated long-window sampling keeps only bounded recent trail births', () => {
  const sampler = new AhriRParticleSampler('Ahri_R_Eyes', 927, context);
  for (let second = 60; second < 600; second++) {
    sampler.sample(second + 0.3);
    expect(sampler.cachedBirths).toBeLessThanOrEqual(160);
  }
  sampler.dispose();
});
test('rebased particle clocks still request actual recent caster roots', () => {
  const called: number[] = [];
  ahriRParticles('Ahri_R_Eyes', 927, 70.3, Infinity, {
    ...context,
    root: (time) => {
      called.push(time);
      return context.root(time);
    },
  });
  expect(called.length).toBeGreaterThan(0);
  expect(Math.min(...called)).toBeGreaterThan(70);
  expect(Math.max(...called)).toBeLessThan(70.4);
});
