import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { MOBILE_CLIP_DURATIONS, type MobileRig } from '../src/content/mobile-clip-durations';
import { TargetPoseSampler } from '../src/render/target-pose-sampler';
import { AhriRBuffParticles } from '../src/render/ahri-r-buff-effects';
const field = {
  ...PRACTICE_FIXTURE,
  initialUnits: [],
  lineOfSight: () => true,
  inBrush: () => false,
  lineWalkable: () => true,
  reachable: (p: { x: number; y: number }) => ({ ...p }),
  findPath: (_a: unknown, b: { x: number; y: number }) => [{ ...b }],
};
function setup(team: 'blue' | 'red' = 'blue') {
  const world = new World(false, field);
  world.nextWaveTick = 1e9;
  Object.assign(world.hero, { ai: false, x: -3000, y: -3000, previous: { x: -3000, y: -3000 } });
  const source = world.spawn('champion', team, { x: 0, y: 0 }, 'ahri');
  source.ai = false;
  world.gainExperience(1e6, source.id);
  world.learnSpell('r', source.id);
  world.enqueue({ type: 'cast', unit: source.id, ability: 'r', point: { x: 300, y: 0 } });
  world.step();
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000),
    texture = new THREE.Texture();
  camera.position.set(10, 15, 12);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const resources = {
    texture: () => texture,
    mesh: () => {
      throw Error('Eye glows must not request mesh geometry');
    },
    sampler: (rig: MobileRig) => {
      const reference = new THREE.Group();
      reference.scale.setScalar(0.01);
      for (const [index, name] of ['L_Eye', 'R_Eye', 'C_Buffbone_Glb_Layout_Loc'].entries()) {
        const bone = new THREE.Bone();
        bone.name = name;
        bone.position.set(
          index === 0 ? 20 : index === 1 ? -20 : 0,
          index === 2 ? 40 : 100,
          index === 2 ? 0 : 30
        );
        reference.add(bone);
      }
      return new TargetPoseSampler(
        reference,
        Object.entries(MOBILE_CLIP_DURATIONS[rig]).map(
          ([name, seconds]) => new THREE.AnimationClip(name, seconds, [])
        )
      );
    },
  };
  const view = new AhriRBuffParticles(scene, new THREE.Scene(), () => 2, resources);
  const draw = (current = world, terminal = 0) => view.update(current, 1, camera, terminal);
  const capture = () =>
    [...view.surfaces.models]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, m]) => ({
        key,
        profile: m.userData.profileIndex,
        position: m.position.toArray(),
        quaternion: m.quaternion.toArray(),
        scale: m.scale.toArray(),
        color: m.material.uniforms.particleColor.value.toArray(),
        uv: m.material.uniforms.sourceUvTransform.value.toArray(),
      }));
  const dispose = () => {
    view.dispose();
    texture.dispose();
  };
  const captureRibbons = () =>
    [...view.models]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, mesh]) => ({
        key,
        profile: mesh.userData.profileIndex,
        count: mesh.geometry.drawRange.count,
        attributes: Object.fromEntries(
          Object.entries(mesh.geometry.attributes).map(([name, attribute]) => [
            name,
            Array.from(
              attribute.array.slice(0, mesh.geometry.drawRange.count * attribute.itemSize)
            ),
          ])
        ),
      }));
  return { world, source, view, scene, texture, draw, capture, captureRibbons, dispose };
}
test('both native eye instances draw finite glow packets and restore exactly after rolling pose retention', () => {
  const f = setup();
  for (let i = 0; i < 1200; i++) {
    if (i === 499 || i === 999) {
      const victim = f.world.spawn('champion', 'red', { x: f.source.x, y: f.source.y }, 'lux');
      victim.ai = false;
      f.world.damage(f.source, victim, 1e6, 'true');
    }
    f.world.step();
  }
  f.world.setOrder(f.source, { type: 'move', point: { x: f.source.x, y: f.source.y + 1500 } });
  f.world.step(15);
  expect(f.world.ahriRVisuals[0].sourceFrames[0].tick).toBeGreaterThan(1);
  f.draw();
  const before = f.capture(),
    ribbons = f.captureRibbons(),
    saved = f.world.snapshot();
  expect(before.length).toBeGreaterThanOrEqual(4);
  expect(new Set(before.map((m) => m.profile))).toEqual(new Set([45, 46, 53]));
  expect(new Set(before.map((m) => m.key.split(':buff:')[1]?.split(':')[0]))).toEqual(
    new Set(['L_Eye', 'R_Eye', 'C_Buffbone_Glb_Layout_Loc'])
  );
  expect(f.view.attachmentFallbacks).toEqual([]);
  expect(new Set(ribbons.map((mesh) => mesh.profile))).toEqual(new Set([47, 48]));
  expect(ribbons.every((mesh) => mesh.count > 0)).toBe(true);
  f.draw(World.fromSnapshot(saved, field));
  expect(f.capture()).toEqual(before);
  expect(f.captureRibbons()).toEqual(ribbons);
  f.draw(f.world);
  expect(f.capture()).toEqual(before);
  expect(f.captureRibbons()).toEqual(ribbons);
  expect(f.world.snapshot()).toBe(saved);
  f.dispose();
});
test('the finite layout quad retains its native bone height and restores near expiry without projecting onto terrain', () => {
  const f = setup();
  f.world.step(550);
  f.world.setOrder(f.source, {
    type: 'move',
    point: { x: f.source.x + 500, y: f.source.y + 300 },
  });
  f.world.step(45);
  f.draw();
  const layout = [...f.view.surfaces.models.values()].filter(
    (mesh) => mesh.userData.profileIndex === 50
  );
  expect(layout).toHaveLength(1);
  expect(
    [...f.view.surfaces.models.keys()].some((key) => key.includes('C_Buffbone_Glb_Layout_Loc'))
  ).toBe(true);
  expect(layout[0].position.y).toBe(2.4);
  expect(layout[0].geometry.getAttribute('position').count).toBe(4);
  expect(layout[0].geometry.userData.groundQuadTopology).toBeUndefined();
  expect(f.view.attachmentFallbacks).toEqual([]);
  const saved = f.world.snapshot(),
    before = f.capture();
  f.draw(World.fromSnapshot(saved, field));
  expect(f.capture()).toEqual(before);
  f.draw(f.world);
  expect(f.capture()).toEqual(before);
  expect(f.world.snapshot()).toBe(saved);
  f.world.step(20);
  f.draw();
  expect(
    [...f.view.surfaces.models.values()].some((mesh) => mesh.userData.profileIndex === 50)
  ).toBe(false);
  f.dispose();
});
test('continuous layout glow restores after genuine Essence extensions beyond the old fifty-second glow window', () => {
  const f = setup();
  for (let tick = 1; tick <= 4200; tick++) {
    if (tick % 500 === 0) {
      const victim = f.world.spawn('champion', 'red', { x: f.source.x, y: f.source.y }, 'lux');
      victim.ai = false;
      f.world.damage(f.source, victim, 1e6, 'true');
    }
    f.world.step();
  }
  const record = f.world.ahriRVisuals[0];
  expect(record.end).toBeNull();
  expect(record.sourceFrames[0].tick).toBeGreaterThan(record.startTick + 50 * 60);
  f.draw();
  const before = f.capture(),
    saved = f.world.snapshot();
  expect(before.length).toBeGreaterThan(0);
  expect(new Set(before.map((m) => m.profile))).toEqual(new Set([53]));
  expect(before.every((m) => m.key.includes(':buff:C_Buffbone_Glb_Layout_Loc:'))).toBe(true);
  expect(before.every((m) => m.position[1] > 2.4)).toBe(true);
  expect(f.view.attachmentFallbacks).toEqual([]);
  f.draw(World.fromSnapshot(saved, field));
  expect(f.capture()).toEqual(before);
  f.draw(f.world);
  expect(f.capture()).toEqual(before);
  expect(f.world.snapshot()).toBe(saved);
  f.dispose();
});
test('hidden enemy eye effects follow current saved visibility and the selected viewing team', () => {
  const f = setup('red');
  let revealed = false;
  f.world.visible = (unit, team) => unit.team === team || team === 'red' || revealed;
  f.world.pointVisible = (_point, team) => team === 'red' || revealed;
  f.world.step(100);
  f.draw();
  expect(f.view.surfaces.models.size).toBe(0);
  expect(f.view.models.size).toBe(0);
  revealed = true;
  f.world.step();
  f.draw();
  expect(f.view.surfaces.models.size).toBeGreaterThan(0);
  expect(f.view.models.size).toBeGreaterThan(0);
  revealed = false;
  f.world.step();
  f.draw();
  expect(f.view.surfaces.models.size).toBe(0);
  expect(f.view.models.size).toBe(0);
  f.world.hero.team = 'red';
  f.draw();
  expect(f.view.surfaces.models.size).toBeGreaterThan(0);
  f.dispose();
});
test('victory drains eye effects on the presentation clock without World steps or borrowed-texture disposal', () => {
  const f = setup();
  f.world.step(100);
  f.draw();
  const materials = [...f.view.surfaces.models.values()].map((m) =>
    vi.spyOn(m.material, 'dispose')
  );
  const ribbons = [...f.view.models.values()].map((mesh) => ({
    geometry: vi.spyOn(mesh.geometry, 'dispose'),
    material: vi.spyOn(mesh.material, 'dispose'),
  }));
  expect(ribbons.length).toBeGreaterThan(0);
  const texture = vi.spyOn(f.texture, 'dispose');
  const nexus = f.world.spawn('nexus', 'red', { x: 1500, y: 1500 });
  f.world.damage(f.world.hero, nexus, 1e6, 'true');
  expect(f.world.winner).toBe('blue');
  const saved = f.world.snapshot();
  f.draw();
  f.draw(f.world, 3);
  expect(f.view.surfaces.models.size).toBe(0);
  expect(f.view.models.size).toBe(0);
  expect(f.world.snapshot()).toBe(saved);
  f.view.dispose();
  expect(f.scene.children).toHaveLength(0);
  expect(texture).not.toHaveBeenCalled();
  for (const material of materials) expect(material).toHaveBeenCalledTimes(1);
  for (const ribbon of ribbons) {
    expect(ribbon.geometry).toHaveBeenCalledTimes(1);
    expect(ribbon.material).toHaveBeenCalledTimes(1);
  }
  f.texture.dispose();
});
