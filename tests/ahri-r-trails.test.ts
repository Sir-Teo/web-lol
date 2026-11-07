import { expect, test } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import {
  ahriRParticles,
  AHRI_R_PROFILES as profiles,
  AHRI_R_BOUND_SPELL_PROFILES,
} from '../src/render/ahri-r-particles';
import { rVisualGroups, rVisualPose } from '../src/render/ahri-r-history';
import { rTrailPoints } from '../src/render/ahri-r-trails';
import { createRRibbonMaterial } from '../src/render/ahri-r-ribbon-material';
import { packedSourceTrailRibbon } from '../src/render/source-packed-trail-ribbon';
import { SourceParticleSurfaces } from '../src/render/source-particle-surfaces';
function setup(hidden = false) {
  const field = {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (p: { x: number; y: number }) => ({ ...p }),
    findPath: (_a: unknown, b: { x: number; y: number }) => [{ ...b }],
  };
  const w = new World(false, field);
  w.nextWaveTick = 1e9;
  Object.assign(w.hero, { ai: false, x: -3000, y: -3000, previous: { x: -3000, y: -3000 } });
  const source = w.spawn('champion', 'red', { x: 0, y: 0 }, 'ahri');
  source.ai = false;
  w.gainExperience(1e6, source.id);
  w.learnSpell('r', source.id);
  const target = w.spawn('champion', 'blue', { x: 600, y: 0 }, 'lux');
  Object.assign(target, { ai: false, hp: 10000, maxHp: 10000 });
  if (hidden) w.pointVisible = (_point, team) => team === 'red';
  w.enqueue({ type: 'cast', unit: source.id, ability: 'r', point: { x: 900, y: 0 } });
  w.step(13);
  const group = rVisualGroups(w.ahriRVisuals[0])[0];
  const sample = () =>
    ahriRParticles(
      group.system,
      group.seed,
      (w.tick - group.startTick) / 60,
      (group.stopTick - group.startTick) / 60,
      {
        boundObjectSize: 100,
        root: (time) => {
          const pose = rVisualPose(group, group.startTick + time * 60)!;
          return { ...pose, height: 300 };
        },
      }
    );
  return { w, group, sample };
}
const trailIndices = AHRI_R_BOUND_SPELL_PROFILES.filter(
  (index) => profiles[index].kind === 'trail'
);
test('five selected R trails retain finite packets, binding flags, flipbook cells and independent secondary UVs', () => {
  const { w, group, sample } = setup(),
    saved = w.snapshot();
  const points = rTrailPoints(group, sample(), () => 2, w.tick, 'red');
  expect(new Set(points.map((p) => p.profileIndex))).toEqual(new Set(trailIndices));
  expect(trailIndices).toHaveLength(5);
  let drawn = 0;
  for (const index of trailIndices) {
    const profile = profiles[index],
      rows = points.filter((p) => p.profileIndex === index);
    expect(rows.every((p) => p.visible)).toBe(true);
    const vertices = packedSourceTrailRibbon(
      rows,
      profile.trail!.cutoff ?? 0,
      profile.trail!.cameraFacing ? [0, 1, 1] : null,
      (profile.trail!.smoothing ?? 0) as 0 | 1 | 2
    );
    if (vertices.length) drawn++;
    for (const vertex of vertices)
      expect(
        [
          ...vertex.position,
          ...vertex.uv,
          ...vertex.cell,
          ...(vertex.multUv ?? []),
          ...vertex.color,
          ...vertex.lookup,
          vertex.erosion,
        ].every(Number.isFinite)
      ).toBe(true);
    expect(rows.every((row) => row.multUv !== null)).toBe(!!profile.multiplier);
  }
  expect(drawn).toBeGreaterThanOrEqual(3);
  expect(w.snapshot()).toBe(saved);
});
test('R trail placement matches shared surface placement for local, world-space and bound profiles', () => {
  const { w, group, sample } = setup(),
    particles = sample();
  const rows = particles
    .filter((p) => profiles[p.profileIndex].kind === 'trail')
    .sort((a, b) => a.profileIndex - b.profileIndex || a.ordinal - b.ordinal);
  const points = rTrailPoints(group, particles, () => 2, w.tick, 'red');
  const texture = new THREE.Texture();
  const surfaces = new SourceParticleSurfaces(new THREE.Scene(), new THREE.Scene(), () => 2, {
    name: 'R trail comparison',
    attachment: 'saved-R-flight-root',
    profiles: profiles.map((p) => ({
      ...p,
      kind: p.kind === 'trail' ? 'quad' : p.kind,
      // The quad proxy compares particle centers, not terrain projection.
      ground: p.kind === 'trail' ? false : p.ground,
      uvMode: 0,
      directionVelocityScale: p.directionVelocityScale ?? 0,
      soft: null,
    })),
    assets: () => ({
      texture: () => texture,
      mesh: () => {
        throw Error('Unexpected mesh');
      },
    }),
    accepts: (i) => trailIndices.includes(i),
    records: () => [{ sourceId: group.record.sourceId, castTick: group.startTick, group }],
    particles: () => rows,
    birthVisible: () => true,
    visible: () => true,
    pose: (g, tick) => rVisualPose(g, tick),
    attachmentPoint: (g, tick) => {
      const p = rVisualPose(g, tick)!;
      return new THREE.Vector3(p.x * 0.01, 3, p.y * 0.01);
    },
    missileFrame: () => true,
    particleFacing: (p, born, current) => (p.particleLocal ? current : born),
    sampledStretch: true,
  });
  surfaces.update(w, 1, new THREE.PerspectiveCamera());
  points.forEach((point, index) => {
    const particle = rows[index],
      mesh = surfaces.models.get(`${group.key}:${particle.profileIndex}:${particle.ordinal}`)!;
    expect(mesh).toBeDefined();
    mesh.position
      .toArray()
      .forEach((value, axis) => expect(value).toBeCloseTo(point.position[axis] * 0.01, 11));
  });
  surfaces.dispose();
  texture.dispose();
});
test('revealed R bound trails use current sight while old unbound births stay hidden', () => {
  const { w, group, sample } = setup(true);
  expect(rTrailPoints(group, sample(), () => 2, w.tick).every((p) => !p.visible)).toBe(true);
  w.pointVisible = () => true;
  w.step();
  const particles = sample(),
    points = rTrailPoints(group, particles, () => 2, w.tick);
  const bound = points.filter((p) => profiles[p.profileIndex].bind.constant[0] === 1);
  const rows = particles
    .filter((p) => profiles[p.profileIndex].kind === 'trail')
    .sort((a, b) => a.profileIndex - b.profileIndex || a.ordinal - b.ordinal);
  const oldUnbound = points.filter(
    (_p, index) =>
      rows[index].sourceBind === 0 && group.startTick + rows[index].bornTick < w.tick - 1
  );
  expect(bound.length).toBeGreaterThan(0);
  expect(bound.every((p) => p.visible)).toBe(true);
  expect(oldUnbound.length).toBeGreaterThan(0);
  expect(oldUnbound.every((p) => !p.visible)).toBe(true);
});
test('R ribbon materials retain flipbook, secondary UV and soft inputs while refusing deferred palette fields', () => {
  const texture = new THREE.Texture(),
    assets = { texture: () => texture, mesh: () => new THREE.BufferGeometry() };
  for (const index of trailIndices) {
    const p = profiles[index],
      material = createRRibbonMaterial(index, assets);
    expect(material.uniforms.sourceCellSize.value.toArray()).toEqual(
      p.uv.divisions.map((v) => 1 / v)
    );
    expect(!!material.defines.SOURCE_MULT).toBe(!!p.multiplier);
    expect(!!material.defines.SOURCE_SOFT).toBe(!!p.soft);
    expect(material.userData.unboundPalette).toBe(!!p.palette && !p.palette.texture);
    expect(material.depthWrite).toBe(false);
    material.dispose();
  }
  expect(() =>
    createRRibbonMaterial(
      profiles.findIndex((p) => p.system === 'Ahri_R_mis_02' && p.name === 'Ribbon_1'),
      assets
    )
  ).toThrow();
  texture.dispose();
});
