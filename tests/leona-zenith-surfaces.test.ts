import { expect, test } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { LeonaZenithSurfaces } from '../src/render/leona-zenith-surfaces';
import { zenithSurfaceAccepted } from '../src/render/leona-zenith-surface-profiles';
import { ZENITH_PROFILES, zenithParticles } from '../src/render/leona-zenith-particles';
import { zenithDrawGroups, zenithPoseAt } from '../src/render/leona-zenith-history';

const supported = [1, 2, 3, 4, 6, 7, 8, 9, 10, 12, 13, 15, 16, 17, 19];
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
    view = new LeonaZenithSurfaces(scene, distortion, () => 0, assets),
    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 10, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  w.enqueue({ type: 'cast', unit: u.id, ability: 'e', point: { x: 900, y: 0 } });
  w.step();
  const capture = () => {
    view.update(w, 1, camera);
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
function frame(view: LeonaZenithSurfaces) {
  return [...view.models].map(([id, m]) => ({
    id,
    ...m.userData,
    profileIndex: m.userData.profileIndex as number,
    bornTick: m.userData.bornTick as number,
    position: m.position.toArray(),
    quaternion: m.quaternion.toArray(),
    scale: m.scale.toArray(),
    tint: m.material.uniforms.particleColor.value.toArray(),
    uv: m.material.uniforms.sourceUvTransform.value.toArray(),
    mult: m.material.uniforms.multiplierUvTransform.value.toArray(),
    lookup: m.material.uniforms.lookupUv.value.toArray(),
    erosion: m.material.uniforms.erosionParameters?.value.toArray(),
    vertices: m.userData.ownedGeometry ? [...m.geometry.getAttribute('position').array] : null,
  }));
}

test('all fifteen supported source families draw across contact, dash and moving flight without World mutation', () => {
  const f = fixture(),
    seen = new Set<number>();
  expect(ZENITH_PROFILES.map((_p, i) => i).filter(zenithSurfaceAccepted)).toEqual(supported);
  for (let i = 0; i < 150; i++) {
    f.w.step();
    const before = i % 15 === 0 ? f.w.snapshot() : null;
    for (const p of f.capture()) {
      seen.add(p.profileIndex);
      expect([...p.position, ...p.scale, ...p.quaternion, ...p.tint].every(Number.isFinite)).toBe(
        true
      );
    }
    if (before) expect(f.w.snapshot()).toBe(before);
  }
  expect([...seen].sort((a, b) => a - b)).toEqual(supported);
  f.dispose();
});
test('saved moving flight and following dash/contact restore exact transforms, UVs and ground geometry', () => {
  const f = fixture();
  f.w.step(29);
  const saved = f.w.snapshot(),
    before = f.capture(),
    copy = World.fromSnapshot(saved, f.w.battlefield),
    other = new LeonaZenithSurfaces(new THREE.Scene(), new THREE.Scene(), () => 0, f.assets);
  other.update(copy, 1, f.camera);
  expect(frame(other)).toEqual(before);
  expect(copy.snapshot()).toBe(saved);
  for (const steps of [15, 15, 15, 30]) {
    f.w.step(steps);
    copy.step(steps);
    f.capture();
    other.update(copy, 1, f.camera);
    expect(frame(other)).toEqual(frame(f.view));
  }
  other.dispose();
  f.dispose();
});
test('SCB meshes remain borrowed, projected ground geometry is owned, and the reflective sword is excluded', () => {
  const f = fixture();
  f.w.step(30);
  f.capture();
  const models = [...f.view.models.values()];
  expect(models.some((m) => m.userData.sourceMesh)).toBe(true);
  expect(models.some((m) => m.userData.ownedGeometry)).toBe(true);
  for (const m of models) {
    const p = ZENITH_PROFILES[m.userData.profileIndex];
    expect(p.reflection).toBeNull();
    if (p.kind === 'mesh') expect(m.geometry).toBe(f.geometry);
    if (p.ground) {
      expect(m.userData.ownedGeometry).toBe(true);
      expect(m.position.toArray()).toEqual([0, 0, 0]);
    }
    expect(m.userData.attachment).toBe('saved-phase-root');
  }
  f.dispose();
});
test('hidden moving births remain hidden while later visible births can draw and current vision culls them', () => {
  const f = fixture();
  f.w.step(29);
  const flight = f.w.championState(f.u.id)!.leonaEVisuals[0].flight!,
    cut = flight.frames[5].tick;
  for (const p of flight.frames) if (p.tick <= cut) p.audience = ['red'];
  const models = f.capture();
  expect(models.length).toBeGreaterThan(0);
  expect(models.every((m) => m.bornTick > cut)).toBe(true);
  const visible = f.w.pointVisible.bind(f.w);
  f.w.pointVisible = () => false;
  expect(f.capture()).toEqual([]);
  f.w.pointVisible = visible;
  expect(f.capture()).toEqual(models);
  f.dispose();
});
test('expiry releases each material and owned ground buffer while preserving shared source resources', () => {
  const f = fixture();
  f.w.step(30);
  f.capture();
  const models = [...f.view.models.values()],
    owned = models.filter((m) => m.userData.ownedGeometry);
  let materials = 0,
    geometry = 0,
    borrowed = 0;
  for (const m of models) m.material.addEventListener('dispose', () => materials++);
  for (const m of owned) m.geometry.addEventListener('dispose', () => geometry++);
  for (const r of [f.texture, f.geometry]) r.addEventListener('dispose', () => borrowed++);
  f.w.step(240);
  f.capture();
  expect(f.view.models.size).toBe(0);
  expect([materials, geometry, borrowed]).toEqual([models.length, owned.length, 0]);
  f.view.dispose();
  expect(materials).toBe(models.length);
  f.dispose();
});

test('world acceleration stays vertical outside the missile frame and direction stretching uses the combined world velocity', () => {
  const f = fixture();
  f.w.step(29);
  f.capture();
  const model = [...f.view.models.values()].find((m) => m.userData.profileIndex === 17)!,
    visual = f.w.championState(f.u.id)!.leonaEVisuals[0],
    group = zenithDrawGroups(f.u.id, visual).find((g) => g.role === 'weapon')!,
    raw = zenithParticles(
      group.role,
      group.seed,
      (f.w.tick - group.startTick) / 60,
      (group.stopTick - group.startTick) / 60,
      group.radius
    ).find((p) => p.profileIndex === 17 && p.ordinal === model.userData.ordinal)!,
    born = zenithPoseAt(group.frames, group.startTick + raw.bornTick)!,
    a = 40,
    rise = a * raw.phase * raw.life * raw.life,
    c = Math.cos(born.facing),
    s = Math.sin(born.facing),
    [x, y, z] = raw.offset;
  expect(ZENITH_PROFILES[17].acceleration.constant).toEqual([0, a, 0]);
  expect(model.position.x).toBeCloseTo((born.x - x * c + (y - rise) * s) * 0.01, 8);
  expect(model.position.y).toBeCloseTo((-z + rise) * 0.01, 8);
  expect(model.position.z).toBeCloseTo((born.y + x * s + (y - rise) * c) * 0.01, 8);
  const [vx, vy, vz] = raw.travel,
    speed = Math.hypot(
      -vx * c + (vy - a * raw.life) * s,
      -vz + a * raw.life,
      vx * s + (vy - a * raw.life) * c
    ),
    stretch = Math.max(1, speed * ZENITH_PROFILES[17].directionVelocityScale);
  expect(model.scale.y).toBeCloseTo(raw.size[1] * stretch * 0.01, 8);
  f.dispose();
});
