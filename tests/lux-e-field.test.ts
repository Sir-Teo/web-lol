import { expect, test, vi } from 'vitest';
import { luxESlashTemplates } from './helpers/lux-e-slash';
import * as THREE from 'three';
import profiles from '../src/content/lux-e-field.json';
import pin from '../docs/reference/lux-e-vfx.json';
import coverage from '../docs/reference/lux-e-particle-coverage.json';
import { emitterBirthTicks, sampleEmitterValue } from '../src/render/particle-emitter-value';
import { luxEmissionCount } from '../src/content/lux-emission';
import { LUX_E_FIELD_BIRTHS, luxEFieldParticles } from '../src/render/lux-e-field-particles';
import { LuxEFieldCloud } from '../src/render/lux-e-field';

test('all field primitive records preserve their source types, single bursts and raw constant anomalous curves', () => {
  expect(profiles).toHaveLength(20);
  expect(profiles.filter((p) => p.primitive === 'ray')).toHaveLength(4);
  expect(profiles.filter((p) => p.primitive === 'quad')).toHaveLength(6);
  expect(profiles.filter((p) => p.single)).toHaveLength(2);
  expect(profiles.filter((p) => p.single).map((p) => p.name)).toEqual([
    'END_Beam_ROTATING',
    'END_Beam_ROTATING',
  ]);
  for (const p of profiles) {
    const e = (pin.definitions as any)[p.record].complexEmitterDefinitionData[p.index];
    expect(p.name).toBe(e.emitterName);
    expect(p.emitterLife).toBe(e.lifetime);
    expect(p.single).toBe(!!e.isSingleParticle);
    if (p.primitive === 'ray') expect(e.primitive.__type).toBe('VfxPrimitiveRay');
  }
  const anomalous = profiles.filter((p) => p.name === 'Glow_Center' || p.name === 'Glow_Center1');
  for (const p of anomalous) {
    const raw = (pin.definitions as any)[p.record].complexEmitterDefinitionData[p.index].scale0
      .dynamics;
    expect(p.scale.times).toEqual(raw.times);
    expect(p.scale.values).toEqual(raw.values);
    expect(p.scale.times[2]).toBeLessThan(p.scale.times[1]);
    for (const phase of [0, 0.25, 0.6, 1])
      expect(sampleEmitterValue(p.scale, phase, 0.5)).toEqual([2, 2, 2]);
  }
});

test('ten rotating quads are born immediately and integrate source angular/UV rates on their particle clock', () => {
  const index = profiles.findIndex((p) => p.role === 'ally' && p.single),
    p = profiles[index];
  expect(LUX_E_FIELD_BIRTHS[index]).toEqual(Array(10).fill(0));
  const born = luxEFieldParticles('ally', 91, 0).filter((q) => q.profileIndex === index);
  const next = luxEFieldParticles('ally', 91, 1 / 60).filter((q) => q.profileIndex === index);
  expect(born).toHaveLength(10);
  expect(next).toHaveLength(10);
  for (let i = 0; i < 10; i++) {
    const rate = sampleEmitterValue(p.rotationRate, 1 / 60 / 6, born[i].chance)[0];
    expect(next[i].rotation[0] - born[i].rotation[0]).toBeCloseTo(150 / 60 + rate, 9);
    expect(next[i].multOffset[0] - born[i].multOffset[0]).toBeCloseTo(-1 / 21600, 10);
    expect(born[i].multScale).toEqual([0.10000000149011612, 1]);
    expect(born[i].birthSeconds).toBe(0);
  }
  expect(p.uvRotation).toBe(90);
});

test('center-glow multiplier offsets keep independent birth values and accumulated lifetime scroll', () => {
  const samples = luxEFieldParticles('ally', 91, 2.5).filter(
    (q) => profiles[q.profileIndex].name === 'Glow_Center'
  );
  expect(samples.length).toBeGreaterThan(2);
  for (const q of samples) {
    const p = profiles[q.profileIndex],
      origin = sampleEmitterValue(p.multOffset, q.emitterPhase, q.chance),
      n = Math.floor(q.age * 60),
      f = q.age * 60 - n;
    const expected = (-0.5 * ((n * (n + 1)) / 2 + f * (n + 1))) / (3600 * q.life);
    expect(q.multOffset[0] - origin[0]).toBeCloseTo(expected, 10);
    expect(q.multOffset[1]).toBe(origin[1]);
  }
});

test('field rays retain full source width and length along their reflected transformed axis', () => {
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const textures = new Map(
    profiles
      .flatMap((p) => [p.texture, p.lookup, p.mult, p.palette?.texture ?? ''])
      .map((p) => [p, texture])
  );
  const cloud = new LuxEFieldCloud('ally', textures, luxESlashTemplates()),
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(8, 12, 10);
  camera.lookAt(0, 0, 0);
  const particles = cloud.draw(
    { pointVisible: () => true } as any,
    91,
    0.5,
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 600, y: 0 },
    'blue',
    camera,
    () => 0
  );
  for (const mesh of cloud.meshes.filter(
    (m) => profiles[m.userData.fieldProfileIndex].primitive === 'ray'
  )) {
    const selected = particles.filter((q) => q.profileIndex === mesh.userData.fieldProfileIndex),
      a = mesh.geometry.getAttribute('position');
    expect(selected.length).toBeGreaterThan(0);
    selected.forEach((q, slot) => {
      const rotation = new THREE.Euler(
        ...(q.rotation.map((v) => (v * Math.PI) / 180) as [number, number, number]),
        'YXZ'
      );
      const axis = new THREE.Vector3(0, 0, 1).applyEuler(rotation);
      axis.x *= -1;
      const vertices = Array.from({ length: 6 }, (_, i) =>
        new THREE.Vector3().fromBufferAttribute(a, slot * 6 + i)
      );
      const along = vertices.map((v) => v.dot(axis));
      expect(Math.max(...along) - Math.min(...along)).toBeCloseTo(q.scale[1] * 0.01, 5);
      expect(vertices[0].distanceTo(vertices[1])).toBeCloseTo(q.scale[0] * 0.01, 5);
    });
  }
  cloud.dispose();
  texture.dispose();
});

test('ground-glow quads follow transformed source corners and sampled terrain rather than billboard axes', () => {
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const textures = new Map(
    profiles
      .flatMap((p) => [p.texture, p.lookup, p.mult, p.palette?.texture ?? ''])
      .map((p) => [p, texture])
  );
  const cloud = new LuxEFieldCloud('ally', textures, luxESlashTemplates()),
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000),
    ground = (p: { x: number; y: number }) => (p.x + p.y) / 1000;
  camera.position.set(8, 12, 10);
  camera.lookAt(0, 0, 0);
  cloud.draw(
    { pointVisible: () => true } as any,
    91,
    2.5,
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 600, y: 0 },
    'blue',
    camera,
    ground
  );
  for (const mesh of cloud.meshes.filter(
    (m) => profiles[m.userData.fieldProfileIndex].primitive === 'quad'
  )) {
    const position = mesh.geometry.getAttribute('position');
    expect(mesh.userData.liveParticles).toBeGreaterThan(0);
    for (let i = 0; i < mesh.userData.liveParticles * 6; i++)
      expect(
        position.getY(i) - ground({ x: position.getX(i) * 100, y: position.getZ(i) * 100 })
      ).toBeCloseTo(0, 6);
  }
  cloud.dispose();
  texture.dispose();
});

test('four field streams retain animated source values, independent team tint and palette/atlas metadata', () => {
  expect(profiles.slice(0, 4).map((p) => [p.role, p.index, p.name])).toEqual([
    ['ally', 5, 'WaveRight'],
    ['ally', 6, 'sparks'],
    ['enemy', 11, 'WaveRight'],
    ['enemy', 15, 'sparks'],
  ]);
  for (const p of profiles.slice(0, 4)) {
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
  expect(coverage.rendered).toBe(56);
  expect(coverage.inventory.filter((x) => x.status === 'deferred')).toHaveLength(8);
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
  expect(LUX_E_FIELD_BIRTHS.slice(0, 4).map((x) => x.length)).toEqual([126, 90, 126, 90]);
  expect(LUX_E_FIELD_BIRTHS.slice(0, 4).every((x) => x[0] === 1)).toBe(true);
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
    expect(luxEFieldParticles('ally', 91, 7.1)).toEqual([]);
    expect(random).not.toHaveBeenCalled();
  } finally {
    random.mockRestore();
  }
});
test('each field owns one source batch per field emitter, seeks buffers exactly, filters triangles and disposes borrowed resources correctly', () => {
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const textures = new Map(
    profiles
      .flatMap((p) => [p.texture, p.lookup, p.mult, p.palette?.texture ?? ''])
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
  expect(cloud.meshes).toHaveLength(7);
  draw(2.5);
  const before = cloud.meshes.map((m) => Array.from(m.geometry.getAttribute('position').array));
  draw(4.8);
  draw(2.5);
  expect(cloud.meshes.map((m) => Array.from(m.geometry.getAttribute('position').array))).toEqual(
    before
  );
  expect(cloud.meshes.filter((m) => m.geometry.drawRange.count > 0)).toHaveLength(7);
  expect(
    cloud.meshes
      .filter((m) => profiles[m.userData.fieldProfileIndex].ground)
      .every((m) => !m.material.transparent && !m.material.depthTest && !m.material.depthWrite)
  ).toBe(true);
  seen = false;
  draw(2.5);
  expect(cloud.meshes.every((m) => m.geometry.drawRange.count === 0)).toBe(true);
  let disposed = 0,
    borrowed = 0;
  texture.addEventListener('dispose', () => borrowed++);
  for (const m of cloud.meshes) {
    m.geometry.addEventListener('dispose', () => disposed++);
    m.material.addEventListener('dispose', () => disposed++);
  }
  cloud.dispose();
  expect(disposed).toBe(14);
  expect(borrowed).toBe(0);
  texture.dispose();
});
