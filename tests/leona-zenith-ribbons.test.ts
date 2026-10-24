import { expect, test } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { LeonaZenithRibbons } from '../src/render/leona-zenith-ribbons';
import { zenithTrailPoints } from '../src/render/leona-zenith-trails';
import { zenithMissileTrailPoints } from '../src/render/leona-zenith-trail-frame';
import { zenithDrawGroups, zenithPoseAt } from '../src/render/leona-zenith-history';

function fixture() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    lineWalkable: () => true,
    findPath: (_a, b) => [{ ...b }],
    reachable: (p) => ({ ...p }),
  });
  w.nextWaveTick = Infinity;
  w.hero.x = 300;
  w.hero.y = -100;
  const u = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona'),
    t = w.spawn('champion', 'red', { x: 800, y: 0 }, 'lux');
  t.hp = t.maxHp = 100000;
  for (const unit of w.units) unit.ai = false;
  w.learnSpell('e', u.id);
  const scene = new THREE.Scene(),
    distortion = new THREE.Scene(),
    texture = new THREE.Texture(),
    geometry = new THREE.BoxGeometry(1, 1, 1),
    assets = { texture: () => texture, mesh: () => geometry },
    view = new LeonaZenithRibbons(scene, () => 2, assets),
    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 10, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  w.enqueue({ type: 'cast', unit: u.id, ability: 'e', point: { x: 900, y: 0 } });
  w.step();
  const capture = () => {
    view.update(w, 1);
    return frame(view);
  };
  return {
    w,
    u,
    t,
    scene,
    distortion,
    texture,
    geometry,
    assets,
    view,
    camera,
    capture,
    dispose: () => {
      view.dispose();
      texture.dispose();
      geometry.dispose();
    },
  };
}
function frame(view: LeonaZenithRibbons) {
  return [...view.models].map(([key, m]) => ({
    key,
    profile: m.userData.profileIndex,
    count: m.geometry.drawRange.count,
    attributes: Object.fromEntries(
      Object.entries(m.geometry.attributes).map(([name, a]) => [
        name,
        Array.from(a.array.slice(0, m.geometry.drawRange.count * a.itemSize)),
      ])
    ),
    palette: m.material.uniforms.paletteRow?.value,
  }));
}

test('both source trails draw finite dynamic vertices and exact palette/lookup inputs without World mutation', () => {
  const f = fixture();
  f.w.step(29);
  const before = f.w.snapshot(),
    result = f.capture();
  expect(result.map((m) => m.profile)).toEqual([11, 14]);
  expect(
    result.every((m) => m.count > 6 && Object.values(m.attributes).flat().every(Number.isFinite))
  ).toBe(true);
  expect(result[0].palette).toBe(9.5 / 16);
  expect(result[1].palette).toBeUndefined();
  expect(new Set(result[0].attributes.particleLookupUv).size).toBeGreaterThan(2);
  expect(new Set(result[0].attributes.particleTint).size).toBeGreaterThan(4);
  const model = [...f.view.models.values()][0],
    geometry = model.geometry;
  expect(model.material.blendSrc).toBe(THREE.SrcAlphaFactor);
  expect(model.material.blendDst).toBe(THREE.OneFactor);
  expect(model.material.uniforms.depthPushPull.value).toBe(0);
  expect(f.capture()).toEqual(result);
  expect([...f.view.models.values()][0].geometry).toBe(geometry);
  expect(f.w.snapshot()).toBe(before);
  f.dispose();
});
test('missile adapter turns authored offsets around each saved birth while preserving width and odometer', () => {
  const f = fixture();
  f.w.step(29);
  const group = zenithDrawGroups(f.u.id, f.w.championState(f.u.id)!.leonaEVisuals[0]).find(
    (g) => g.role === 'weapon'
  )!;
  for (const facing of [0, Math.PI / 2, -0.7]) {
    const turned = { ...group, frames: group.frames.map((p) => ({ ...p, facing })) };
    const raw = zenithTrailPoints(turned, f.w.tick, false, 'blue', () => 200),
      saved = JSON.stringify(raw);
    const adapted = zenithMissileTrailPoints(turned, raw, () => 200);
    for (let i = 0; i < raw.length; i++) {
      const a = raw[i],
        b = adapted[i],
        born = zenithPoseAt(turned.frames, a.bornTick)!;
      // Independently authored offsets: profile11 [0,0,-40], profile14 [0,50,-40].
      // In the missile frame source Y advances along travel, and -Z raises height.
      const forward = a.profileIndex === 14 ? 50 : 0;
      expect(b.position[0]).toBeCloseTo(born.x + Math.sin(facing) * forward, 9);
      expect(b.position[1]).toBeCloseTo(240, 9);
      expect(b.position[2]).toBeCloseTo(born.y + Math.cos(facing) * forward, 9);
      expect(b.side[0]).toBeCloseTo(-Math.cos(facing), 9);
      expect(b.side[1]).toBeCloseTo(0, 9);
      expect(b.side[2]).toBeCloseTo(Math.sin(facing), 9);
      expect([b.halfWidth, b.wakeU, b.uvOffset, b.uvScale, b.color, b.lookup]).toEqual([
        a.halfWidth,
        a.wakeU,
        a.uvOffset,
        a.uvScale,
        a.color,
        a.lookup,
      ]);
    }
    expect(JSON.stringify(raw)).toBe(saved);
  }
  f.dispose();
});
test('save/reload seeks retain exact ribbon arrays through hit, dash, stopped missile tails and expiry', () => {
  const f = fixture();
  f.w.step(29);
  const copy = World.fromSnapshot(f.w.snapshot(), f.w.battlefield),
    other = new LeonaZenithRibbons(new THREE.Scene(), () => 2, f.assets);
  for (const n of [0, 8, 8, 8, 10, 20, 100]) {
    f.w.step(n);
    copy.step(n);
    f.capture();
    other.update(copy, 1);
    expect(frame(other)).toEqual(frame(f.view));
    expect(copy.snapshot()).toBe(f.w.snapshot());
  }
  expect(f.view.models.size).toBe(0);
  other.dispose();
  f.dispose();
});
test('historically hidden births split ribbons and present vision can suppress/recreate exact visible tails', () => {
  const f = fixture();
  f.w.step(29);
  const full = f.capture();
  const flight = f.w.championState(f.u.id)!.leonaEVisuals[0].flight!;
  for (const p of flight.frames.slice(5, 10)) p.audience = ['red'];
  const split = f.capture();
  expect(split.map((m) => m.count).every((n, i) => n < full[i].count)).toBe(true);
  const visible = f.w.pointVisible.bind(f.w);
  f.w.pointVisible = () => false;
  expect(f.capture()).toEqual([]);
  f.w.pointVisible = visible;
  expect(f.capture()).toEqual(split);
  f.dispose();
});
test('owned buffers/materials expire once and borrowed images survive caster death and terminal drain', () => {
  const f = fixture();
  f.w.step(29);
  f.capture();
  const models = [...f.view.models.values()];
  let geometries = 0,
    materials = 0,
    images = 0;
  for (const m of models) {
    m.geometry.addEventListener('dispose', () => geometries++);
    m.material.addEventListener('dispose', () => materials++);
  }
  f.texture.addEventListener('dispose', () => images++);
  f.w.damage(f.t, f.u, 1e9, 'true');
  f.w.step(2);
  f.capture();
  f.w.winner = 'blue';
  const frozen = f.w.snapshot();
  f.view.update(f.w, 1, 2);
  expect(f.w.snapshot()).toBe(frozen);
  expect(f.view.models.size).toBe(0);
  expect([geometries, materials, images]).toEqual([2, 2, 0]);
  f.view.dispose();
  expect([geometries, materials, images]).toEqual([2, 2, 0]);
  f.dispose();
});

test('growing ribbon storage disposes every replaced geometry and final buffers exactly once', () => {
  const f = fixture(),
    seen = new Map<THREE.BufferGeometry, number>();
  for (const tick of [16, 18, 20, 24, 29, 34, 38]) {
    f.w.step(tick - f.w.tick);
    f.capture();
    for (const model of f.view.models.values()) {
      if (!seen.has(model.geometry)) {
        const geometry = model.geometry;
        seen.set(geometry, 0);
        geometry.addEventListener('dispose', () => seen.set(geometry, seen.get(geometry)! + 1));
      }
    }
  }
  expect(seen.size).toBeGreaterThan(2);
  expect([...seen.values()].some((n) => n === 1)).toBe(true);
  f.w.step(200);
  f.capture();
  expect([...seen.values()].every((n) => n === 1)).toBe(true);
  f.dispose();
  expect([...seen.values()].every((n) => n === 1)).toBe(true);
});
