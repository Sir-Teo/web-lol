import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { AhriQProjectiles } from '../src/render/ahri-q-projectiles';
import data from '../src/content/ahri-q-projectile-particles.json';
function setup(team: 'blue' | 'red' = 'blue') {
  const world = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
  world.nextWaveTick = 1e9;
  Object.assign(world.hero, { ai: false, x: -3000, y: -3000 });
  const ahri = world.spawn('champion', team, { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  world.learnSpell('q', ahri.id);
  world.enqueue({ type: 'cast', unit: ahri.id, ability: 'q', point: { x: 900, y: 0 } });
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(10, 15, 12);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const texture = new THREE.Texture(),
    geometry = new THREE.BoxGeometry(1, 1, 1);
  const resources = { texture: () => texture, mesh: () => geometry };
  const view = new AhriQProjectiles(scene, new THREE.Scene(), () => 2, resources);
  const draw = (w = world, terminal = 0) => view.update(w, 1, camera, terminal);
  const release = () => {
    view.dispose();
    geometry.dispose();
    texture.dispose();
  };
  return { world, ahri, view, draw, release, scene, camera, resources, texture, geometry };
}
function frame(view: AhriQProjectiles) {
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
test('actual outward and return flights draw all source primitive families without World mutation', () => {
  const { world, view, draw, release } = setup();
  const seen = new Set<number>();
  for (let tick = 1; tick <= 150; tick++) {
    world.step();
    if (![17, 20, 30, 40, 60, 63, 70, 75, 90, 110, 130, 150].includes(tick)) continue;
    const before = world.snapshot();
    draw();
    expect(world.snapshot()).toBe(before);
    for (const m of [...view.surfaces.models.values(), ...view.models.values()]) {
      seen.add(m.userData.profileIndex);
      expect(m.position.toArray().every(Number.isFinite)).toBe(true);
      expect(m.scale.toArray().every(Number.isFinite)).toBe(true);
    }
  }
  expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: 36 }, (_, i) => i));
  release();
});
test('fresh restore and reused renderer produce identical drawings across rewinds and return Flash', () => {
  const { world, ahri, view, draw, release, camera, resources } = setup();
  const saves: string[] = [];
  for (let tick = 1; tick <= 100; tick++) {
    if (tick === 91)
      world.enqueue({ type: 'cast', unit: ahri.id, ability: 'd', point: { x: -300, y: 0 } });
    world.step();
    if ([20, 40, 63, 75, 90, 100].includes(tick)) {
      draw();
      saves.push(world.snapshot());
    }
  }
  expect(ahri.x).toBe(-300);
  for (const raw of [...saves].reverse()) {
    const restored = World.fromSnapshot(raw, world.battlefield);
    draw(restored);
    const expected = new AhriQProjectiles(new THREE.Scene(), new THREE.Scene(), () => 2, resources);
    expected.update(restored, 1, camera);
    expect(frame(view)).toEqual(frame(expected));
    expect(restored.snapshot()).toBe(raw);
    expected.dispose();
  }
  release();
});
test('a hidden enemy birth can reveal bound cores later while unseen trail births stay hidden', () => {
  const { world, view, draw, release } = setup('red');
  world.step(40);
  expect(world.ahriQProjectileVisuals[0].birthAudience).toEqual(['red']);
  draw();
  expect(view.surfaces.models.size).toBe(0);
  expect(view.models.size).toBe(0);
  const visible = vi.spyOn(world, 'pointVisible').mockReturnValue(true);
  draw();
  expect(view.surfaces.models.size).toBeGreaterThan(0);
  expect(view.models.size).toBe(0);
  expect(
    [...view.surfaces.models.values()].every(
      (m) => data.profiles[m.userData.profileIndex].bind.constant[0] === 1
    )
  ).toBe(true);
  expect(visible).toHaveBeenCalled();
  release();
});
test('terminal tails drain without ticking World and disposal releases owned drawings but preserves borrowed resources', () => {
  const { world, view, draw, release, scene, texture, geometry } = setup();
  world.step(90);
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
  world.step(40);
  draw();
  const ground = [...view.surfaces.models.values()].find(
    (m) =>
      data.profiles[m.userData.profileIndex].kind === 'quad' &&
      data.profiles[m.userData.profileIndex].ground
  )!;
  expect(ground).toBeDefined();
  const position = ground.geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) expect(position.getY(i)).toBeCloseTo(2.02, 5);
  const glow = [...view.surfaces.models.values()].find((m) => m.userData.profileIndex === 2)!;
  expect(data.profiles[2].position.constant).toEqual([0, 10, 0]);
  expect(glow.position.y).toBeCloseTo(2.9 + 0.1, 5);
  release();
});
