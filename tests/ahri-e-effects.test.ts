import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { MOBILE_CLIP_DURATIONS, type MobileRig } from '../src/content/mobile-clip-durations';
import { TargetPoseSampler } from '../src/render/target-pose-sampler';
import { AhriEParticles } from '../src/render/ahri-e-effects';
import data from '../src/content/ahri-e-particles.json';
function setup(team: 'blue' | 'red' = 'blue', visible = () => true) {
  const world = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: visible,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
  });
  world.nextWaveTick = 1e9;
  Object.assign(world.hero, { ai: false, x: -3000, y: -3000, previous: { x: -3000, y: -3000 } });
  const ahri = world.spawn('champion', team, { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  const target = world.spawn('champion', team === 'blue' ? 'red' : 'blue', { x: 800, y: 0 }, 'lux');
  Object.assign(target, { ai: false, hp: 10000, maxHp: 10000 });
  world.learnSpell('e', ahri.id);
  world.enqueue({ type: 'cast', unit: ahri.id, ability: 'e', point: { x: 1000, y: 0 } });
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(10, 15, 12);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const texture = new THREE.Texture(),
    geometry = new THREE.BoxGeometry(1, 1, 1),
    reference = new THREE.Group();
  const bone = new THREE.Bone();
  bone.position.y = 100;
  bone.name = 'C_Buffbone_Glb_Center_Loc';
  reference.add(bone);
  reference.scale.setScalar(0.01);
  for (const name of ['spine', 'C_BUFFBONE_GLB_HEAD_LOC', 'C_BUFFBONE_GLB_LAYOUT_LOC']) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.y = 100;
    reference.add(b);
  }
  const materials = ['Body', 'Eyes', 'Tails', 'Tail_Large'].map((name) => {
    const material = new THREE.MeshBasicMaterial();
    material.name = name;
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.bind(new THREE.Skeleton([bone]));
    reference.add(mesh);
    return material;
  });
  const resources = {
    texture: () => texture,
    mesh: () => geometry,
    sampler: (rig: MobileRig) =>
      new TargetPoseSampler(
        reference,
        Object.entries(MOBILE_CLIP_DURATIONS[rig]).map(
          ([name, seconds]) => new THREE.AnimationClip(name, seconds, [])
        )
      ),
  };
  const view = new AhriEParticles(scene, new THREE.Scene(), () => 2, resources);
  const draw = (w = world, terminal = 0) => view.update(w, 1, camera, terminal);
  const release = () => {
    view.dispose();
    geometry.dispose();
    texture.dispose();
    for (const material of materials) material.dispose();
  };
  return { world, ahri, target, view, draw, release, scene, camera, resources, texture, geometry };
}
function frame(view: AhriEParticles) {
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
    skins: [...view.castSkins.models].map(([key, m]) => ({
      key,
      position: m.root.position.toArray(),
      rotation: m.root.rotation.toArray(),
      color: m.material.uniforms.particleColor.value.toArray(),
      erosion: m.material.uniforms.erosionParameters.value.toArray(),
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
test('E draws 28 bound source profiles across cast, flight, hit and both buffs without changing World', () => {
  const { world, view, draw, release } = setup();
  const seen = new Set<number>();
  for (let tick = 1; tick <= 240; tick++) {
    world.step();
    if (
      ![
        2, 7, 10, 15, 17, 20, 25, 30, 35, 40, 45, 50, 60, 75, 90, 110, 130, 150, 180, 220, 240,
      ].includes(tick)
    )
      continue;
    const before = world.snapshot();
    draw();
    expect(world.snapshot()).toBe(before);
    for (const m of [...view.surfaces.models.values(), ...view.models.values()]) {
      seen.add(m.userData.profileIndex);
      expect(m.position.toArray().every(Number.isFinite)).toBe(true);
      expect(m.quaternion.toArray().every(Number.isFinite)).toBe(true);
      expect(m.scale.toArray().every(Number.isFinite)).toBe(true);
    }
    for (const skin of view.castSkins.models.values()) seen.add(skin.root.userData.profileIndex);
  }
  expect(view.unboundSkinProfiles).toHaveLength(1);
  expect(data.profiles[view.unboundSkinProfiles[0]]).toMatchObject({
    system: 'Ahri_E_buf',
    kind: 'skin',
    name: 'Avatar',
  });
  expect([...seen].sort((a, b) => a - b)).toEqual(
    data.profiles.map((_p, i) => i).filter((i) => !view.unboundSkinProfiles.includes(i))
  );
  release();
});
test('E drawings reconstruct exactly through saves, backward seeks and a real caster Flash', () => {
  const { world, ahri, view, draw, release, camera, resources } = setup();
  const saves: string[] = [];
  for (let tick = 1; tick <= 120; tick++) {
    if (tick === 30)
      world.enqueue({ type: 'cast', unit: ahri.id, ability: 'd', point: { x: -300, y: 0 } });
    world.step();
    if ([10, 20, 25, 30, 40, 60, 100, 120].includes(tick)) {
      draw();
      saves.push(world.snapshot());
    }
  }
  expect(ahri.x).toBe(-300);
  for (const saved of saves.reverse()) {
    const copy = World.fromSnapshot(saved, world.battlefield);
    draw(copy);
    const fresh = new AhriEParticles(new THREE.Scene(), new THREE.Scene(), () => 2, resources);
    fresh.update(copy, 1, camera);
    expect(frame(view)).toEqual(frame(fresh));
    expect(copy.snapshot()).toBe(saved);
    fresh.dispose();
  }
  release();
});
test('real visibility reveals bound E flight cores without replaying hidden cast-skin births', () => {
  let revealed = false;
  const { world, view, draw, release } = setup('red', () => revealed);
  world.step(20);
  draw();
  expect(view.surfaces.models.size).toBe(0);
  expect(view.models.size).toBe(0);
  expect(view.castSkins.models.size).toBe(0);
  revealed = true;
  world.step(20);
  draw();
  expect(view.surfaces.models.size).toBeGreaterThan(0);
  expect(view.castSkins.models.size).toBe(0);
  for (const m of view.surfaces.models.values())
    if (data.profiles[m.userData.profileIndex].role === 'cast')
      expect(m.userData.bornTick).toBeGreaterThan(20);
  for (const m of view.models.values()) expect(m.userData.visiblePoints).toBeGreaterThanOrEqual(2);
  release();
});
test('genuine terminal E tails drain without World steps and preserve borrowed resources', () => {
  const { world, view, draw, release, scene, texture, geometry } = setup();
  world.step(30);
  const nexus = world.spawn('nexus', 'red', { x: 1500, y: 1500 });
  world.damage(world.hero, nexus, 1e6, 'true');
  const saved = world.snapshot();
  draw();
  const owned = [...view.models.values()].map((m) => ({
    geometry: vi.spyOn(m.geometry, 'dispose'),
    material: vi.spyOn(m.material, 'dispose'),
  }));
  expect(owned.length).toBe(3);
  const borrowedGeometry = vi.spyOn(geometry, 'dispose'),
    borrowedTexture = vi.spyOn(texture, 'dispose');
  draw(world, 8);
  expect(view.models.size).toBe(0);
  expect(view.surfaces.models.size).toBe(0);
  expect(view.castSkins.models.size).toBe(0);
  expect(world.snapshot()).toBe(saved);
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
