import { expect, test } from 'vitest';
import {
  ahriRParticles,
  AhriRParticleSampler,
  AHRI_R_BOUND_SPELL_PROFILES,
  AHRI_R_SPELL_PROFILE_BINDINGS,
  AHRI_R_PROFILES,
  type AhriRSystem,
  type AhriRParticleContext,
} from '../src/render/ahri-r-particles';
const systems: AhriRSystem[] = ['Ahri_R_mis_02', 'Ahri_R_Tar'];
const context: AhriRParticleContext = {
  boundObjectSize: 100,
  root: (time) => ({ x: time * 120, y: time * time * 8, height: 100, facing: time / 4 }),
};
function finite(value: unknown): boolean {
  return typeof value === 'number'
    ? Number.isFinite(value)
    : Array.isArray(value)
      ? value.every(finite)
      : value && typeof value === 'object'
        ? Object.values(value).every(finite)
        : true;
}
test('R spell sampler covers its 21 selected profiles and never samples deferred producers or arithmetic', () => {
  expect(AHRI_R_BOUND_SPELL_PROFILES).toHaveLength(21);
  expect(
    AHRI_R_SPELL_PROFILE_BINDINGS.filter((p) => p.reason === 'noise-field-arithmetic-unresolved')
  ).toHaveLength(2);
  expect(
    AHRI_R_SPELL_PROFILE_BINDINGS.filter((p) => p.reason === 'native-palette-field-unresolved')
  ).toHaveLength(0);
  expect(
    AHRI_R_SPELL_PROFILE_BINDINGS.filter((p) => p.reason === 'persistent-producer-not-connected')
  ).toHaveLength(11);
  expect(
    AHRI_R_SPELL_PROFILE_BINDINGS.filter((p) => p.reason === 'unjoined-native-producer')
  ).toHaveLength(16);
  const seen = new Set<number>();
  for (const system of systems)
    for (const at of [1 / 60, 0.1, 0.2, 0.4, 0.6, 1, 2, 3, 4]) {
      const particles = ahriRParticles(system, 927, at, Infinity, context);
      expect(finite(particles)).toBe(true);
      for (const particle of particles) {
        seen.add(particle.profileIndex);
        expect(AHRI_R_BOUND_SPELL_PROFILES).toContain(particle.profileIndex);
      }
    }
  expect([...seen].sort((a, b) => a - b)).toEqual(
    [...AHRI_R_BOUND_SPELL_PROFILES].sort((a, b) => a - b)
  );
});
test('R cached seeks match fresh particles across fractional, backward and stopped clocks', () => {
  for (const system of systems) {
    const sampler = new AhriRParticleSampler(system, 927, context);
    for (const at of [0.2, 0.43, 0.431, 0.1, 0.9, 2, 0.2, 5])
      for (const stop of [Infinity, 0.4, 0])
        expect(sampler.sample(at, stop)).toEqual(ahriRParticles(system, 927, at, stop, context));
    sampler.dispose();
    expect(sampler.cachedBirths).toBe(0);
    expect(sampler.sample(0.43)).toEqual(ahriRParticles(system, 927, 0.43, Infinity, context));
    expect(sampler.sample(100)).toEqual([]);
  }
});
test('R secondary UV transports are sampled and target-size flex scales authored contact particles', () => {
  const flight = ahriRParticles('Ahri_R_mis_02', 927, 0.2, Infinity, context);
  const layered = flight.filter((p) => AHRI_R_PROFILES[p.profileIndex].multiplier);
  expect(layered.length).toBeGreaterThan(0);
  for (const particle of layered) {
    expect(particle.multUv).not.toBe(null);
    expect(finite(particle.multUv)).toBe(true);
  }
  const normal = ahriRParticles('Ahri_R_Tar', 927, 0.2, Infinity, context);
  const larger = ahriRParticles('Ahri_R_Tar', 927, 0.2, Infinity, {
    ...context,
    boundObjectSize: 200,
  });
  const scaled = normal.find(
    (p) => AHRI_R_PROFILES[p.profileIndex].flex?.scaleBirthScaleByBoundObjectSize != null
  )!;
  expect(scaled).toBeDefined();
  const other = larger.find(
    (p) => p.profileIndex === scaled.profileIndex && p.ordinal === scaled.ordinal
  )!;
  expect(other.size).toEqual(scaled.size.map((v) => v * 2));
});
test('R invalid clocks and stopped births stay empty without accepting invalid sampler identities', () => {
  for (const system of systems) {
    const sampler = new AhriRParticleSampler(system, 927, context);
    for (const at of [-1, NaN, Infinity]) expect(sampler.sample(at)).toEqual([]);
    expect(sampler.sample(0.2, 0)).toEqual([]);
    expect(sampler.sample(0.2, NaN)).toEqual([]);
  }
  expect(() => new AhriRParticleSampler('Ahri_R_cas' as AhriRSystem, 1)).toThrow();
  expect(() => new AhriRParticleSampler('Ahri_R_Tar', 1.5)).toThrow();
  expect(
    () => new AhriRParticleSampler('Ahri_R_Tar', 1, { ...context, boundObjectSize: 0 })
  ).toThrow();
});
