import { expect, test } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { ahriEParticles, AHRI_E_PROFILES as profiles } from '../src/render/ahri-e-particles';
import { eVisualGroups, eVisualPose } from '../src/render/ahri-e-history';
import { eTrailPoints } from '../src/render/ahri-e-trails';
import { createERibbonMaterial } from '../src/render/ahri-e-ribbon-material';
import { packedSourceTrailRibbon } from '../src/render/source-packed-trail-ribbon';
function setup(ticks: number) {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  Object.assign(w.hero, { ai: false, x: -3000, y: -3000 });
  w.nextWaveTick = 1e9;
  const ahri = w.spawn('champion', 'red', { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  const target = w.spawn('champion', 'blue', { x: 800, y: 0 }, 'lux');
  Object.assign(target, { ai: false, hp: 10000, maxHp: 10000 });
  w.learnSpell('e', ahri.id);
  w.enqueue({ type: 'cast', unit: ahri.id, ability: 'e', point: { x: 900, y: 0 } });
  w.step(ticks);
  const record = w.ahriEVisuals[0];
  const group = eVisualGroups(record).find((g) => g.role === 'flight')!;
  const particles = ahriEParticles(
    group.system,
    group.seed,
    (w.tick - group.startTick) / 60,
    (group.stopTick - group.startTick) / 60
  );
  return { w, record, group, particles };
}
test('all three authored E trails produce finite independent base/mult packets in source centimetres', () => {
  const seen = new Set<number>();
  for (const tick of [25, 35]) {
    const { w, group, particles } = setup(tick);
    const before = w.snapshot();
    const points = eTrailPoints(group, particles, () => 2, 'red');
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
  expect(seen.size).toBe(3);
});
test('straight outgoing placement matches the analytic reflected missile frame and leaves world acceleration upright', () => {
  const { group, particles } = setup(35);
  const point = eTrailPoints(group, particles, () => 2, 'red')[0];
  const p = particles.find((p) => p.profileIndex === point.profileIndex)!;
  const born = eVisualPose(group, group.startTick + p.bornTick)!;
  const c = Math.cos(born.facing),
    s = Math.sin(born.facing);
  expect(point.position[0]).toBeCloseTo(
    born.x - p.offset[0] * c + p.offset[1] * s - (p.worldOffset?.[0] ?? 0),
    8
  );
  expect(point.position[1]).toBeCloseTo(300 - p.offset[2] + (p.worldOffset?.[1] ?? 0), 8);
  expect(point.position[2]).toBeCloseTo(
    born.y + p.offset[0] * s + p.offset[1] * c + (p.worldOffset?.[2] ?? 0),
    8
  );
});
test('unseen birth points remain separators when their root later enters sight', () => {
  const { group, particles } = setup(35);
  for (const frame of group.record.flightFrames)
    frame.audience =
      (frame.tick >= 17 && frame.tick <= 20) || frame.tick >= 24 ? ['blue', 'red'] : ['red'];
  const points = eTrailPoints(group, particles, () => 0);
  expect(points.some((p) => p.visible)).toBe(true);
  expect(points.some((p) => !p.visible)).toBe(true);
  for (const index of new Set(points.map((p) => p.profileIndex))) {
    const held = points.filter((p) => p.profileIndex === index);
    for (let i = 1; i < held.length; i++)
      expect(held[i].odometer).toBeGreaterThanOrEqual(held[i - 1].odometer);
  }
});
test('every trail material binds source erosion and packed coordinates while borrowing textures', () => {
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
    const m = createERibbonMaterial(index, assets);
    if (p.erosion) {
      expect(m.uniforms.erosionTexture.value).toBe(
        assets.texture(p.erosion.texture, p.erosion.address)
      );
      expect(m.uniforms.erosionParameters.value.y).toBe(p.erosion.sliceWidth);
    }
    expect(m.blendDst).toBe(p.blend === 1 ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor);
    expect(m.fragmentShader).toContain('particleErosion - value');
    expect(m.vertexShader).toContain('multUv = sourceMultUv;');
    expect(m.defines.SOURCE_MULT).toBeUndefined();
    m.dispose();
    expect(disposed).toBe(0);
  }
  expect(() => createERibbonMaterial(0, assets)).toThrow('Unsupported');
});
