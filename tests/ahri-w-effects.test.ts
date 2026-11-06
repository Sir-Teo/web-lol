import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { AhriWParticles } from '../src/render/ahri-w-effects';
import data from '../src/content/ahri-w-particles.json';
import { wVisualGroups } from '../src/render/ahri-w-history';
import { ahriWParticles } from '../src/render/ahri-w-particles';
function setup(team: 'blue' | 'red' = 'blue') {
  const world = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
  });
  world.nextWaveTick = 1e9;
  Object.assign(world.hero, { ai: false, x: -3000, y: -3000 });
  const ahri = world.spawn('champion', team, { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  const target = world.spawn('champion', team === 'blue' ? 'red' : 'blue', { x: 400, y: 0 }, 'lux');
  Object.assign(target, { ai: false, hp: 10000, maxHp: 10000 });
  world.learnSpell('w', ahri.id);
  world.enqueue({ type: 'cast', unit: ahri.id, ability: 'w', point: { x: 900, y: 0 } });
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(10, 15, 12);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const texture = new THREE.Texture(),
    geometry = new THREE.BoxGeometry(1, 1, 1);
  const resources = { texture: () => texture, mesh: () => geometry };
  const view = new AhriWParticles(scene, new THREE.Scene(), () => 2, resources);
  const draw = (w = world, terminal = 0) => view.update(w, 1, camera, terminal);
  const release = () => {
    view.dispose();
    geometry.dispose();
    texture.dispose();
  };
  return { world, ahri, view, draw, release, scene, camera, resources, texture, geometry };
}
function frame(view: AhriWParticles) {
  return {
    surfaces: [...view.surfaces.models]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, m]) => ({
        key,
        position: m.position.toArray(),
        quaternion: m.quaternion.toArray(),
        scale: m.scale.toArray(),
        color: m.material.uniforms.particleColor.value.toArray(),
        erosion: m.material.uniforms.erosionParameters?.value.toArray(),
        uv: m.material.uniforms.sourceUvTransform.value.toArray(),
        vertices: m.userData.ownedGeometry
          ? Array.from(m.geometry.getAttribute('position').array)
          : [],
      })),
    ribbons: [...view.models]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, m]) => ({
        key,
        count: m.geometry.drawRange.count,
        positions: Array.from(m.geometry.getAttribute('position').array).slice(
          0,
          m.geometry.drawRange.count * 3
        ),
        tint: Array.from(m.geometry.getAttribute('sourceTint').array).slice(
          0,
          m.geometry.drawRange.count * 4
        ),
        erosion: Array.from(m.geometry.getAttribute('sourceErosion').array).slice(
          0,
          m.geometry.drawRange.count
        ),
        mult: Array.from(m.geometry.getAttribute('sourceMultUv').array).slice(
          0,
          m.geometry.drawRange.count * 2
        ),
      })),
  };
}
test('actual orbit, flight and hit phases draw all source primitive families without World mutation', () => {
  const { world, view, draw, release } = setup();
  const seen = new Set<number>();
  for (let tick = 1; tick <= 150; tick++) {
    world.step();
    if (
      ![2, 5, 10, 15, 17, 20, 26, 30, 35, 40, 45, 50, 55, 60, 75, 90, 110, 130, 150].includes(tick)
    )
      continue;
    const before = world.snapshot();
    draw();
    expect(world.snapshot()).toBe(before);
    for (const m of [...view.surfaces.models.values(), ...view.models.values()]) {
      seen.add(m.userData.profileIndex);
      expect(m.position.toArray().every(Number.isFinite)).toBe(true);
      expect(m.scale.toArray().every(Number.isFinite)).toBe(true);
    }
  }
  expect([...seen].sort((a, b) => a - b)).toEqual(
    data.profiles.map((p, i) => (p.role === 'cast' ? -1 : i)).filter((i) => i >= 0)
  );
  release();
});
test('fresh restore and reused renderer produce identical drawings across rewinds and caster Flash', () => {
  const { world, ahri, view, draw, release, camera, resources } = setup();
  const saves: string[] = [];
  for (let tick = 1; tick <= 100; tick++) {
    if (tick === 30)
      world.enqueue({ type: 'cast', unit: ahri.id, ability: 'd', point: { x: -300, y: 0 } });
    world.step();
    if ([5, 15, 20, 25, 30, 40, 60, 100].includes(tick)) {
      draw();
      saves.push(world.snapshot());
    }
  }
  expect(ahri.x).toBe(-300);
  for (const raw of [...saves].reverse()) {
    const restored = World.fromSnapshot(raw, world.battlefield);
    draw(restored);
    const expected = new AhriWParticles(new THREE.Scene(), new THREE.Scene(), () => 2, resources);
    expected.update(restored, 1, camera);
    expect(frame(view)).toEqual(frame(expected));
    expect(restored.snapshot()).toBe(raw);
    expected.dispose();
  }
  release();
});
test('hidden orbit births reveal bound cores when their current roots become known', () => {
  const { world, view, draw, release } = setup('red');
  world.step(15);
  for (const r of world.ahriWVisuals)
    for (const f of r.fires) {
      f.birth.audience = ['red'];
      for (const frame of f.frames) frame.audience = ['red'];
    }
  const visible = vi.spyOn(world, 'pointVisible').mockReturnValue(false);
  draw();
  expect(view.surfaces.models.size).toBe(0);
  expect(view.models.size).toBe(0);
  visible.mockReturnValue(true);
  draw();
  expect(view.surfaces.models.size).toBeGreaterThan(0);
  expect(view.models.size).toBe(0);
  release();
});
test('terminal tails drain without ticking World and disposal releases owned drawings but preserves borrowed resources', () => {
  const { world, view, draw, release, scene, texture, geometry } = setup();
  world.step(30);
  const nexus = world.spawn('nexus', 'red', { x: 1500, y: 1500 });
  world.damage(world.hero, nexus, 1e6, 'true');
  const raw = world.snapshot();
  draw();
  const owned = [...view.models.values()].map((m) => ({
    geometry: vi.spyOn(m.geometry, 'dispose'),
    material: vi.spyOn(m.material, 'dispose'),
  }));
  expect(owned.length).toBeGreaterThan(0);
  const borrowedGeometry = vi.spyOn(geometry, 'dispose'),
    borrowedTexture = vi.spyOn(texture, 'dispose');
  draw(world, 7);
  expect(view.models.size).toBe(0);
  expect(view.surfaces.models.size).toBe(0);
  expect(world.snapshot()).toBe(raw);
  view.dispose();
  expect(scene.children).toHaveLength(0);
  for (const item of owned) {
    expect(item.geometry).toHaveBeenCalledTimes(1);
    expect(item.material).toHaveBeenCalledTimes(1);
  }
  expect(borrowedGeometry).not.toHaveBeenCalled();
  expect(borrowedTexture).not.toHaveBeenCalled();
  release();
});
test('ground quads use terrain height while airborne cores keep the existing local projectile height', () => {
  const { world, view, draw, release } = setup();
  world.step(15);
  draw();
  const ground = [...view.surfaces.models.values()].find(
    (m) =>
      data.profiles[m.userData.profileIndex].kind === 'quad' &&
      data.profiles[m.userData.profileIndex].ground
  )!;
  expect(ground).toBeDefined();
  const position = ground.geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) expect(position.getY(i)).toBeCloseTo(2.02, 5);
  const group = wVisualGroups(world.ahriWVisuals[0]).find(
    (g) => g.fire.index === 0 && g.role === 'orbit'
  )!;
  const air = [...view.surfaces.models].find(
    ([key, m]) =>
      key.startsWith(group.key + ':') &&
      data.profiles[m.userData.profileIndex].name === 'FireCards_CAST'
  )![1];
  const particle = ahriWParticles(group.role, group.seed, (world.tick - group.startTick) / 60).find(
    (p) => p.profileIndex === air.userData.profileIndex && p.ordinal === air.userData.ordinal
  )!;
  expect(air.position.y).toBeCloseTo(
    2.9 + (particle.offset[1] + particle.worldOffset![1]) * 0.01,
    5
  );
  release();
});

test('genuine sight calculations reveal hidden W flights without joining unseen trail births', () => {
  const world = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    // A source inside the left brush sees out; an outside observer cannot see in.
    lineOfSight: (from, to) => from.x < -150 || to.x >= -150,
  });
  world.nextWaveTick = 1e9;
  Object.assign(world.hero, { ai: false, x: -3000, y: -3000 });
  const ahri = world.spawn('champion', 'red', { x: -500, y: 0 }, 'ahri');
  ahri.ai = false;
  const target = world.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
  Object.assign(target, { ai: false, hp: 10000, maxHp: 10000 });
  world.learnSpell('w', ahri.id);
  world.enqueue({ type: 'cast', unit: ahri.id, ability: 'w', point: { x: -500, y: 0 } });
  const texture = new THREE.Texture(),
    geometry = new THREE.BoxGeometry(1, 1, 1);
  const resources = { texture: () => texture, mesh: () => geometry };
  const view = new AhriWParticles(new THREE.Scene(), new THREE.Scene(), () => 0, resources);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(10, 15, 12);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  let hiddenFlight = false,
    visibleFlight = false,
    visibleEffects = false,
    visibleRibbons = false;
  for (let tick = 1; tick <= 65; tick++) {
    world.step();
    const before = world.snapshot();
    view.update(world, 1, camera);
    expect(world.snapshot()).toBe(before);
    if (tick === 15) {
      expect(view.surfaces.models.size).toBe(0);
      expect(world.ahriWVisuals[0].fires.every((f) => !f.birth.audience.includes('blue'))).toBe(
        true
      );
    }
    for (const r of world.ahriWVisuals)
      for (const f of r.fires) {
        const frame = f.frames.at(-1);
        if (frame?.phase !== 'flight' || f.end) continue;
        if (frame.audience.includes('blue')) visibleFlight = true;
        else hiddenFlight = true;
      }
    visibleEffects ||= view.surfaces.models.size > 0;
    visibleRibbons ||= view.models.size > 0;
    for (const mesh of view.models.values())
      expect(mesh.userData.visiblePoints).toBeGreaterThanOrEqual(2);
  }
  expect({ hiddenFlight, visibleFlight, visibleEffects, visibleRibbons }).toEqual({
    hiddenFlight: true,
    visibleFlight: true,
    visibleEffects: true,
    visibleRibbons: true,
  });
  view.dispose();
  geometry.dispose();
  texture.dispose();
});
