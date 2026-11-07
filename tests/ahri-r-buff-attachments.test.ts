import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { MOBILE_CLIP_DURATIONS, type MobileRig } from '../src/content/mobile-clip-durations';
import { TargetPoseSampler } from '../src/render/target-pose-sampler';
import { RBuffAttachmentRoots } from '../src/render/ahri-r-buff-attachments';
import { rBuffVisualGroups, rBuffVisualPose } from '../src/render/ahri-r-persistent-history';
import { rVisualGameplaySamples } from './helpers/ahri-r-visual-gameplay';
const snapshot = rVisualGameplaySamples(World, PRACTICE_FIXTURE, 'many-targets').find(
  (s) => s.tick === 60
)!.snapshot;
function setup(native = true) {
  const world = World.fromSnapshot(snapshot, PRACTICE_FIXTURE),
    made: TargetPoseSampler[] = [];
  const roots = new RBuffAttachmentRoots(
    () => 2,
    (rig: MobileRig) => {
      expect(rig).toBe('ahri-base');
      const reference = new THREE.Group();
      reference.scale.setScalar(0.01);
      for (const [index, name] of (native ? ['L_Eye', 'R_Eye'] : ['Eye_L', 'Eye_R']).entries()) {
        const bone = new THREE.Bone();
        bone.name = name;
        bone.position.set(index === 0 ? 20 : -20, 100, 30);
        reference.add(bone);
      }
      const sampler = new TargetPoseSampler(
        reference,
        Object.entries(MOBILE_CLIP_DURATIONS[rig]).map(
          ([name, seconds]) => new THREE.AnimationClip(name, seconds, [])
        )
      );
      vi.spyOn(sampler, 'dispose');
      made.push(sampler);
      return sampler;
    }
  );
  roots.begin(world);
  return {
    world,
    roots,
    made,
    groups: rBuffVisualGroups(world.ahriRVisuals[0]).filter((g) => g.system === 'Ahri_R_Eyes'),
  };
}
test('private saved eye bones produce distinct centimetre-committed roots without changing World', () => {
  const { world, roots, made, groups } = setup(),
    before = world.snapshot();
  const positions = groups.map((group, index) => {
    const pose = rBuffVisualPose(group, world.tick)!;
    const expected = new THREE.Vector3(index === 0 ? 0.2 : -0.2, 1, 0.3)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), pose.facing)
      .add(new THREE.Vector3(pose.x * 0.01, 2, pose.y * 0.01));
    expected.set(
      Math.fround(expected.x * 100) * 0.01,
      Math.fround(expected.y * 100) * 0.01,
      Math.fround(expected.z * 100) * 0.01
    );
    const point = roots.position(group, world.tick)!;
    expect(point.toArray()).toEqual(expected.toArray());
    const saved = point.toArray();
    point.set(0, 0, 0);
    expect(roots.position(group, world.tick)!.toArray()).toEqual(saved);
    return saved;
  });
  expect(positions[0]).not.toEqual(positions[1]);
  expect(roots.samplerCount).toBe(1);
  expect(roots.localFallbacks).toEqual([]);
  expect(world.snapshot()).toBe(before);
  roots.retain(new Set());
  expect(roots.samplerCount).toBe(0);
  expect(made[0].dispose).toHaveBeenCalledTimes(1);
});
test('missing source bones report named collision-height fallbacks without guessing aliases', () => {
  const { world, roots, groups } = setup(false);
  for (const group of groups) {
    const pose = rBuffVisualPose(group, world.tick)!;
    expect(roots.position(group, world.tick)!.toArray()).toEqual([
      pose.x * 0.01,
      2 + pose.radius * 0.015,
      pose.y * 0.01,
    ]);
  }
  expect(roots.localFallbacks).toEqual(groups.map((g) => `${g.key}:${g.bone}`).sort());
  roots.dispose();
  expect(roots.localFallbacks).toEqual([]);
});
test('World replacement retires private skeletons and restores exact eye roots', () => {
  const { world, roots, groups, made } = setup();
  const before = groups.map((g) => roots.position(g, world.tick)!.toArray());
  const restored = World.fromSnapshot(world.snapshot(), PRACTICE_FIXTURE);
  roots.begin(restored);
  expect(made[0].dispose).toHaveBeenCalledTimes(1);
  const fresh = rBuffVisualGroups(restored.ahriRVisuals[0]).filter(
    (g) => g.system === 'Ahri_R_Eyes'
  );
  expect(fresh.map((g) => roots.position(g, restored.tick)!.toArray())).toEqual(before);
  expect(roots.position(fresh[0], NaN)).toBeNull();
  expect(roots.position(fresh[0], fresh[0].startTick - 1)).toBeNull();
  roots.dispose();
  expect(made[1].dispose).toHaveBeenCalledTimes(1);
});
test('same-tick source observation replacement invalidates recent eye roots', () => {
  const { world, roots, groups } = setup(),
    group = groups[0];
  const before = roots.position(group, world.tick)!;
  const frames = group.record.sourceFrames,
    last = frames.at(-1)!;
  frames[frames.length - 1] = { ...last, point: { x: last.point.x + 100, y: last.point.y } };
  roots.begin(world);
  const after = roots.position(group, world.tick)!;
  expect(after.x - before.x).toBeCloseTo(1, 5);
  expect(after.y).toBe(before.y);
  expect(after.z).toBe(before.z);
  roots.dispose();
});
test('long-lived eye producers keep only roots within the owned pose-retention window', () => {
  const { world, roots, groups } = setup(),
    group = groups[0];
  for (let tick = 0; tick < 1200; tick++) {
    world.step();
    roots.begin(world);
    expect(roots.position(group, world.tick - 3)).not.toBeNull();
  }
  expect(roots.cachedPointCount).toBeGreaterThan(700);
  expect(roots.cachedPointCount).toBeLessThanOrEqual(721);
  roots.dispose();
  expect(roots.cachedPointCount).toBe(0);
});
