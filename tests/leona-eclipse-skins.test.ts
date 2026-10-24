import { expect, test } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import durations from '../src/content/champion-clip-durations.json';
import { TargetPoseSampler } from '../src/render/target-pose-sampler';
import { LeonaEclipseSkins } from '../src/render/leona-eclipse-skins';
import { ECLIPSE_PROFILES } from '../src/render/leona-eclipse-particles';

function fixture() {
  const world = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    lineWalkable: () => true,
    findPath: (_a, b) => [{ ...b }],
    reachable: (p) => ({ ...p }),
  });
  world.nextWaveTick = Infinity;
  world.hero.x = world.hero.y = -3000;
  const leona = world.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona'),
    target = world.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
  target.hp = target.maxHp = 100000;
  for (const u of world.units) u.ai = false;
  world.learnSpell('w', leona.id);
  world.enqueue({ type: 'cast', unit: leona.id, ability: 'w', point: leona });
  world.step(31);
  const source = new THREE.Group(),
    bone = new THREE.Bone(),
    geometry = new THREE.BufferGeometry(),
    material = new THREE.MeshBasicMaterial(),
    mesh = new THREE.SkinnedMesh(geometry, material),
    image = new THREE.Texture();
  source.scale.setScalar(0.0137);
  bone.name = 'Joint';
  source.add(bone, mesh);
  mesh.bind(new THREE.Skeleton([bone]));
  const clips = Object.entries(durations.leona).map(
    ([name, duration]) =>
      new THREE.AnimationClip(name, duration, [
        new THREE.VectorKeyframeTrack('Joint.position', [0, duration], [0, 0, 0, 0, 10, 0]),
      ])
  );
  const resources = {
    textures: new Map(
      ECLIPSE_PROFILES.filter((p) => p.kind === 'skin').flatMap((p) => [
        [p.texture, image] as const,
        ...(p.erosion ? [[p.erosion.texture, image] as const] : []),
      ])
    ),
    sampler: () => new TargetPoseSampler(source, clips),
  };
  const scene = new THREE.Scene(),
    view = new LeonaEclipseSkins(scene, () => 2, resources);
  const state = world.championState(leona.id)!;
  const release = () => {
    view.dispose();
    geometry.dispose();
    material.dispose();
    image.dispose();
  };
  return {
    world,
    leona,
    target,
    state,
    source,
    geometry,
    material,
    image,
    resources,
    scene,
    view,
    release,
  };
}
function frame(view: LeonaEclipseSkins) {
  return [...view.models].map(([id, m]) => ({
    id,
    position: m.root.position.toArray(),
    facing: m.root.rotation.y,
    scale: m.sampler.renderRoot.scale.toArray(),
    pose: m.root.userData.poseTick,
    color: m.material.uniforms.particleColor.value.toArray(),
    erosion: m.material.uniforms.erosionParameters?.value.toArray(),
    bones: m.meshes[0].skeleton.bones.map((b) => b.position.toArray()),
  }));
}
test('draws authored skin birth counts with distinct historical skeletons, preserved source scale and borrowed geometry', () => {
  const f = fixture(),
    snapshot = f.world.snapshot();
  f.view.update(f.world, 1);
  expect(f.view.models.size).toBe(4);
  const models = [...f.view.models.values()];
  expect(models.map((m) => m.root.userData.profileIndex).sort()).toEqual([4, 4, 5, 6]);
  expect(new Set(models.map((m) => m.meshes[0].skeleton)).size).toBe(4);
  for (const model of models) {
    expect(model.sampler.renderRoot.scale.toArray()).toEqual([0.0137, 0.0137, 0.0137]);
    expect(model.meshes[0].geometry).toBe(f.geometry);
    expect(model.meshes[0].material).toBe(model.material);
    expect(model.meshes[0].skeleton.bones[0]).not.toBe(f.source.children[0]);
    expect(model.root.position.y).toBe(2);
  }
  expect(f.world.snapshot()).toBe(snapshot);
  f.release();
});
test('restored presentation seeks reproduce skin state and repeated updates do not allocate another private rig', () => {
  const f = fixture(),
    restored = World.fromSnapshot(f.world.snapshot(), f.world.battlefield),
    copy = new LeonaEclipseSkins(new THREE.Scene(), () => 2, f.resources);
  f.view.update(f.world, 0.5);
  copy.update(restored, 0.5);
  expect(frame(copy)).toEqual(frame(f.view));
  const skeletons = [...f.view.models.values()].map((m) => m.meshes[0].skeleton);
  f.view.update(f.world, 0.5);
  expect([...f.view.models.values()].map((m) => m.meshes[0].skeleton)).toEqual(skeletons);
  f.world.step(151);
  restored.step(151);
  f.view.update(f.world, 1);
  copy.update(restored, 1);
  expect(frame(copy)).toEqual(frame(f.view));
  expect(f.view.models.size).toBe(2);
  expect([...f.view.models.values()].every((m) => m.root.userData.role === 'buff-extended')).toBe(
    true
  );
  copy.dispose();
  f.release();
});
test('hidden birth audiences stay hidden after vision returns and current visibility suppresses old visible births', () => {
  const f = fixture();
  f.state.leonaWVisuals[0].frames[1].audience = ['red'];
  f.view.update(f.world, 1);
  expect(f.view.models.size).toBe(0);
  f.state.leonaWVisuals[0].frames[1].audience = ['blue'];
  const visible = f.world.pointVisible.bind(f.world);
  f.world.pointVisible = () => false;
  f.view.update(f.world, 1);
  expect(f.view.models.size).toBe(0);
  f.world.pointVisible = visible;
  f.view.update(f.world, 1);
  expect(f.view.models.size).toBe(4);
  f.release();
});
test('death freezes the private pose and retires owned skeleton textures/materials without disposing shared source resources', () => {
  const f = fixture();
  f.world.hero.x = -200;
  f.world.hero.y = 0;
  f.world.step();
  f.world.damage(f.target, f.leona, 1e9, 'true');
  f.view.update(f.world, 1);
  const before = frame(f.view),
    models = [...f.view.models.values()];
  let boneDisposals = 0,
    materialDisposals = 0,
    borrowedDisposals = 0;
  for (const model of models) {
    model.meshes[0].skeleton.computeBoneTexture();
    model.meshes[0].skeleton.boneTexture!.addEventListener('dispose', () => boneDisposals++);
    model.material.addEventListener('dispose', () => materialDisposals++);
  }
  for (const borrowed of [f.geometry, f.material, f.image])
    borrowed.addEventListener('dispose', () => borrowedDisposals++);
  f.world.step(5);
  f.view.update(f.world, 1);
  expect(frame(f.view).map((p) => [p.position, p.bones, p.pose])).toEqual(
    before.map((p) => [p.position, p.bones, p.pose])
  );
  f.world.step(240);
  f.view.update(f.world, 1);
  expect(f.view.models.size).toBe(0);
  expect(f.scene.children).toHaveLength(0);
  expect(boneDisposals).toBe(4);
  expect(materialDisposals).toBe(4);
  expect(borrowedDisposals).toBe(0);
  f.view.dispose();
  expect(boneDisposals).toBe(4);
  f.release();
});
test('terminal presentation drains skin tails against a frozen saved endpoint without changing simulation state', () => {
  const f = fixture();
  // The save validator separately tests victory provenance. This renderer fixture
  // supplies a frozen terminal clock without manufacturing a gameplay victory.
  f.world.winner = 'blue';
  f.state.leonaWVisuals[0].stopTick = f.world.tick;
  f.state.leonaWVisuals[0].endReason = 'match-end';
  f.state.leonaW = null;
  const before = f.world.snapshot();
  f.view.update(f.world, 1);
  expect(f.view.models.size).toBe(4);
  const pose = frame(f.view).map((p) => [p.position, p.bones, p.pose]);
  f.view.update(f.world, 1, 0.05);
  expect(frame(f.view).map((p) => [p.position, p.bones, p.pose])).toEqual(pose);
  f.view.update(f.world, 1, 5);
  expect(f.view.models.size).toBe(0);
  expect(f.world.snapshot()).toBe(before);
  f.release();
});
