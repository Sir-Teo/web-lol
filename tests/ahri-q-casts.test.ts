import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { MOBILE_CLIP_DURATIONS } from '../src/content/mobile-clip-durations';
import { TargetPoseSampler } from '../src/render/target-pose-sampler';
import { AhriQCasts } from '../src/render/ahri-q-casts';
import data from '../src/content/ahri-q-cast-particles.json';
function setup() {
  const world = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    inBrush: () => false,
  });
  world.nextWaveTick = 1e9;
  const ahri = world.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  for (const u of world.units) u.ai = false;
  world.learnSpell('q', ahri.id);
  world.enqueue({ type: 'cast', unit: ahri.id, ability: 'q', point: { x: 900, y: 0 } });
  world.step();
  const reference = new THREE.Group(),
    bone = new THREE.Bone();
  bone.name = 'C_Buffbone_Glb_Center_Loc';
  bone.position.y = 100;
  const geometry = new THREE.BufferGeometry(),
    borrowed = ['Body', 'Eyes', 'Tails', 'Tail_Large'].map((name) => {
      const material = new THREE.MeshBasicMaterial();
      material.name = name;
      const mesh = new THREE.SkinnedMesh(geometry, material);
      mesh.bind(new THREE.Skeleton([bone]));
      reference.add(mesh);
      return material;
    });
  reference.add(bone);
  reference.scale.setScalar(0.01);
  const texture = new THREE.Texture(),
    sourceMesh = new THREE.BufferGeometry(),
    scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera();
  const resources = {
    texture: () => texture,
    mesh: () => sourceMesh,
    sampler: () =>
      new TargetPoseSampler(
        reference,
        Object.entries(MOBILE_CLIP_DURATIONS['ahri-base']).map(
          ([name, seconds]) => new THREE.AnimationClip(name, seconds, [])
        )
      ),
  };
  const view = new AhriQCasts(scene, () => 2, resources);
  const draw = (w = world, terminalAge = 0) => view.update(w, 1, camera, terminalAge);
  const release = () => {
    view.dispose();
    for (const m of borrowed) m.dispose();
    geometry.dispose();
    sourceMesh.dispose();
    texture.dispose();
  };
  return {
    world,
    ahri,
    view,
    draw,
    release,
    reference,
    borrowed,
    geometry,
    sourceMesh,
    texture,
    resources,
    scene,
    camera,
  };
}
function frame(view: AhriQCasts) {
  return {
    roots: [...view.models].map(([key, m]) => ({
      key,
      position: m.root.position.toArray(),
      center: m.center.toArray(),
      color: m.material.uniforms.particleColor.value.toArray(),
      erosion: m.material.uniforms.erosionParameters.value.toArray(),
    })),
    surfaces: [...view.surfaces.models].map(([key, m]) => ({
      key,
      position: m.position.toArray(),
      scale: m.scale.toArray(),
      uv: m.material.uniforms.sourceUvTransform.value.toArray(),
      color: m.material.uniforms.particleColor.value.toArray(),
    })),
  };
}
test('saved delayed birth creates three particles with only the authored Tails skin and checked material controls', () => {
  const f = setup();
  f.draw();
  expect(f.view.models.size).toBe(0);
  f.world.step(9);
  f.draw();
  expect(f.view.models.size).toBe(0);
  f.world.step(7);
  const before = f.world.snapshot();
  f.draw();
  expect(f.world.snapshot()).toBe(before);
  expect(f.view.models.size).toBe(1);
  expect(f.view.surfaces.models.size).toBe(2);
  const model = [...f.view.models.values()][0],
    selected: string[] = [];
  model.sampler.renderRoot.traverse((n) => {
    if (n instanceof THREE.Mesh && n.visible)
      selected.push(n.material === model.material ? 'Tails' : 'unexpected');
  });
  expect(selected).toEqual(['Tails']);
  expect(model.material.uniforms.fresnelPower.value).toBe(data.profiles[2].reflection!.mappedPower);
  expect(model.material.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
  expect(model.material.polygonOffsetUnits).toBe(-2);
  expect(model.center.y).toBe(3);
  const mesh = [...f.view.surfaces.models.values()].find((m) => m.userData.profileIndex === 1)!;
  expect(mesh.material.uniforms.sourceUvTransform.value.elements[0]).toBeCloseTo(-1);
  expect(mesh.material.uniforms.sourceUvTransform.value.elements[4]).toBeCloseTo(-2);
  expect(mesh.scale.toArray()).toEqual([-1.2000000476837158, 0.75, 1.2000000476837158]);
  expect(f.borrowed.map((m) => m.name)).toEqual(['Body', 'Eyes', 'Tails', 'Tail_Large']);
  f.release();
});
test('all bound particles follow the current pose and snapshot restoration recreates identical drawings', () => {
  const f = setup();
  f.world.step(18);
  f.draw();
  f.ahri.x = 200;
  f.ahri.previous.x = 200;
  f.ahri.facing = 0.75;
  f.draw();
  expect([...f.view.models.values()][0].root.position.x).toBe(2);
  expect([...f.view.surfaces.models.values()].every((m) => m.position.x === 2)).toBe(true);
  const expected = frame(f.view),
    copy = World.fromSnapshot(f.world.snapshot(), f.world.battlefield);
  f.view.dispose();
  f.draw(copy);
  expect(frame(f.view)).toEqual(expected);
  f.release();
});
test('hidden birth stays hidden after reveal, while current visibility retires and restores a visible birth', () => {
  const f = setup();
  f.world.step(18);
  const r = f.world.ahriQCastVisuals[0];
  r.birth!.audience = ['red'];
  f.draw();
  expect(f.view.models.size).toBe(0);
  r.birth!.audience = ['blue'];
  f.draw();
  expect(f.view.models.size).toBe(1);
  const visible = vi.spyOn(f.world, 'pointVisible').mockReturnValue(false);
  f.draw();
  expect(f.view.models.size).toBe(0);
  expect(f.view.surfaces.models.size).toBe(0);
  visible.mockRestore();
  f.draw();
  expect(f.view.models.size).toBe(1);
  f.release();
});
test('born skin outlives short surfaces and owner death then drains at victory without mutating World', () => {
  const f = setup();
  f.world.step(18);
  f.draw();
  f.world.hero.x = f.world.hero.y = 0;
  f.ahri.hp = 0;
  f.world.step(40);
  f.draw();
  expect(f.view.models.size).toBe(1);
  expect(f.view.surfaces.models.size).toBe(0);
  f.world.winner = 'blue';
  const before = f.world.snapshot();
  f.draw(f.world, 4);
  expect(f.view.models.size).toBe(0);
  expect(f.world.snapshot()).toBe(before);
  f.release();
});
test('retirement disposes private material/skeleton resources and preserves borrowed assets', () => {
  const f = setup();
  f.world.step(18);
  f.draw();
  const model = [...f.view.models.values()][0],
    material = vi.spyOn(model.material, 'dispose'),
    geometry = vi.spyOn(f.geometry, 'dispose'),
    texture = vi.spyOn(f.texture, 'dispose');
  const sampler = vi.spyOn(model.sampler, 'dispose');
  f.view.dispose();
  f.view.dispose();
  expect(material).toHaveBeenCalledTimes(1);
  expect(sampler).toHaveBeenCalledTimes(1);
  expect(geometry).not.toHaveBeenCalled();
  expect(texture).not.toHaveBeenCalled();
  expect(f.scene.children).toHaveLength(0);
  f.release();
});
