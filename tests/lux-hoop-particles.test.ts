import { expect, it } from 'vitest';
import source from '../docs/reference/lux-basic-attack.json';
import {
  LUX_HOOP as h,
  luxHoopBirth,
  luxHoopChance,
  luxHoopParticles,
} from '../src/render/lux-hoop-particles';
import { LUX_BASIC_HOOP_APPEARANCE as a } from '../src/content/lux-basic-lookups';

it('matches all sampled hoop birth and motion constants to the pinned emitter', () => {
  const e = source.data.complexEmitterDefinitionData.find((e) => e.emitterName === 'hoop')!;
  expect(e.rate.constantValue).toBe(h.rate);
  expect(e.lifetime).toBe(h.duration);
  expect(e.birthDrag?.constantValue).toEqual([0, h.dragY, 0]);
  expect(e.birthOrbitalVelocity?.constantValue).toEqual([0, h.orbitY, 0]);
  expect(e.SpawnShape?.emitOffset?.constantValue).toEqual([h.radius, 0, 0]);
  expect(e.birthVelocity?.constantValue).toEqual([50, h.upwardVelocity, 0]);
  expect(e.birthVelocity?.dynamics?.probabilityTables).toEqual([
    { __type: 'VfxProbabilityTableData' },
    { __type: 'VfxProbabilityTableData', keyTimes: [0, 1], keyValues: [1, 2] },
    { __type: 'VfxProbabilityTableData' },
  ]);
  expect(e.particleLifetime.dynamics?.probabilityTables[0].keyTimes).toEqual([0, h.lifeKnot, 1]);
  expect(e.particleLifetime.dynamics?.probabilityTables[0].keyValues).toEqual(h.lifeFactors);
  expect(e.birthScale0.constantValue[0]).toBe(h.size);
  expect(e.birthScale0.dynamics?.probabilityTables?.[0].keyValues).toEqual([h.sizeMin, 1]);
  expect(e.SpawnShape).toMatchObject({
    emitRotationAngles: [{ dynamics: { probabilityTables: [{ keyValues: [0, 360] }] } }],
  });
  expect(e.isUniformScale).toBe(1);
  expect(source.data).not.toHaveProperty('flags');
});

it('shares the birth chance across lifetime, size, velocity and angle', () => {
  expect(luxHoopBirth(0)).toEqual({
    life: a.nominalLifetime * 0.5,
    velocityY: 200,
    velocityX: 0,
    velocityZ: 0,
    angle: 0,
    size: 30 * h.sizeMin,
  });
  const end = luxHoopBirth(1),
    middle = luxHoopBirth(h.lifeKnot);
  expect(end.life).toBe(a.nominalLifetime * 4);
  expect(end.size).toBe(30);
  expect(end.velocityY).toBe(400);
  expect(end.angle).toBe(Math.PI * 2);
  expect(middle.life).toBe(a.nominalLifetime * 1.5);
  expect(luxHoopChance(42, 1)).toBe(luxHoopChance(42, 1));
  expect(luxHoopChance(42, 1)).not.toBe(luxHoopChance(43, 1));
});

it('emits on the fixed grid and ages already-born particles after an explicit stop', () => {
  expect(luxHoopParticles(42, 0)).toEqual([]);
  expect(luxHoopParticles(42, 1 / 60).map((p) => p.ordinal)).toEqual([1, 2, 3]);
  expect(luxHoopParticles(42, 2 / 60).map((p) => p.ordinal)).toEqual([1, 2, 3, 4, 5, 6]);
  const stopped = luxHoopParticles(42, 0.12, 0.1);
  expect(stopped.length).toBeGreaterThan(0);
  expect(stopped.every((p) => p.birthTick <= 6)).toBe(true);
  expect(luxHoopParticles(42, 0.8, 0.1)).toEqual([]);
  expect(luxHoopParticles(42, 11)).toEqual([]);
});

it('matches iterative fixed-step drag and source-radian orbital position', () => {
  const p = luxHoopParticles(42, 4 / 60).find((p) => p.ordinal === 1)!;
  const birth = luxHoopBirth(luxHoopChance(42, 1));
  let velocity = birth.velocityY,
    height = 0;
  for (let i = 0; i < 3; i++) {
    velocity *= 1 - 2 / 60;
    height += velocity / 60;
  }
  expect(p.position[1]).toBeCloseTo(height, 12);
  expect(Math.hypot(p.position[0], p.position[2])).toBeCloseTo(10, 12);
  expect(p.position[0]).toBeCloseTo(10 * Math.cos(birth.angle + 2 * p.age), 12);
  const half = luxHoopParticles(42, 4.5 / 60).find((p) => p.ordinal === 1)!;
  expect(half.position[1]).toBeCloseTo(height + (velocity * (1 - 2 / 60)) / 120, 12);
});

it('reconstructs the same bounded live window after arbitrary seeks and JSON restoration', () => {
  const effect = { seed: 987, seconds: 0.31, stopSeconds: 0.5 };
  const initial = luxHoopParticles(effect.seed, effect.seconds, effect.stopSeconds);
  for (const time of [0.01, 9.9, 3, 0.1]) luxHoopParticles(effect.seed, time, effect.stopSeconds);
  const restored = JSON.parse(JSON.stringify(effect));
  expect(luxHoopParticles(restored.seed, restored.seconds, restored.stopSeconds)).toEqual(initial);
  for (let tick = 1; tick < 640; tick += 7) {
    const particles = luxHoopParticles(987, tick / 60);
    expect(particles.length).toBeLessThanOrEqual(124);
    expect(
      particles.every(
        (p) =>
          p.age >= 0 &&
          p.age < p.life &&
          p.lookup[0] >= 0 &&
          p.lookup[0] < 1 &&
          p.size > 0 &&
          p.position.every(Number.isFinite)
      )
    ).toBe(true);
  }
});
