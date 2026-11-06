import { expect, test } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import {
  ahriQProjectileParticles,
  AHRI_Q_PROJECTILE_PROFILES as profiles,
} from '../src/render/ahri-q-projectile-particles';
import {
  qProjectileGroups,
  QProjectilePath,
  qProjectilePose,
} from '../src/render/ahri-q-projectile-history';
import { qProjectileTrailPoints } from '../src/render/ahri-q-projectile-trails';
import { createQProjectileRibbonMaterial } from '../src/render/ahri-q-projectile-ribbon-material';
import { packedSourceTrailRibbon } from '../src/render/source-packed-trail-ribbon';
function setup(ticks: number) {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
  Object.assign(w.hero, { ai: false, x: -3000, y: -3000 });
  w.nextWaveTick = 1e9;
  const ahri = w.spawn('champion', 'red', { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  w.learnSpell('q', ahri.id);
  w.enqueue({ type: 'cast', unit: ahri.id, ability: 'q', point: { x: 900, y: 0 } });
  w.step(ticks);
  const record = w.ahriQProjectileVisuals[0];
  const group = qProjectileGroups(record).at(-1)!;
  const particles = ahriQProjectileParticles(
    group.role,
    group.seed,
    (w.tick - group.startTick) / 60,
    (group.stopTick - group.startTick) / 60
  );
  return { w, record, group, particles, path: new QProjectilePath(record) };
}
test('all ten authored trails produce finite independent base/mult packets in source centimetres', () => {
  const seen = new Set<number>();
  for (const tick of [40, 90]) {
    const { w, group, particles, path } = setup(tick);
    const before = w.snapshot();
    const points = qProjectileTrailPoints(group, particles, path, () => 2, 'red');
    for (const point of points) {
      seen.add(point.profileIndex);
      expect(point.visible).toBe(true);
      expect(
        [
          ...Array.from(point.position),
          ...Array.from(point.side),
          point.halfWidth,
          point.odometer,
        ].every(Number.isFinite)
      ).toBe(true);
      expect(point.odometer).toBeGreaterThanOrEqual(0);
    }
    for (const index of new Set(points.map((p) => p.profileIndex))) {
      const profile = profiles[index],
        raw = points.filter((p) => p.profileIndex === index);
      const vertices = packedSourceTrailRibbon(
        raw,
        profile.trail!.cutoff ?? 0,
        profile.trail!.cameraFacing ? [1, 2, -3] : null,
        (profile.trail!.smoothing ?? 0) as 0 | 1 | 2
      );
      expect(vertices.length).toBeGreaterThan(0);
      expect(
        vertices.every((v) => [...v.position, ...v.uv, ...v.color].every(Number.isFinite))
      ).toBe(true);
      if (profile.multiplier) expect(vertices.some((v) => v.multUv![0] !== v.uv[0])).toBe(true);
    }
    expect(w.snapshot()).toBe(before);
  }
  expect(seen.size).toBe(10);
});
test('straight outgoing placement matches the analytic reflected missile frame and leaves world acceleration upright', () => {
  const { group, particles, path } = setup(40);
  const point = qProjectileTrailPoints(group, particles, path, () => 2, 'red')[0];
  const p = particles.find((p) => p.profileIndex === point.profileIndex)!;
  const born = qProjectilePose(group.record, group.startTick + p.bornTick)!;
  expect(born.facing).toBe(Math.PI / 2);
  expect(point.position[0]).toBeCloseTo(born.x + p.offset[1] - (p.worldOffset?.[0] ?? 0), 8);
  expect(point.position[1]).toBeCloseTo(290 - p.offset[2] + (p.worldOffset?.[1] ?? 0), 8);
  expect(point.position[2]).toBeCloseTo(born.y + p.offset[0] + (p.worldOffset?.[2] ?? 0), 8);
});
test('unseen birth points remain separators when their root later enters sight', () => {
  const { group, particles, path, record } = setup(40);
  for (const frame of record.frames)
    frame.audience =
      (frame.tick >= 18 && frame.tick <= 23) || frame.tick >= 32 ? ['blue', 'red'] : ['red'];
  const points = qProjectileTrailPoints(group, particles, path, () => 0);
  expect(points.some((p) => p.visible)).toBe(true);
  expect(points.some((p) => !p.visible)).toBe(true);
  for (const index of new Set(points.map((p) => p.profileIndex))) {
    const held = points.filter((p) => p.profileIndex === index);
    for (let i = 1; i < held.length; i++)
      expect(held[i].odometer).toBeGreaterThanOrEqual(held[i - 1].odometer);
  }
});
test('every trail material binds source erosion and independent secondary sampling while borrowing textures', () => {
  const textures = new Map<string, THREE.Texture>();
  let disposed = 0;
  const assets = {
    texture: (path: string, address = 0) => {
      const key = path + ':' + address;
      if (!textures.has(key)) {
        const texture = new THREE.Texture();
        texture.addEventListener('dispose', () => disposed++);
        textures.set(key, texture);
      }
      return textures.get(key)!;
    },
    mesh: () => new THREE.BufferGeometry(),
  };
  for (const [index, p] of profiles.entries()) {
    if (p.kind !== 'trail') continue;
    const m = createQProjectileRibbonMaterial(index, assets);
    expect(m.uniforms.erosionTexture.value).toBe(
      assets.texture(p.erosion!.texture, p.erosion!.address)
    );
    expect(m.uniforms.erosionParameters.value.y).toBe(p.erosion!.sliceWidth);
    expect(m.blendDst).toBe(p.blend === 1 ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor);
    expect(m.fragmentShader).toContain('particleErosion - value');
    expect(m.vertexShader).toContain('multUv = sourceMultUv;');
    if (p.multiplier) {
      expect(m.defines.SOURCE_QUAD_SECONDARY_UV).toBe(1);
      expect(m.uniforms.multiplierTexture.value).toBe(
        assets.texture(p.multiplier.texture, p.multiplier.uv.address)
      );
    }
    m.dispose();
    expect(disposed).toBe(0);
  }
  expect(() => createQProjectileRibbonMaterial(0, assets)).toThrow('Unsupported');
});
