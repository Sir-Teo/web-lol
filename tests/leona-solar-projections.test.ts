import { expect, test } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { LeonaSolarProjections } from '../src/render/leona-solar-projections';
import { solarProjectionFrame } from '../src/render/leona-solar-projection-frame';
import { solarParticles } from '../src/render/leona-solar-particles';
import { ParticleDecalReceivers } from '../src/render/particle-decal-receivers';

function fixture(team: 'blue' | 'red' = 'blue') {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    lineWalkable: () => true,
    findPath: (_a, b) => [{ ...b }],
    reachable: (p) => ({ ...p }),
  });
  w.nextWaveTick = Infinity;
  w.hero.x = -100;
  w.hero.y = 0;
  const u = w.spawn('champion', team, { x: 0, y: 0 }, 'leona');
  for (const unit of w.units) unit.ai = false;
  w.gainExperience(2400, u.id);
  w.learnSpell('r', u.id);
  w.enqueue({ type: 'cast', unit: u.id, ability: 'r', point: { x: 500, y: 0 } });
  w.step(20);
  const geometry = new THREE.BufferGeometry()
      .setAttribute(
        'position',
        new THREE.Float32BufferAttribute([-20, 0, -20, 20, 4, -20, 20, 8, 20, -20, 4, 20], 3)
      )
      .setIndex([0, 2, 1, 0, 3, 2]),
    material = new THREE.MeshBasicMaterial(),
    root = new THREE.Mesh(geometry, material),
    receivers = new ParticleDecalReceivers([root], () => true, 8),
    scene = new THREE.Scene(),
    texture = new THREE.Texture(),
    assets = { texture: () => texture },
    ground = (p: { x: number; y: number }) => 4 + 0.001 * (p.x + p.y),
    view = new LeonaSolarProjections(scene, ground, receivers, assets);
  return {
    w,
    u,
    geometry,
    material,
    root,
    receivers,
    scene,
    texture,
    assets,
    ground,
    view,
    capture() {
      view.update(w, 1);
      return frame(view);
    },
    release() {
      view.dispose();
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
function frame(view: LeonaSolarProjections) {
  return [...view.models].map(([key, m]) => ({
    key,
    ...m.userData,
    profileIndex: m.userData.profileIndex as number,
    corners: m.geometry.drawRange.count,
    positions: Array.from(
      m.geometry.getAttribute('position').array.slice(0, m.geometry.drawRange.count * 3)
    ),
    world: m.material.uniforms.decalWorld.value.toArray(),
    mapping: m.material.uniforms.worldToUv.value.toArray(),
    height: m.material.uniforms.heightRange.value.toArray(),
    color: m.material.uniforms.particleColor.value.toArray(),
    lookup: m.material.uniforms.lookupUv.value.toArray(),
  }));
}

test('complex projector turn uses row-major basis0/6, preserving sampled Y rotation and explicit reflected UV', () => {
  const particle = solarParticles('area-green', 1, 0.1).find((p) => p.profileIndex === 12)!;
  for (const yaw of [0, 30, 90, 180, 270, 300]) {
    const p = { ...particle, rotation: [-90, yaw, 0] },
      r = solarProjectionFrame(p, [7, 3, -4], { mYRange: 500, mFading: 500 });
    expect(Math.sin(r.footprint.turn)).toBeCloseTo(-Math.sin((yaw * Math.PI) / 180), 6);
    expect(Math.cos(r.footprint.turn)).toBeCloseTo(Math.cos((yaw * Math.PI) / 180), 6);
    expect(r.footprint.reflectX).toBe(true);
    expect(r.footprint.center).toEqual([7, 3, -4]);
    expect(r.heightRange).toEqual([3, 5, 5]);
    expect(r.footprint.halfWidth).toBe(p.size[0] * 0.01);
    expect(r.footprint.halfHeight).toBe(p.size[2] * 0.01);
  }
});

test('each team draws exactly one fixed-area native-derived projection on actual sloped receiver triangles', () => {
  for (const team of ['blue', 'red'] as const) {
    const f = fixture(team),
      before = f.w.snapshot(),
      result = f.capture();
    expect(result).toHaveLength(1);
    expect(result[0].profileIndex).toBe(team === 'blue' ? 12 : 18);
    expect(result[0].height).toEqual([4.5, 5, 5]);
    expect(result[0].world).toEqual(new THREE.Matrix4().toArray());
    for (let i = 0; i < result[0].positions.length; i += 3) {
      const [x, y, z] = result[0].positions.slice(i, i + 3);
      expect(y).toBeCloseTo(4 + 0.1 * (x + z), 5);
      const uv = new THREE.Vector3(x, y, z).applyMatrix4(
        new THREE.Matrix4().fromArray(result[0].mapping)
      );
      expect(uv.x).toBeGreaterThanOrEqual(-1e-6);
      expect(uv.x).toBeLessThanOrEqual(1 + 1e-6);
      expect(uv.z).toBeGreaterThanOrEqual(-1e-6);
      expect(uv.z).toBeLessThanOrEqual(1 + 1e-6);
    }
    const model = [...f.view.models.values()][0];
    expect(model.geometry).not.toBe(f.geometry);
    expect(model.geometry.getAttribute('normal')).toBeUndefined();
    expect([
      model.material.depthTest,
      model.material.depthWrite,
      model.material.transparent,
      model.material.stencilWrite,
    ]).toEqual([false, false, false, false]);
    expect(model.material.uniforms.alphaRef).toBeUndefined();
    expect(f.w.snapshot()).toBe(before);
    f.release();
  }
});

test('saved projection seeks reproduce the active receiving geometry, UV matrix, height and lookup exactly', () => {
  const f = fixture(),
    before = f.capture(),
    saved = f.w.snapshot(),
    copy = World.fromSnapshot(saved, f.w.battlefield),
    other = new LeonaSolarProjections(new THREE.Scene(), f.ground, f.receivers, f.assets);
  other.update(copy, 1);
  expect(frame(other)).toEqual(before);
  for (const steps of [3, 7, 9, 30]) {
    f.w.step(steps);
    copy.step(steps);
    f.capture();
    other.update(copy, 1);
    expect(frame(other)).toEqual(frame(f.view));
  }
  expect(other.models.size).toBe(0);
  other.dispose();
  f.release();
});

test('fixed-point creation/birth/current vision stay independent of caster visibility and movement', () => {
  const f = fixture(),
    r = f.w.championState(f.u.id)!.leonaRVisuals[0];
  r.castFrame.audience = [];
  for (const frame of r.frames) frame.audience = [];
  expect(f.capture()).toHaveLength(1);
  const before = f.capture();
  Object.assign(f.u, { x: 3000, y: 3000 });
  expect(f.capture()).toEqual(before);
  r.areaAudience = [];
  expect(f.capture()).toEqual([]);
  r.areaAudience = ['blue'];
  const birth = r.frames.find((p) => p.tick === r.startTick + 1)!;
  birth.areaAudience = [];
  expect(f.capture()).toEqual([]);
  birth.areaAudience = ['blue'];
  expect(f.capture()).toHaveLength(1);
  f.w.pointVisible = () => false;
  expect(f.capture()).toEqual([]);
  f.release();
});

test('expiry releases owned receiving buffers/materials and preserves terrain and image resources', () => {
  const f = fixture();
  f.capture();
  const model = [...f.view.models.values()][0];
  let geometry = 0,
    material = 0,
    borrowed = 0;
  model.geometry.addEventListener('dispose', () => geometry++);
  model.material.addEventListener('dispose', () => material++);
  for (const r of [f.geometry, f.material, f.texture])
    r.addEventListener('dispose', () => borrowed++);
  f.w.step(100);
  f.capture();
  expect(f.view.models.size).toBe(0);
  expect([geometry, material, borrowed]).toEqual([1, 1, 0]);
  f.view.dispose();
  expect(material).toBe(1);
  f.release();
});

test('terminal display drains a frozen finite projector without changing saved gameplay', () => {
  const f = fixture();
  f.w.winner = 'blue';
  const saved = f.w.snapshot();
  f.view.update(f.w, 1);
  expect(f.view.models.size).toBe(1);
  f.view.update(f.w, 1, 1);
  expect(f.view.models.size).toBe(0);
  expect(f.w.snapshot()).toBe(saved);
  f.release();
});
