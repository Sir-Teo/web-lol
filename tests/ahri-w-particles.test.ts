import { expect, test } from 'vitest';
import {
  AHRI_W_PROFILES as profiles,
  AhriWParticleSampler,
  ahriWParticles,
  type AhriWRole,
  type AhriWParticleContext,
} from '../src/render/ahri-w-particles';
const roles: AhriWRole[] = ['orbit', 'flight', 'hit'];
const fixed: AhriWParticleContext = {
  root: () => ({ x: 0, y: 0, height: 0, facing: 0 }),
  boundObjectSize: 100,
};

test('all 23 joined W profiles produce finite particles and drain within their bounded phase windows', () => {
  const seen = new Set<number>();
  for (const role of roles) {
    const sampler = new AhriWParticleSampler(role, 17);
    expect(sampler.sample(0)).toEqual([]);
    for (const time of [1 / 60, 0.1, 0.3, 0.6, 1, 1.5, 2, 2.5, 3.5, 4]) {
      for (const p of sampler.sample(time)) {
        seen.add(p.profileIndex);
        expect(profiles[p.profileIndex].role).toBe(role);
        expect(p.bind).toBe(0);
        expect(p.sourceBind).toBeGreaterThanOrEqual(0);
        expect(p.sourceBind).toBeLessThanOrEqual(1);
        for (const vector of [
          p.offset,
          p.worldOffset!,
          p.worldTravel!,
          p.size,
          p.color,
          p.rotation,
          p.travel,
          p.lookup,
        ])
          expect(vector.every(Number.isFinite)).toBe(true);
      }
    }
    expect(sampler.sample(8)).toEqual([]);
    sampler.dispose();
    expect(sampler.cachedBirths).toBe(0);
  }
  expect(seen.size).toBe(23);
  expect([...seen].some((index) => profiles[index].role === 'cast')).toBe(false);
});

test('cached W seeks and stop changes match fresh reconstruction without exposing cached buffers', () => {
  const context: AhriWParticleContext = {
    root: (t) => ({ x: 1200 * t, y: 40 * t * t, height: 0, facing: 0.3 }),
    boundObjectSize: 80,
  };
  for (const role of roles) {
    const sampler = new AhriWParticleSampler(role, 91, context);
    for (const [time, stop] of [
      [0.1, Infinity],
      [0.3, Infinity],
      [0.1, Infinity],
      [0.4, 0.25],
      [0.2, 0.25],
      [0.4, Infinity],
    ])
      expect(sampler.sample(time, stop)).toEqual(ahriWParticles(role, 91, time, stop, context));
    const expected = sampler.sample(0.3);
    const motion = sampler.computedMotionSteps,
      binding = sampler.computedBindingSteps;
    const changed = sampler.sample(0.3);
    for (const p of changed) {
      p.offset.fill(999);
      (p.worldOffset as number[]).fill(999);
      p.size.fill(999);
      p.color.fill(999);
      p.uv.offset.fill(999);
      p.uv.cell.fill(999);
    }
    expect(sampler.sample(0.3)).toEqual(expected);
    expect(sampler.computedMotionSteps).toBe(motion);
    expect(sampler.computedBindingSteps).toBe(binding);
  }
});

test('native shared-random flag keeps one emitter chance while atlas frames and live rotation advance', () => {
  const trail = ahriWParticles('flight', 9, 0.3).filter(
    (p) => profiles[p.profileIndex].name === 'Trail_ALPHA'
  );
  expect(trail.length).toBeGreaterThan(1);
  expect(new Set(trail.map((p) => p.sharedChance)).size).toBe(1);
  const cell = (time: number) =>
    ahriWParticles('flight', 9, time).find((p) => profiles[p.profileIndex].name === 'Inner_Light1')!
      .uv.cell;
  expect(cell(0.1)).toEqual([0.5, 0]);
  expect(cell(0.2)).toEqual([0, 0.5]);
  expect(cell(0.3)).toEqual([0, 0]);
  const card = (time: number) =>
    ahriWParticles('orbit', 9, time).find(
      (p) => profiles[p.profileIndex].name === 'FireCards_CAST'
    )!;
  expect(card(0.1).rotation).not.toEqual(card(0.25).rotation);
});

test('W binding accumulates moving roots separately from local particle motion and respects stop caps', () => {
  const moving: AhriWParticleContext = {
    root: (t) => ({ x: 1200 * t, y: 0, height: 0, facing: 0 }),
    boundObjectSize: 100,
  };
  const a = ahriWParticles('orbit', 4, 0.5, Infinity, fixed);
  const b = ahriWParticles('orbit', 4, 0.5, Infinity, moving);
  expect(a.map((p) => p.offset)).toEqual(b.map((p) => p.offset));
  expect(b.some((p, i) => p.worldOffset![0] < a[i].worldOffset![0])).toBe(true);
  expect(b.some((p) => p.worldTravel![0] < 0)).toBe(true);
  for (const p of ahriWParticles('flight', 4, 0.4, 0.25, moving)) {
    expect(p.bornTick / 60).toBeLessThan(0.25);
    expect(p.life).toBeLessThanOrEqual(Math.max(profiles[p.profileIndex].linger ?? 0, 0));
  }
});

test('explicit bound-object size scales only authored flex controls and sphere births preserve their shape', () => {
  const hit = (size: number) =>
    ahriWParticles('hit', 3, 1 / 60, Infinity, { ...fixed, boundObjectSize: size });
  const small = hit(50),
    large = hit(100);
  const flash = small.find((p) => profiles[p.profileIndex].name === 'Flash1')!;
  const other = large.find(
    (p) => p.profileIndex === flash.profileIndex && p.ordinal === flash.ordinal
  )!;
  expect(other.size).toEqual(flash.size.map((v) => Math.fround(v * 2)));
  const smoke = small.find((p) => profiles[p.profileIndex].name === 'Smoke')!;
  expect(Math.hypot(...smoke.offset)).toBeCloseTo(5, 4);
  const sparkles = small.filter((p) => profiles[p.profileIndex].name === 'sparkles_burst');
  expect(sparkles.length).toBeGreaterThan(1);
  expect(sparkles.every((p) => Math.hypot(...p.offset) <= 20.0001)).toBe(true);
});

test('invalid sampler identities reject and invalid seeks produce no particles', () => {
  expect(() => new AhriWParticleSampler('cast' as AhriWRole, 1)).toThrow();
  expect(() => new AhriWParticleSampler('orbit', NaN)).toThrow();
  expect(() => new AhriWParticleSampler('orbit', 1, { ...fixed, boundObjectSize: 0 })).toThrow();
  const sampler = new AhriWParticleSampler('orbit', 1);
  for (const time of [-1, NaN, Infinity]) expect(sampler.sample(time)).toEqual([]);
  expect(sampler.sample(0.5, NaN)).toEqual([]);
});
