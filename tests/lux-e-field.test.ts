import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import profiles from '../src/content/lux-e-field.json';
import pin from '../docs/reference/lux-e-vfx.json';
import coverage from '../docs/reference/lux-e-particle-coverage.json';
import { emitterBirthTicks, sampleEmitterValue } from '../src/render/particle-emitter-value';
import { luxEmissionCount } from '../src/content/lux-emission';
import { LUX_E_FIELD_BIRTHS, luxEFieldParticles } from '../src/render/lux-e-field-particles';
import { LuxEFieldCloud } from '../src/render/lux-e-field';

test('four field streams retain animated source values, independent team tint and palette/atlas metadata', () => {
  expect(profiles.map((p) => [p.role, p.index, p.name])).toEqual([
    ['ally', 5, 'WaveRight'],
    ['ally', 6, 'sparks'],
    ['enemy', 11, 'WaveRight'],
    ['enemy', 15, 'sparks'],
  ]);
  for (const p of profiles) {
    const e = (pin.definitions as any)[p.record].complexEmitterDefinitionData[p.index];
    expect(p.rate.times).toEqual(e.rate.dynamics.times);
    expect(p.rate.values.flat()).toEqual(e.rate.dynamics.values);
    expect(p.life.times).toEqual(e.particleLifetime.dynamics.times);
    expect(p.life.values.flat()).toEqual(e.particleLifetime.dynamics.values);
    expect(p.blend).toBe(e.blendMode ?? 0);
  }
  expect(profiles[1].atlas).toEqual({ grid: [2, 2], frames: 4, random: true });
  expect(profiles[1].palette?.row).toBe(0.25);
  expect(profiles[1].birthColor.values).not.toEqual(profiles[3].birthColor.values);
  expect(coverage.rendered).toBe(27);
  expect(coverage.inventory.filter((x) => x.status === 'deferred')).toHaveLength(38);
});
test('animated rate budgets keep exact crossings and agree with the existing constant scheduler', () => {
  for (const rate of [0, 0.1, 15, 25, 140]) {
    const births = emitterBirthTicks(
      { times: [0, 1], values: [[rate], [rate]], probabilities: null },
      1.5
    );
    for (let tick = 0; tick <= 90; tick++)
      expect(births.filter((t) => t <= tick).length).toBe(luxEmissionCount(rate, tick, 1.5));
  }
  expect(LUX_E_FIELD_BIRTHS.map((x) => x.length)).toEqual([126, 90, 126, 90]);
  expect(LUX_E_FIELD_BIRTHS.every((x) => x[0] === 1)).toBe(true);
  expect(LUX_E_FIELD_BIRTHS[0].at(-1)).toBeLessThan(275);
  expect(() => emitterBirthTicks({ ...profiles[0].rate, probabilities: [] }, 5)).toThrow(
    /deterministic/
  );
});
test('birth values sample emitter age while each surviving particle ages independently', () => {
  const life = profiles[0].life;
  expect(sampleEmitterValue(life, 0, 0)[0]).toBeCloseTo(0.7 * 0.5);
  expect(sampleEmitterValue(life, 1, 1)[0]).toBeCloseTo(0.21);
  expect(sampleEmitterValue(profiles[1].velocity, 0, 1)[1]).toBe(300);
  expect(sampleEmitterValue(profiles[1].velocity, 1, 1)[1]).toBe(500);
  const samples = luxEFieldParticles('ally', 91, 2.5);
  expect(samples.length).toBeGreaterThan(5);
  for (const q of samples) {
    const p = profiles[q.profileIndex];
    expect(q.emitterPhase).toBe(q.birthSeconds / p.emitterLife);
    expect(q.age).toBe(2.5 - q.birthSeconds);
    expect(q.life).toBe(sampleEmitterValue(p.life, q.emitterPhase, q.chance)[0]);
    expect(q.age).toBeLessThan(q.life);
    expect(
      [...q.position, ...q.scale, ...q.color, ...q.rotation, q.stretch].every(Number.isFinite)
    ).toBe(true);
  }
});
test('arbitrary seeks preserve births, motion, tint and all four atlas cells without global RNG', () => {
  const random = vi.spyOn(Math, 'random');
  try {
    expect(luxEFieldParticles('ally', 1, -1)).toEqual([]);
    expect(luxEFieldParticles('ally', 1, NaN)).toEqual([]);
    const at = luxEFieldParticles('ally', 91, 3.1);
    luxEFieldParticles('enemy', 88, 4.8);
    expect(luxEFieldParticles('ally', 91, 3.1)).toEqual(at);
    expect(luxEFieldParticles('ally', 92, 3.1)).not.toEqual(at);
    expect(new Set(at.filter((q) => q.profileIndex === 1).map((q) => q.frame)).size).toBe(4);
    expect(luxEFieldParticles('ally', 91, 6.3)).toEqual([]);
    expect(random).not.toHaveBeenCalled();
  } finally {
    random.mockRestore();
  }
});
test('each field owns exactly two source batches, seeks buffers exactly, filters triangles and disposes borrowed resources correctly', () => {
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const textures = new Map(
    profiles
      .flatMap((p) => [p.texture, p.lookup, p.palette?.texture ?? ''])
      .map((p) => [p, texture])
  );
  const cloud = new LuxEFieldCloud('enemy', textures),
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(8, 12, 10);
  camera.lookAt(0, 0, 0);
  let seen = true;
  const world = { pointVisible: () => seen } as any;
  const draw = (age: number) =>
    cloud.draw(
      world,
      91,
      age,
      { x: 0, y: 0 },
      { x: -600, y: 0 },
      { x: 0, y: 0 },
      'red',
      camera,
      () => 0
    );
  expect(cloud.meshes).toHaveLength(2);
  draw(2.5);
  const before = cloud.meshes.map((m) => Array.from(m.geometry.getAttribute('position').array));
  draw(4.8);
  draw(2.5);
  expect(cloud.meshes.map((m) => Array.from(m.geometry.getAttribute('position').array))).toEqual(
    before
  );
  expect(cloud.meshes.every((m) => m.geometry.drawRange.count > 0)).toBe(true);
  expect(
    cloud.meshes.every(
      (m) => !m.material.transparent && !m.material.depthTest && !m.material.depthWrite
    )
  ).toBe(true);
  seen = false;
  draw(2.5);
  expect(cloud.meshes.map((m) => m.geometry.drawRange.count)).toEqual([0, 0]);
  let disposed = 0,
    borrowed = 0;
  texture.addEventListener('dispose', () => borrowed++);
  for (const m of cloud.meshes) {
    m.geometry.addEventListener('dispose', () => disposed++);
    m.material.addEventListener('dispose', () => disposed++);
  }
  cloud.dispose();
  expect(disposed).toBe(4);
  expect(borrowed).toBe(0);
  texture.dispose();
});
