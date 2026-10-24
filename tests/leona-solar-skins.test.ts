import { expect, test } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import durations from '../src/content/champion-clip-durations.json';
import { TargetPoseSampler } from '../src/render/target-pose-sampler';
import { LeonaSolarSkins } from '../src/render/leona-solar-skins';
import { SOLAR_PROFILES } from '../src/render/leona-solar-particles';

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
  world.hero.x = -100;
  world.hero.y = 0;
  const leona = world.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona'),
    target = world.spawn('champion', 'red', { x: 800, y: 0 }, 'lux');
  target.hp = target.maxHp = 100000;
  for (const u of world.units) u.ai = false;
  world.gainExperience(2400, leona.id);
  world.learnSpell('r', leona.id);
  world.enqueue({ type: 'cast', unit: leona.id, ability: 'r', point: { x: 900, y: 0 } });
  world.step(55);
  const state = world.championState(leona.id)!,
    visual = state.leonaRVisuals[0];
  expect(visual.impact).not.toBeNull();
  const source = new THREE.Group(),
    bone = new THREE.Bone(),
    geometry = new THREE.BufferGeometry().setAttribute(
      'normal',
      new THREE.Float32BufferAttribute([0, 0, 1], 3)
    ),
    material = new THREE.MeshBasicMaterial(),
    mesh = new THREE.SkinnedMesh(geometry, material),
    base = new THREE.Texture(),
    multiplier = new THREE.Texture();
  bone.name = 'Joint';
  source.scale.setScalar(0.0137);
  source.add(bone, mesh);
  mesh.bind(new THREE.Skeleton([bone]));
  const clips = Object.entries(durations.leona).map(
    ([name, duration]) =>
      new THREE.AnimationClip(name, duration, [
        new THREE.VectorKeyframeTrack('Joint.position', [0, duration], [0, 0, 0, 0, 10, 0]),
      ])
  );
  const requested: number[] = [],
    resources = {
      texture: (_p: string, address: number) => {
        requested.push(address);
        return _p.includes('mult') ? multiplier : base;
      },
      sampler: () => new TargetPoseSampler(source, clips),
    };
  const scene = new THREE.Scene(),
    view = new LeonaSolarSkins(scene, () => 2, resources);
  return {
    world,
    leona,
    target,
    state,
    visual,
    source,
    geometry,
    material,
    base,
    multiplier,
    resources,
    requested,
    scene,
    view,
    release: () => {
      view.dispose();
      geometry.dispose();
      material.dispose();
      base.dispose();
      multiplier.dispose();
    },
  };
}
function frame(view: LeonaSolarSkins) {
  return [...view.models].map(([key, m]) => ({
    key,
    ...m.root.userData,
    poseTick: m.root.userData.poseTick,
    position: m.root.position.toArray(),
    facing: m.root.rotation.y,
    scale: m.sampler.renderRoot.scale.toArray(),
    color: m.material.uniforms.particleColor.value.toArray(),
    multiplier: m.material.uniforms.multiplierUvTransform.value.toArray(),
    bones: m.meshes[0].skeleton.bones.map((b) => b.position.toArray()),
  }));
}
test('one R buff birth overlays the complete private owner skin with independent multiplier sampling and scale', () => {
  const f = fixture(),
    before = f.world.snapshot();
  f.view.update(f.world, 1);
  expect(f.view.models.size).toBe(1);
  expect(f.requested).toEqual([0, 0]);
  const model = [...f.view.models.values()][0],
    profile = SOLAR_PROFILES[0];
  expect(profile.kind).toBe('skin');
  expect(profile.name).toBe('Cas_WeaponGlow');
  expect(profile.reflection).toBeNull();
  expect(profile.bind.constant).toEqual([1]);
  expect(model.root.scale.toArray()).toEqual(profile.size.constant);
  expect(profile.position.constant).toEqual([0, 0, 0]);
  expect(model.meshes[0].geometry).toBe(f.geometry);
  expect(model.meshes[0].skeleton.bones[0]).not.toBe(f.source.children[0]);
  expect(model.sampler.renderRoot.scale.toArray()).toEqual([0.0137, 0.0137, 0.0137]);
  expect(model.root.position.y).toBe(2);
  expect(model.material.uniforms.sourceTexture.value).toBe(f.base);
  expect(model.material.uniforms.multiplierTexture.value).toBe(f.multiplier);
  expect(model.material.uniforms.alphaRef.value).toBe(5 / 255);
  expect(model.material.uniforms.multiplierUvTransform.value.elements).not.toEqual(
    model.material.uniforms.sourceUvTransform.value.elements
  );
  expect(model.material.uniforms.fresnelColor.value.toArray()).toEqual([0, 0, 0]);
  expect(f.world.snapshot()).toBe(before);
  f.release();
});
test('saved buff seeks reproduce private bones and repeated updates reuse the existing skeleton', () => {
  const f = fixture(),
    restored = World.fromSnapshot(f.world.snapshot(), f.world.battlefield),
    copy = new LeonaSolarSkins(new THREE.Scene(), () => 2, f.resources);
  f.view.update(f.world, 0.5);
  copy.update(restored, 0.5);
  expect(frame(copy)).toEqual(frame(f.view));
  const model = [...f.view.models.values()][0];
  f.view.update(f.world, 0.5);
  expect([...f.view.models.values()][0]).toBe(model);
  f.world.step(90);
  restored.step(90);
  f.view.update(f.world, 1);
  copy.update(restored, 1);
  expect(frame(copy)).toEqual(frame(f.view));
  expect(f.view.models.size).toBe(0);
  copy.dispose();
  f.release();
});
test('buff birth and current point vision gate the saved owner independently', () => {
  const f = fixture(),
    born = f.visual.frames.find((p) => p.tick === f.visual.startTick + 1)!;
  born.audience = ['red'];
  f.view.update(f.world, 1);
  expect(f.view.models.size).toBe(0);
  born.audience = ['blue'];
  f.view.update(f.world, 1);
  expect(f.view.models.size).toBe(1);
  f.world.pointVisible = () => false;
  f.view.update(f.world, 1);
  expect(f.view.models.size).toBe(0);
  f.release();
});
test('death freezes the source pose and expiry disposes owned rig/material without borrowed images or geometry', () => {
  const f = fixture();
  f.world.hero.x = f.leona.x - 200;
  f.world.hero.y = f.leona.y;
  f.world.step();
  f.world.damage(f.target, f.leona, 1e9, 'true');
  f.world.step();
  f.view.update(f.world, 1);
  const model = [...f.view.models.values()][0],
    before = frame(f.view);
  let bones = 0,
    materials = 0,
    borrowed = 0;
  model.meshes[0].skeleton.computeBoneTexture();
  model.meshes[0].skeleton.boneTexture!.addEventListener('dispose', () => bones++);
  model.material.addEventListener('dispose', () => materials++);
  for (const r of [f.geometry, f.material, f.base, f.multiplier])
    r.addEventListener('dispose', () => borrowed++);
  f.world.step(2);
  f.view.update(f.world, 1);
  expect(frame(f.view).map((p) => [p.position, p.bones, p.poseTick])).toEqual(
    before.map((p) => [p.position, p.bones, p.poseTick])
  );
  f.world.step(60);
  f.view.update(f.world, 1);
  expect(f.view.models.size).toBe(0);
  expect(f.scene.children).toHaveLength(0);
  expect([bones, materials, borrowed]).toEqual([1, 1, 0]);
  f.view.dispose();
  expect([bones, materials]).toEqual([1, 1]);
  f.release();
});
test('terminal presentation drains the frozen buff tail without advancing simulation', () => {
  const f = fixture();
  f.world.winner = 'blue';
  const before = f.world.snapshot();
  f.view.update(f.world, 1);
  expect(f.view.models.size).toBe(1);
  const pose = frame(f.view).map((p) => [p.position, p.bones, p.poseTick]);
  f.view.update(f.world, 1, 0.01);
  expect(frame(f.view).map((p) => [p.position, p.bones, p.poseTick])).toEqual(pose);
  f.view.update(f.world, 1, 1);
  expect(f.view.models.size).toBe(0);
  expect(f.world.snapshot()).toBe(before);
  f.release();
});

test('a missing source normal stream fails closed and releases the partial private rig', () => {
  const f = fixture();
  f.geometry.deleteAttribute('normal');
  expect(() => f.view.update(f.world, 1)).toThrow('authored normal stream');
  expect(f.view.models.size).toBe(0);
  expect(f.scene.children).toHaveLength(0);
  f.release();
});
