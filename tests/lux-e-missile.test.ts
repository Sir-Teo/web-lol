import { expect, test, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import profiles from '../src/content/lux-e-field.json';
import staticProfiles from '../src/content/lux-e-particles.json';
import coverage from '../docs/reference/lux-e-particle-coverage.json';
import pin from '../docs/reference/lux-e-vfx.json';
import {
  luxEFieldParticles,
  LUX_E_FIELD_BIRTHS,
  luxEFlightOrigin,
} from '../src/render/lux-e-field-particles';
import { sampleEmitterValue } from '../src/render/particle-emitter-value';
import { luxHoopChance } from '../src/render/lux-hoop-particles';
import { LuxEFieldCloud } from '../src/render/lux-e-field';
import { luxEParticles } from '../src/render/lux-e-particles';
import { particleAtlasUv } from '../src/render/particle-atlas';
import { luxESlashTemplates } from './helpers/lux-e-slash';

const hash = (x: string | Buffer) => createHash('sha256').update(x).digest('hex');
test('the fifteen existing streams preserve 24 full sampler snapshots', () => {
  const samples = (['ally', 'enemy'] as const).flatMap((role) =>
    [91, 927].flatMap((seed) =>
      [0, 0.1, 0.5, 1, 2.5, 4.8].map((age) => ({
        role,
        seed,
        age,
        particles: luxEFieldParticles(role, seed, age).filter((q) => q.profileIndex < 15),
      }))
    )
  );
  expect(hash(JSON.stringify(samples))).toBe(
    '09b53b57121711b36aef97f538295b21e5f04e53bcbfb34cde19450118d628df'
  );
});

test('base skin excludes the required-keyword missile glow and includes the excluded-keyword nova flash', () => {
  const entries = coverage.inventory as any[];
  expect(entries.filter((x) => x.status === 'filtered for base skin')).toHaveLength(1);
  const skipped = entries.find((x) => x.record === 'Lux_E_mis' && x.index === 1);
  expect(skipped.filtering).toEqual({
    required: ['SteelLegionLux'],
    excluded: [],
    included: [],
    keywords: [],
    enabled: false,
  });
  const flash = entries.find((x) => x.record === 'Lux_E_tar_nova' && x.index === 6);
  expect(flash.filtering).toEqual({
    required: [],
    excluded: ['SteelLegionLux'],
    included: [],
    keywords: [],
    enabled: true,
  });
  expect(staticProfiles.at(-1)).toMatchObject({
    record: 'Lux_E_tar_nova',
    index: 6,
    life: 0.10000000149011612,
    offset: [0, 0, 0],
    size: { value: [600, 600, 600] },
  });
  expect(entries.filter((x) => x.status === 'deferred')).toHaveLength(9);
  expect(coverage.rendered).toBe(55);
  expect(
    luxEParticles('burst', 91, 0.1).some((q) => staticProfiles[q.profileIndex].index === 6)
  ).toBe(true);
  expect(
    luxEParticles('burst', 91, 7 / 60).some((q) => staticProfiles[q.profileIndex].index === 6)
  ).toBe(false);
});

test('spinner conversion preserves all expanded face UVs and three-dimensional source extents', () => {
  const audit = JSON.parse(readFileSync('public/assets/models/lux-e-slash.json', 'utf8'));
  expect(hash(readFileSync('public/' + audit.output.path))).toBe(audit.output.sha256);
  expect(audit.source.sha256).toBe(pin.meshes.find((m) => m.path.endsWith('slash.scb'))!.sha256);
  expect(audit.vertices).toBe(119);
  expect(audit.triangles).toBe(192);
  expect(audit.validation).toEqual({ errors: 0, warnings: 0, roundTripAttributesExact: true });
  const geometry = [...luxESlashTemplates().values()][0];
  expect(geometry.getAttribute('position').count).toBe(576);
  expect(hash(Buffer.from(geometry.getAttribute('uv').array.buffer))).toBe(audit.uvFloat32Sha256);
  geometry.computeBoundingBox();
  expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeGreaterThan(0.18);
  geometry.dispose();
});

test('motes retain rate probability metadata while the reader rate budget emits nine births', () => {
  for (const role of ['flight', 'ally']) {
    const i = profiles.findIndex((p) => p.role === role && p.name === 'motes');
    expect(profiles[i].rate.probabilities![0].values).toEqual([0.20000000298023224, 1]);
    expect(LUX_E_FIELD_BIRTHS[i]).toEqual([1, 8, 12, 16, 20, 24, 28, 32, 36]);
    expect(profiles[i].bind.values[0][0]).toBeCloseTo(0.95);
    expect(profiles[i].sphereRadius).toBe(40);
  }
  expect(luxEFlightOrigin(1100, 0).z).toBe(20);
  expect(luxEFlightOrigin(1100, 0.5).z).toBeCloseTo(620, 10);
  expect(luxEFlightOrigin(1100, 1).z).toBe(1100);
});

test('moving motes partially follow the saved missile path before orbit and gain world Y after orbit', () => {
  const random = vi.spyOn(Math, 'random');
  try {
    const seed = 91,
      age = 0.4,
      path = (t: number) => luxEFlightOrigin(1100, t);
    const stationary = luxEFieldParticles('flight', seed, age);
    const moving = luxEFieldParticles('flight', seed, age, path);
    for (const q of moving.filter((q) => profiles[q.profileIndex].name === 'motes')) {
      const p = profiles[q.profileIndex],
        same = stationary.find(
          (s) => s.profileIndex === q.profileIndex && s.ordinal === q.ordinal
        )!;
      const weight = sampleEmitterValue(p.bind, q.emitterPhase, q.chance)[0];
      const orbit = sampleEmitterValue(p.orbit, q.emitterPhase, q.chance).map((v) => v * q.age);
      const correction = path(q.birthSeconds)
        .sub(path(age))
        .multiplyScalar(1 - weight)
        .applyEuler(new THREE.Euler(orbit[0], orbit[1], orbit[2], 'YXZ'));
      q.position.forEach((v, a) =>
        expect(v - same.position[a]).toBeCloseTo(correction.getComponent(a), 9)
      );
      expect(q.travel[2] - same.travel[2]).toBeCloseTo(1200 * weight, 8);
      // Sphere's radial and angular channels are independent of birth properties.
      const emitterSeed = seed ^ Math.imul(p.index + 1, 0x85ebca6b);
      const radius = luxHoopChance(emitterSeed ^ 0x3c6ef372, q.ordinal) * 40;
      const offset = new THREE.Vector3(radius, 0, 0)
        .applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          luxHoopChance(emitterSeed ^ 0x1bf5a9d3, q.ordinal) * Math.PI * 2
        )
        .applyAxisAngle(
          new THREE.Vector3(0, 0, 1),
          luxHoopChance(emitterSeed ^ 0x6a09e667, q.ordinal) * Math.PI * 2
        )
        .applyEuler(new THREE.Euler(orbit[0], orbit[1], orbit[2], 'YXZ'));
      expect(offset.length()).toBeCloseTo(radius, 9);
      expect(same.position[1] - offset.y).toBeCloseTo(5 * q.age * q.life, 9);
    }
    luxEFieldParticles('flight', 17, 0.8, path);
    expect(luxEFieldParticles('flight', seed, age, path)).toEqual(moving);
    expect(random).not.toHaveBeenCalled();
  } finally {
    random.mockRestore();
  }
});

test('mesh batches preserve source XYZ and atlas UVs, reverse seeks, fog and borrowed template ownership', () => {
  const templates = luxESlashTemplates(),
    template = [...templates.values()][0];
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const textures = new Map(
    profiles
      .flatMap((p) => [p.texture, p.lookup, p.mult, p.palette?.texture ?? ''])
      .map((p) => [p, texture])
  );
  const cloud = new LuxEFieldCloud('flight', textures, templates);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(8, 12, 10);
  camera.lookAt(0, 0, 0);
  let visible = (_p: { x: number; y: number }) => true;
  const draw = (age: number) =>
    cloud.draw(
      { pointVisible: (p: { x: number; y: number }) => visible(p) } as any,
      91,
      age,
      { x: 0, y: 0 },
      { x: -600, y: 0 },
      { x: 0, y: 0 },
      'red',
      camera,
      () => 0
    );
  const capture = () =>
    cloud.meshes.map((m) => ({
      attrs: Object.fromEntries(
        Object.entries(m.geometry.attributes).map(([k, a]) => [k, Array.from(a.array)])
      ),
      index: Array.from(m.geometry.index!.array),
      count: m.geometry.drawRange.count,
    }));
  const particles = draw(0.3),
    mesh = cloud.meshes.find((m) => profiles[m.userData.fieldProfileIndex].primitive === 'mesh')!;
  expect(cloud.meshes).toHaveLength(3);
  expect(mesh.userData.particleVertexCount).toBe(576);
  const q = particles.find((q) => q.profileIndex === mesh.userData.fieldProfileIndex)!,
    p = profiles[q.profileIndex];
  const rotation = new THREE.Euler(
    ...(q.rotation.map((v) => (v * Math.PI) / 180) as [number, number, number]),
    'YXZ'
  );
  for (const i of [0, 1, 2, 101, 575]) {
    const v = new THREE.Vector3()
      .fromBufferAttribute(template.getAttribute('position'), i)
      .multiplyScalar(100)
      .multiply(new THREE.Vector3(...q.scale))
      .applyEuler(rotation)
      .add(new THREE.Vector3(...q.position));
    const a = mesh.geometry.getAttribute('position');
    expect(p.local).toBe(false);
    expect(a.getX(i)).toBeCloseTo(-v.x * 0.01, 5);
    expect(a.getY(i)).toBeCloseTo(1 + v.y * 0.01, 5);
    expect(a.getZ(i)).toBeCloseTo(v.z * 0.01, 5);
    const uv = template.getAttribute('uv'),
      out = mesh.geometry.getAttribute('uv');
    const expected = particleAtlasUv(
      p.atlas.grid[0],
      p.atlas.grid[1],
      q.frame,
      uv.getX(i),
      uv.getY(i)
    );
    expect(out.getX(i)).toBeCloseTo(expected[0], 6);
    expect(out.getY(i)).toBeCloseTo(expected[1], 6);
  }
  const before = capture();
  draw(1.3);
  draw(0.3);
  expect(capture()).toEqual(before);
  visible = (p) => p.x < 0;
  draw(0.3);
  for (const m of cloud.meshes)
    for (let i = 0; i < m.geometry.drawRange.count; i++) {
      const vertex = m.geometry.index!.getX(i);
      expect(m.geometry.getAttribute('position').getX(vertex)).toBeLessThan(0);
    }
  expect(cloud.meshes.some((m) => m.geometry.drawRange.count > 0)).toBe(true);
  expect(cloud.meshes.some((m, i) => m.geometry.drawRange.count < before[i].count)).toBe(true);
  visible = () => false;
  draw(0.3);
  expect(cloud.meshes.every((m) => m.geometry.drawRange.count === 0)).toBe(true);
  draw(3);
  expect(cloud.meshes.every((m) => m.userData.liveParticles === 0)).toBe(true);
  expect(cloud.meshes.every((m) => !m.visible)).toBe(true);
  let disposed = 0,
    borrowed = 0;
  template.addEventListener('dispose', () => borrowed++);
  texture.addEventListener('dispose', () => borrowed++);
  for (const m of cloud.meshes) {
    m.geometry.addEventListener('dispose', () => disposed++);
    m.material.addEventListener('dispose', () => disposed++);
  }
  cloud.dispose();
  expect(disposed).toBe(6);
  expect(borrowed).toBe(0);
  template.dispose();
  texture.dispose();
});

test('the stateless flight origin agrees with saved simulation positions and fractional render interpolation', async () => {
  const { World } = await import('../src/simulation/world');
  const { PRACTICE_FIXTURE } = await import('../src/content/practice-fixture');
  for (const point of [
    { x: 377, y: 224 },
    { x: 1100, y: 0 },
    { x: -200, y: -300 },
  ]) {
    const world = new World(false, PRACTICE_FIXTURE);
    world.nextWaveTick = Infinity;
    const lux = world.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    world.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point });
    world.step(16);
    const saved = World.fromSnapshot(world.snapshot(), world.battlefield);
    while (world.singularities[0].arrivalTick === null) {
      const zone = world.singularities[0];
      const dx = zone.point.x - zone.origin.x,
        dy = zone.point.y - zone.origin.y,
        length = Math.hypot(dx, dy);
      for (const alpha of [0.25, 0.75, 1]) {
        const elapsed = (world.tick - 1 + alpha - zone.launchTick) / 60;
        const distance = luxEFlightOrigin(length, elapsed).z;
        expect(zone.previous.x + (zone.x - zone.previous.x) * alpha).toBeCloseTo(
          zone.origin.x + (dx / length) * distance,
          8
        );
        expect(zone.previous.y + (zone.y - zone.previous.y) * alpha).toBeCloseTo(
          zone.origin.y + (dy / length) * distance,
          8
        );
      }
      world.step();
      saved.step();
      expect(saved.singularities).toEqual(world.singularities);
    }
  }
});
