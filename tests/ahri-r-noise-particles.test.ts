import { expect, test } from 'vitest';
import {
  ahriRParticles,
  AhriRParticleSampler,
  AHRI_R_PREPARED_NOISE_PROFILES,
  AHRI_R_BOUND_SPELL_PROFILES,
  type AhriRSystem,
} from '../src/render/ahri-r-particles';
const root = (time: number) => ({
  x: time * 120,
  y: time * time * 8,
  height: 100,
  facing: time / 4,
});
for (const [profile, system] of [
  [10, 'Ahri_R_Tar'],
  [27, 'Ahri_R_mis_02'],
] as const) {
  test('noise profile ' + profile + ' is bound and preserves finite cold seeks', () => {
    expect(AHRI_R_PREPARED_NOISE_PROFILES).toContain(profile);
    expect(AHRI_R_BOUND_SPELL_PROFILES).toContain(profile);
    expect(ahriRParticles(system, 927, 0.5).some((p) => p.profileIndex === profile)).toBe(true);
    const context = { root, boundObjectSize: 100, profiles: [profile] };
    const sampler = new AhriRParticleSampler(system, 927, context);
    let seen = false;
    for (const time of [1 / 60, 0.1, 0.43, 0.431, 1.5, 3, 5.5, 0.2, 8])
      for (const stop of [Infinity, 0.4, 2]) {
        const actual = sampler.sample(time, stop);
        expect(actual).toEqual(ahriRParticles(system, 927, time, stop, context));
        expect(actual.every((p) => p.profileIndex === profile)).toBe(true);
        expect(
          actual.every((p) =>
            [...p.offset, ...p.worldTravel!, ...p.size, ...p.color].every(Number.isFinite)
          )
        ).toBe(true);
        seen ||= actual.length > 0;
        expect(sampler.cachedBirths).toBeLessThanOrEqual(256);
        expect(sampler.computedMotionSteps).toBeLessThanOrEqual(256 * 122);
      }
    expect(seen).toBe(true);
    expect(sampler.sample(8)).toEqual([]);
    sampler.dispose();
    expect(sampler.cachedBirths).toBe(0);
  });
}
test('expired prepared noise never asks a discarded caster or target for old roots', () => {
  for (const system of ['Ahri_R_Tar', 'Ahri_R_mis_02'] as AhriRSystem[]) {
    expect(
      ahriRParticles(system, 927, 8, Infinity, {
        boundObjectSize: 100,
        profiles: [10, 27],
        root: () => {
          throw Error('Discarded root');
        },
      })
    ).toEqual([]);
  }
});
