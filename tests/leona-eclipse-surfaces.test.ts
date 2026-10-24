import { expect, test } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { LeonaEclipseSurfaces } from '../src/render/leona-eclipse-surfaces';
import { ECLIPSE_PROFILES } from '../src/render/leona-eclipse-particles';
import { createLeonaEclipseSurfaceMaterial } from '../src/render/leona-eclipse-surface-material';

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
  w.hero.x = -300;
  w.hero.y = 0;
  const u = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona'),
    t = w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
  t.hp = t.maxHp = 100000;
  for (const unit of w.units) unit.ai = false;
  w.learnSpell('w', u.id);
  const scene = new THREE.Scene(),
    distortion = new THREE.Scene(),
    texture = new THREE.Texture(),
    geometry = new THREE.BoxGeometry(1, 1, 1),
    assets = { texture: () => texture, mesh: () => geometry },
    view = new LeonaEclipseSurfaces(scene, distortion, () => 0, assets),
    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 10, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const cast = () => {
    w.enqueue({ type: 'cast', unit: u.id, ability: 'w', point: u });
    w.step();
  };
  const capture = () => {
    view.update(w, 1, camera);
    return [...view.models].map(([id, m]) => ({
      id,
      ...m.userData,
      profileIndex: m.userData.profileIndex as number,
      position: m.position.toArray(),
      quaternion: m.quaternion.toArray(),
      scale: m.scale.toArray(),
      tint: m.material.uniforms.particleColor.value.toArray(),
      uv: m.material.uniforms.sourceUvTransform?.value.toArray(),
      mult: m.material.uniforms.multiplierUvTransform?.value.toArray(),
      power: m.material.uniforms.distortionPower?.value,
    }));
  };
  const dispose = () => {
    view.dispose();
    texture.dispose();
    geometry.dispose();
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
    cast,
    capture,
    dispose,
  };
}
test('dispatches every enabled non-skin source family across armed, extended, hit, miss and target clocks', () => {
  const f = fixture(),
    seen = new Set<number>();
  f.cast();
  const inspect = () => {
    const saved = f.w.snapshot();
    for (const p of f.capture()) seen.add(p.profileIndex);
    expect(f.w.snapshot()).toBe(saved);
  };
  for (const tick of [2, 31, 75, 120, 181, 182, 185, 188, 195, 210, 240, 270, 300, 360]) {
    f.w.step(tick - f.w.tick);
    inspect();
  }
  f.w.step(260);
  f.t.x = 3000;
  f.w.championState(f.u.id)!.cooldowns.w = 0;
  f.u.mana = f.u.maxMana;
  f.cast();
  const start = f.w.tick;
  for (const age of [3, 75, 180, 181, 185, 188, 195, 210, 240]) {
    f.w.step(start + age - f.w.tick);
    inspect();
  }
  expect([...seen].sort((a, b) => a - b)).toEqual(
    ECLIPSE_PROFILES.map((p, i) => (p.kind === 'skin' ? -1 : i)).filter((i) => i >= 0)
  );
  f.dispose();
});
test('saved futures reproduce source transforms and independent UV/erosion/lookup material state', () => {
  const f = fixture();
  f.cast();
  f.w.step(189);
  const saved = f.w.snapshot(),
    before = f.capture(),
    copy = World.fromSnapshot(saved, f.w.battlefield),
    other = new LeonaEclipseSurfaces(new THREE.Scene(), new THREE.Scene(), () => 0, f.assets);
  other.update(copy, 1, f.camera);
  expect([...other.models.keys()]).toEqual(before.map((m) => m.id));
  for (const [key, m] of other.models) {
    const a = f.view.models.get(key)!;
    expect(m.position.toArray()).toEqual(a.position.toArray());
    expect(m.quaternion.toArray()).toEqual(a.quaternion.toArray());
    expect(m.scale.toArray()).toEqual(a.scale.toArray());
    expect(m.material.uniforms.particleColor.value.toArray()).toEqual(
      a.material.uniforms.particleColor.value.toArray()
    );
  }
  expect(copy.snapshot()).toBe(saved);
  other.dispose();
  f.dispose();
});
test('uses source SCB geometry for meshes, owned ground/ray geometry and a separate distortion display list', () => {
  const f = fixture();
  f.cast();
  f.w.step(189);
  f.capture();
  const models = [...f.view.models.values()];
  expect(models.some((m) => m.userData.sourceMesh)).toBe(true);
  for (const m of models) {
    const p = ECLIPSE_PROFILES[m.userData.profileIndex];
    if (p.kind === 'mesh') expect(m.geometry).toBe(f.geometry);
    if (p.kind === 'ray' || (p.kind === 'quad' && p.ground))
      expect(m.userData.ownedGeometry).toBe(true);
    if (p.distortion) {
      expect(m.parent).toBe(f.distortion);
      expect(m.material.uniforms.distortionPower.value).toBe(p.distortion.strength);
    } else expect(m.parent).toBe(f.scene);
    expect([...m.position, ...m.scale, ...m.quaternion].every(Number.isFinite)).toBe(true);
  }
  expect(models.find((m) => m.userData.profileIndex === 21)?.userData.unboundPalette).toBe(true);
  f.dispose();
});
test('retirement disposes private materials/geometry and preserves source meshes/images', () => {
  const f = fixture();
  f.cast();
  f.w.step(189);
  f.capture();
  let materials = 0,
    owned = 0,
    borrowed = 0;
  const models = [...f.view.models.values()],
    ownedCount = models.filter((m) => m.userData.ownedGeometry).length;
  for (const m of models) {
    m.material.addEventListener('dispose', () => materials++);
    if (m.userData.ownedGeometry) m.geometry.addEventListener('dispose', () => owned++);
  }
  f.geometry.addEventListener('dispose', () => borrowed++);
  f.texture.addEventListener('dispose', () => borrowed++);
  f.w.step(620);
  f.capture();
  expect(f.view.models.size).toBe(0);
  expect(f.scene.children).toHaveLength(0);
  expect(f.distortion.children).toHaveLength(0);
  expect(materials).toBe(models.length);
  expect(owned).toBe(ownedCount);
  expect(borrowed).toBe(0);
  f.dispose();
});
test('future finite terminal births use the frozen winning endpoint and all tails drain without changing the saved world', () => {
  const f = fixture();
  f.cast();
  f.w.step(180);
  const gate = f.w.spawn('inhibitor', 'red', { x: 1000, y: 1000 });
  f.w.damage(f.w.hero, gate, 1e9, 'true');
  const nexus = f.w.spawn('nexus', 'red', { x: 1200, y: 1000 });
  f.w.damage(f.w.hero, nexus, 1e9, 'true');
  const saved = f.w.snapshot();
  f.view.update(f.w, 1, f.camera, 0.15);
  expect([...f.view.models.values()].some((m) => m.userData.role === 'cast-hit')).toBe(true);
  expect([...f.view.models.values()].some((m) => m.userData.role === 'target')).toBe(true);
  f.view.update(f.w, 1, f.camera, 10);
  expect(f.view.models.size).toBe(0);
  expect(f.w.snapshot()).toBe(saved);
  expect(World.fromSnapshot(saved, f.w.battlefield).snapshot()).toBe(saved);
  f.dispose();
});
test('surface material exposes native split soft controls, independent mesh UVs and borrowed-resource ownership', () => {
  const texture = new THREE.Texture(),
    m = createLeonaEclipseSurfaceMaterial({
      kind: 'mesh',
      texture,
      lookup: texture,
      multiplier: texture,
      lockAlpha: true,
      soft: { beginIn: 20, deltaIn: 10, beginOut: 300, deltaOut: 50 },
      erosion: { texture, mixer: [0, 0, 0, 1], featherIn: 0.1, featherOut: 0.2, sliceWidth: 0.5 },
    });
  expect(m.uniforms.softParameters.value.toArray()).toEqual([0.2, 3, 10, 2]);
  expect(m.uniforms.softControl.value.toArray()).toEqual([0, 1, 0, 1]);
  expect(m.uniforms.sourceUvTransform.value).not.toBe(m.uniforms.multiplierUvTransform.value);
  let disposed = 0;
  texture.addEventListener('dispose', () => disposed++);
  m.dispose();
  expect(disposed).toBe(0);
  texture.dispose();
});
