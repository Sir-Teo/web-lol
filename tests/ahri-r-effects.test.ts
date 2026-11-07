import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { MOBILE_CLIP_DURATIONS, type MobileRig } from '../src/content/mobile-clip-durations';
import { TargetPoseSampler } from '../src/render/target-pose-sampler';
import { AhriRParticles } from '../src/render/ahri-r-effects';
import data from '../src/content/ahri-r-particles.json';
import { AHRI_R_BOUND_SPELL_PROFILES } from '../src/render/ahri-r-particles';
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
  const target = world.spawn('champion', team === 'blue' ? 'red' : 'blue', { x: 600, y: 0 }, 'lux');
  Object.assign(target, { ai: false, hp: 10000, maxHp: 10000 });
  world.gainExperience(1e6, ahri.id);
  world.learnSpell('r', ahri.id);
  world.enqueue({ type: 'cast', unit: ahri.id, ability: 'r', point: { x: 1000, y: 0 } });
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
  for (const name of ['C_BUFFBONE_GLB_CHEST_LOC']) {
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
  const view = new AhriRParticles(scene, new THREE.Scene(), () => 2, resources);
  const draw = (w = world, terminal = 0) => view.update(w, 1, camera, terminal);
  const release = () => {
    view.dispose();
    geometry.dispose();
    texture.dispose();
    for (const material of materials) material.dispose();
  };
  return { world, ahri, target, view, draw, release, scene, camera, resources, texture, geometry };
}
function frame(view: AhriRParticles) {
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
        cell: Array.from(m.geometry.getAttribute('sourceCell').array).slice(
          0,
          m.geometry.drawRange.count * 2
        ),
        multCell: Array.from(m.geometry.getAttribute('sourceMultCell').array).slice(
          0,
          m.geometry.drawRange.count * 2
        ),
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
test('R draws its twenty selected spell profiles without changing World', () => {
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
  }
  expect(view.deferredProfiles).toHaveLength(35);
  expect([...seen].sort((a, b) => a - b)).toEqual(
    [...AHRI_R_BOUND_SPELL_PROFILES].sort((a, b) => a - b)
  );
  release();
});
test('R drawings reconstruct exactly through saves, backward seeks and a real caster Flash', () => {
  const { world, ahri, view, draw, release, camera, resources } = setup();
  const saves: string[] = [];
  for (let tick = 1; tick <= 120; tick++) {
    if (tick === 10)
      world.enqueue({ type: 'cast', unit: ahri.id, ability: 'd', point: { x: -300, y: 0 } });
    world.step();
    if ([10, 20, 25, 30, 40, 60, 100, 120].includes(tick)) {
      draw();
      saves.push(world.snapshot());
    }
  }
  expect(ahri.x).toBe(-220);
  expect(world.ahriRVisuals[0].bursts[0].dashEnd).toMatchObject({
    reason: 'flash',
    point: { x: 180, y: 0 },
  });
  for (const saved of saves.reverse()) {
    const copy = World.fromSnapshot(saved, world.battlefield);
    draw(copy);
    const fresh = new AhriRParticles(new THREE.Scene(), new THREE.Scene(), () => 2, resources);
    fresh.update(copy, 1, camera);
    expect(frame(view)).toEqual(frame(fresh));
    expect(copy.snapshot()).toBe(saved);
    fresh.dispose();
  }
  release();
});
test('R reveal admits current bound cores and preserves hidden unbound births', () => {
  let revealed = false;
  const { world, view, draw, release } = setup('red');
  world.visible = (unit, team) => unit.team === team || team === 'red' || revealed;
  world.pointVisible = (_point, team) => team === 'red' || revealed;
  world.step(13);
  draw();
  expect(view.surfaces.models.size).toBe(0);
  expect(view.models.size).toBe(0);
  revealed = true;
  world.step(4);
  draw();
  expect(view.surfaces.models.size).toBeGreaterThan(0);
  for (const model of view.surfaces.models.values())
    if (data.profiles[model.userData.profileIndex].bind.constant[0] === 0)
      expect(model.userData.bornTick).toBeGreaterThanOrEqual(13);
  for (const model of view.models.values())
    expect(model.userData.visiblePoints).toBeGreaterThanOrEqual(2);
  release();
});
test('terminal R effects retire without World steps and preserve borrowed resources', () => {
  const { world, view, draw, release, scene, texture, geometry } = setup();
  world.step(13);
  draw();
  const owned = [...view.models.values()].map((mesh) => ({
    geometry: vi.spyOn(mesh.geometry, 'dispose'),
    material: vi.spyOn(mesh.material, 'dispose'),
  }));
  expect(owned.length).toBeGreaterThan(0);
  const borrowedGeometry = vi.spyOn(geometry, 'dispose'),
    borrowedTexture = vi.spyOn(texture, 'dispose');
  const nexus = world.spawn('nexus', 'red', { x: 1500, y: 1500 });
  world.damage(world.hero, nexus, 1e6, 'true');
  const saved = world.snapshot();
  draw();
  draw(world, 13);
  expect(view.models.size).toBe(0);
  expect(view.surfaces.models.size).toBe(0);
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

test('R surfaces and ribbons share one depth capture with consistent soft uniforms', () => {
  const { world, view, draw, release, camera } = setup();
  world.step(13);
  draw();
  const surface = [...view.surfaces.models.values()].filter((m) => m.material.uniforms.softDepth);
  const ribbons = [...view.models.values()].filter((m) => m.material.uniforms.softDepth);
  expect(surface.length).toBeGreaterThan(0);
  expect(ribbons.length).toBeGreaterThan(0);
  const target = new THREE.WebGLRenderTarget(320, 180);
  target.depthTexture = new THREE.DepthTexture(320, 180);
  const capture = vi.spyOn(view.surfaces.depth, 'capture').mockReturnValue(target);
  const saved = world.snapshot();
  view.prepareDepth({} as THREE.WebGLRenderer, camera);
  expect(capture).toHaveBeenCalledTimes(1);
  for (const model of [...surface, ...ribbons]) {
    expect(model.material.uniforms.softDepth.value).toBe(target.depthTexture);
    expect(model.material.uniforms.softSize.value.toArray()).toEqual([320, 180]);
    expect(model.material.uniforms.depthConversion.value.toArray()).toEqual([
      1 / camera.near,
      1 / camera.far - 1 / camera.near,
    ]);
  }
  expect(world.snapshot()).toBe(saved);
  release();
  target.depthTexture.dispose();
  target.dispose();
});
