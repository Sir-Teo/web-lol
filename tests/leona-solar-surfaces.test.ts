import { expect, test } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { LeonaSolarSurfaces } from '../src/render/leona-solar-surfaces';
import { solarSurfaceAccepted } from '../src/render/leona-solar-surface-profiles';
import { SOLAR_PROFILES, solarParticles } from '../src/render/leona-solar-particles';
import { solarDrawGroups } from '../src/render/leona-solar-history';
import { zenithPoseAt } from '../src/render/leona-zenith-history';
import { solarDrawPoint } from '../src/render/leona-solar-frame';

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
  Object.assign(w.hero, { x: -100, y: 0 });
  const u = w.spawn('champion', team, { x: 0, y: 0 }, 'leona'),
    t = w.spawn('champion', team === 'blue' ? 'red' : 'blue', { x: 500, y: 0 }, 'lux');
  t.hp = t.maxHp = 100000;
  for (const unit of w.units) unit.ai = false;
  w.gainExperience(2400, u.id);
  w.learnSpell('r', u.id);
  const scene = new THREE.Scene(),
    distortion = new THREE.Scene(),
    early = new THREE.Scene(),
    texture = new THREE.Texture(),
    geometry = new THREE.BoxGeometry(1, 1, 1),
    assets = { texture: () => texture, mesh: () => geometry },
    view = new LeonaSolarSurfaces(scene, distortion, () => 2, assets, early),
    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 10, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  w.enqueue({ type: 'cast', unit: u.id, ability: 'r', point: t });
  w.step();
  return {
    w,
    u,
    t,
    view,
    scene,
    distortion,
    early,
    geometry,
    texture,
    assets,
    camera,
    capture() {
      view.update(w, 1, camera);
      return frame(view);
    },
    dispose() {
      view.dispose();
      texture.dispose();
      geometry.dispose();
    },
  };
}
function frame(view: LeonaSolarSurfaces) {
  return [...view.models].map(([id, m]) => ({
    id,
    ...m.userData,
    role: m.userData.role as string,
    profileIndex: m.userData.profileIndex as number,
    bornTick: m.userData.bornTick as number,
    position: m.position.toArray(),
    quaternion: m.quaternion.toArray(),
    scale: m.scale.toArray(),
    packetColor: Array.from(m.geometry.getAttribute('_source_vertex_bgra')?.array ?? []),
    tint: m.material.uniforms.particleColor.value.toArray(),
    uv: m.material.uniforms.sourceUvTransform?.value.toArray(),
    lookup: m.material.uniforms.lookupUv.value.toArray(),
    vertices: m.userData.ownedGeometry
      ? Array.from(m.geometry.getAttribute('position')?.array ?? [])
      : null,
  }));
}

test('all38 supported R families draw across both area alternatives with finite inputs and no saved mutation', () => {
  const seen = new Set<number>();
  expect(SOLAR_PROFILES.map((_p, i) => i).filter(solarSurfaceAccepted)).toHaveLength(38);
  expect(SOLAR_PROFILES.map((_p, i) => i).filter((i) => !solarSurfaceAccepted(i))).toEqual([
    0, 1, 2, 3, 12, 18,
  ]);
  for (const team of ['blue', 'red'] as const) {
    const f = fixture(team);
    for (let i = 0; i < 180; i++) {
      f.w.step();
      const before = i % 30 === 0 ? f.w.snapshot() : null;
      for (const p of f.capture()) {
        seen.add(p.profileIndex);
        expect(
          [...p.position, ...p.scale, ...p.quaternion, ...p.tint, ...(p.vertices ?? [])].every(
            Number.isFinite
          )
        ).toBe(true);
        expect(SOLAR_PROFILES[p.profileIndex].role).not.toBe(
          team === 'blue' ? 'area-red' : 'area-green'
        );
      }
      if (before) expect(f.w.snapshot()).toBe(before);
    }
    f.dispose();
  }
  expect([...seen].sort((a, b) => a - b)).toEqual(
    SOLAR_PROFILES.map((_p, i) => i).filter(solarSurfaceAccepted)
  );
});

test('saved moving caster and target restore exact root, fixed-area, contact and orbital transforms', () => {
  const f = fixture();
  f.w.setOrder(f.u, { type: 'move', point: { x: 0, y: 1000 } });
  f.w.step(42);
  const saved = f.w.snapshot(),
    before = f.capture(),
    copy = World.fromSnapshot(saved, f.w.battlefield),
    other = new LeonaSolarSurfaces(
      new THREE.Scene(),
      new THREE.Scene(),
      () => 2,
      f.assets,
      new THREE.Scene()
    );
  other.update(copy, 1, f.camera);
  expect(frame(other)).toEqual(before);
  for (const steps of [3, 8, 19, 60]) {
    f.w.step(steps);
    copy.step(steps);
    f.capture();
    other.update(copy, 1, f.camera);
    expect(frame(other)).toEqual(frame(f.view));
  }
  other.dispose();
  f.dispose();
});

test('pinned65a7 world orbit is reflected after root orientation and before acceleration; stretch stays raw', () => {
  const f = fixture();
  f.w.step(45);
  f.capture();
  const model = [...f.view.models.values()].find((m) => m.userData.profileIndex === 43)!,
    r = f.w.championState(f.u.id)!.leonaRVisuals[0],
    group = solarDrawGroups(f.u.id, f.u.team, r).find((g) => g.role === 'impact')!,
    raw = solarParticles(group.role, group.seed, (f.w.tick - group.startTick) / 60).find(
      (p) => p.profileIndex === 43 && p.ordinal === model.userData.ordinal
    )!,
    born = group.origin ?? zenithPoseAt(group.frames, group.startTick + raw.bornTick)!,
    now = group.origin ?? zenithPoseAt(group.frames, f.w.tick)!,
    facing = born.facing,
    c = Math.cos(facing),
    s = Math.sin(facing),
    [x, y, z] = raw.offset,
    origin = { x: born.x + (now.x - born.x) * raw.bind, y: born.y + (now.y - born.y) * raw.bind },
    // Source-handed world coordinates are the X mirror of renderer coordinates.
    point = [-(origin.x - x * c + z * s), 200 + y, origin.y + x * s + z * c],
    expected = solarDrawPoint(raw, point, [-now.x, 200, now.y]);
  expect(raw.orbitTurn.slice(0, 3).some((v) => v !== 0)).toBe(true);
  expect(model.position.x).toBeCloseTo(-expected[0] * 0.01, 8);
  expect(model.position.y).toBeCloseTo(expected[1] * 0.01, 8);
  expect(model.position.z).toBeCloseTo(expected[2] * 0.01, 8);
  expect(model.scale.y).toBeCloseTo(raw.size[1] * raw.stretch * 0.01, 8);
  f.dispose();
});

test('creation, each birth and current point vision gate fixed areas independently of the caster', () => {
  const f = fixture();
  f.w.step(45);
  const r = f.w.championState(f.u.id)!.leonaRVisuals[0];
  r.castFrame.audience = [];
  for (const p of r.frames) p.audience = [];
  expect(f.capture().some((m) => m.role === 'impact')).toBe(true);
  expect(f.capture().some((m) => m.role === 'cast' || m.role === 'buff')).toBe(false);
  const impactBirth = r.impact!.tick + 1;
  for (const p of r.frames) if (p.tick === impactBirth) p.areaAudience = [];
  expect(
    f
      .capture()
      .filter((m) => m.role === 'impact')
      .every((m) => m.bornTick !== impactBirth)
  ).toBe(true);
  r.impact!.audience = [];
  expect(f.capture().some((m) => m.role === 'impact')).toBe(false);
  f.w.pointVisible = () => false;
  expect(f.capture()).toEqual([]);
  f.dispose();
});

test('cancelled windup has no impact/contact and posthumous release keeps the actual delayed impact', () => {
  for (const released of [false, true]) {
    const f = fixture();
    if (released) f.w.step(15);
    f.w.damage(f.t, f.u, 100000, 'true');
    f.w.step(45);
    f.capture();
    const r = f.w.championState(f.u.id)!.leonaRVisuals[0],
      groups = solarDrawGroups(f.u.id, f.u.team, r);
    expect(groups.some((g) => g.role === 'impact')).toBe(released);
    expect(groups.some((g) => g.role === 'contact')).toBe(released);
    expect(f.capture().some((m) => m.role === 'impact')).toBe(released);
    expect(r.death).not.toBeNull();
    f.dispose();
  }
});

test('owned geometry/materials retire while borrowed resources survive; mode2 uses a separate early list', () => {
  const f = fixture();
  f.w.step(45);
  f.capture();
  const models = [...f.view.models.values()],
    owned = models.filter((m) => m.userData.ownedGeometry);
  expect(owned.length).toBeGreaterThan(0);
  expect(models.some((m) => m.userData.sourceMesh)).toBe(true);
  expect(f.distortion.children.length).toBe(2);
  expect(f.early.children.length).toBe(3);
  let material = 0,
    geometry = 0,
    borrowed = 0;
  for (const m of models) {
    m.material.addEventListener('dispose', () => material++);
    const p = SOLAR_PROFILES[m.userData.profileIndex];
    if (p.distortion) expect(m.parent).toBe(p.distortion.mode === 2 ? f.early : f.distortion);
    else expect(m.parent).toBe(f.scene);
    if (p.kind === 'mesh') expect(m.geometry).toBe(f.geometry);
    expect(m.material.stencilWrite).toBe(false);
  }
  for (const m of owned) m.geometry.addEventListener('dispose', () => geometry++);
  for (const r of [f.texture, f.geometry]) r.addEventListener('dispose', () => borrowed++);
  f.w.step(1000);
  f.capture();
  expect(f.view.models.size).toBe(0);
  expect([material, geometry, borrowed]).toEqual([models.length, owned.length, 0]);
  f.dispose();
});

test('terminal display age permits delayed visible impact births and retires them without stepping frozen gameplay', () => {
  const f = fixture(),
    impactTick = f.w.championState(f.u.id)!.leonaR!.impactTick;
  f.w.step(impactTick - f.w.tick);
  f.w.winner = 'blue';
  const saved = f.w.snapshot();
  f.view.update(f.w, 1, f.camera, 0.2);
  expect(
    [...f.view.models.values()].some(
      (m) => m.userData.role === 'impact' && m.userData.bornTick > impactTick
    )
  ).toBe(true);
  expect(f.w.snapshot()).toBe(saved);
  f.view.update(f.w, 1, f.camera, 20);
  expect(f.view.models.size).toBe(0);
  expect(f.w.snapshot()).toBe(saved);
  f.dispose();
});
