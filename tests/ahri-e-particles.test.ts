import { expect, test } from 'vitest';
import {
  AhriEParticleSampler,
  ahriEParticles,
  AHRI_E_PROFILES,
  type AhriESystem,
} from '../src/render/ahri-e-particles';
import { sourceParticlePostRotation } from '../src/render/source-particle-post-rotation';

const systems: AhriESystem[] = [
  'Ahri_E_cas',
  'Ahri_E_mis',
  'Ahri_E_tar',
  'Ahri_E_buf',
  '{44fc6ec4}',
];
for (const system of systems)
  test('E pure/cached/backward seeks remain identical: ' + system, () => {
    const sampler = new AhriEParticleSampler(system, 37);
    for (const time of [0.6, 0.1, 0.4, 1.2, 0.2, 0.6])
      expect(sampler.sample(time)).toEqual(ahriEParticles(system, 37, time));
    const expected = sampler.sample(0.6, 0.3);
    sampler.dispose();
    expect(sampler.cachedBirths).toBe(0);
    expect(sampler.sample(0.6, 0.3)).toEqual(expected);
  });

test('all 29 E emitters produce finite packets without changing authored profiles', () => {
  const source = JSON.stringify(AHRI_E_PROFILES),
    seen = new Set<number>();
  const finite = (value: unknown): void => {
    if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
    else if (Array.isArray(value) || ArrayBuffer.isView(value))
      Array.from(value as ArrayLike<unknown>).forEach(finite);
    else if (value && typeof value === 'object') Object.values(value).forEach(finite);
  };
  for (const system of systems) {
    const sampler = new AhriEParticleSampler(system, 19);
    for (let tick = 0; tick <= 240; tick += 3)
      for (const p of sampler.sample(tick / 60)) {
        seen.add(p.profileIndex);
        finite(p);
        expect(AHRI_E_PROFILES[p.profileIndex].system).toBe(system);
        expect(p.age).toBeLessThan(p.life);
      }
  }
  expect(seen.size).toBe(29);
  expect(JSON.stringify(AHRI_E_PROFILES)).toBe(source);
});

test('E non-neutral rate tables affect birth counts before any particles can retire', () => {
  const index = AHRI_E_PROFILES.findIndex(
    (p) => p.system === 'Ahri_E_cas' && p.name === 'HeartMesh_WORLD1'
  );
  const counts = new Set<number>();
  for (let seed = 1; seed <= 16; seed++)
    counts.add(
      ahriEParticles('Ahri_E_cas', seed, 0.4).filter((p) => p.profileIndex === index).length
    );
  expect(counts.size).toBeGreaterThan(1);
  expect(Math.max(...counts)).toBeGreaterThan(Math.min(...counts));
});

test('E heart meshes carry source-checked post rotation and omitted controls stay omitted', () => {
  const packets = ahriEParticles('Ahri_E_mis', 9, 0.3);
  const hearts = packets.filter(
    (p) => AHRI_E_PROFILES[p.profileIndex].postRotateOrientation.enabled === 1
  );
  expect(hearts).toHaveLength(2);
  for (const p of packets) {
    const profile = AHRI_E_PROFILES[p.profileIndex];
    if (profile.postRotateOrientation.enabled === 1)
      expect(p.sourceBasis).toEqual(
        sourceParticlePostRotation(p.rotation, profile.postRotateOrientation.axis!)
      );
    else expect(p.sourceBasis).toBeNull();
  }
});

test('stopped E phases create no late births, cap total lives and drain within retained history', () => {
  for (const system of systems) {
    const sampler = new AhriEParticleSampler(system, 31);
    for (const p of sampler.sample(0.4, 0.2)) {
      expect(p.bornTick).toBeLessThan(12);
      const profile = AHRI_E_PROFILES[p.profileIndex];
      expect(p.life).toBeLessThanOrEqual(Math.max(profile.linger ?? 0, 0));
      expect(p.life).toBeLessThanOrEqual(p.naturalLife);
    }
    expect(sampler.sample(5.2, 0.2)).toEqual([]);
  }
});

test('E sampler validates identity and clocks before constructing particles', () => {
  expect(() => new AhriEParticleSampler('missing' as AhriESystem, 1)).toThrow();
  expect(() => new AhriEParticleSampler('Ahri_E_cas', NaN)).toThrow();
  for (const time of [-1, NaN, Infinity]) expect(ahriEParticles('Ahri_E_cas', 1, time)).toEqual([]);
  expect(ahriEParticles('Ahri_E_cas', 1, 0.2, -1)).toEqual([]);
});

test('E cached packets expose no retained motion, appearance or rotation storage', () => {
  const sampler = new AhriEParticleSampler('Ahri_E_mis', 11);
  const expected = ahriEParticles('Ahri_E_mis', 11, 0.3);
  for (const p of sampler.sample(0.3)) {
    p.offset.fill(999);
    p.rotation.fill(999);
    p.size.fill(999);
    p.color.fill(999);
    p.sourceBasis?.fill(999);
    p.uv.cell.fill(999);
  }
  const steps = sampler.computedMotionSteps,
    binding = sampler.computedBindingSteps;
  expect(sampler.sample(0.3)).toEqual(expected);
  expect(sampler.computedMotionSteps).toBe(steps);
  expect(sampler.computedBindingSteps).toBe(binding);
});

test('E binding keeps moving-root transport separate from local motion', () => {
  const fixed = { root: () => ({ x: 0, y: 0, height: 0, facing: 0 }), boundObjectSize: 100 };
  const moving = {
    ...fixed,
    root: (time: number) => ({ x: 1200 * time, y: 0, height: 0, facing: 0 }),
  };
  const a = ahriEParticles('Ahri_E_mis', 4, 0.3, Infinity, fixed);
  const b = ahriEParticles('Ahri_E_mis', 4, 0.3, Infinity, moving);
  expect(a.map((p) => p.offset)).toEqual(b.map((p) => p.offset));
  expect(b.some((p, i) => p.worldOffset![0] < a[i].worldOffset![0])).toBe(true);
  expect(b.some((p) => p.worldTravel![0] < 0)).toBe(true);
});

test('E authored target flex uses explicit body size without scaling unrelated emitters', () => {
  const sample = (size: number) =>
    ahriEParticles('Ahri_E_tar', 3, 1 / 60, Infinity, {
      root: () => ({ x: 0, y: 0, height: 0, facing: 0 }),
      boundObjectSize: size,
    });
  const small = sample(50),
    large = sample(100);
  const a = small.find((p) => AHRI_E_PROFILES[p.profileIndex].name === 'Temp_GroundGlow')!;
  const b = large.find((p) => p.profileIndex === a.profileIndex && p.ordinal === a.ordinal)!;
  expect(b.size).toEqual(a.size.map((v) => Math.fround(v * 2)));
  for (const p of small.filter((p) => !AHRI_E_PROFILES[p.profileIndex].flex))
    expect(
      large.find((q) => q.profileIndex === p.profileIndex && q.ordinal === p.ordinal)!.size
    ).toEqual(p.size);
});
