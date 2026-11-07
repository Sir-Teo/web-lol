import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { MOBILE_CLIP_DURATIONS, type MobileRig } from '../src/content/mobile-clip-durations';
import { eVisualGameplaySamples } from './helpers/ahri-e-visual-gameplay';
import { TargetPoseSampler } from '../src/render/target-pose-sampler';
import { EAttachmentRoots, eVisualAttachment } from '../src/render/ahri-e-attachments';
import { eVisualGroups, eVisualPose } from '../src/render/ahri-e-history';

const snapshot = eVisualGameplaySamples(World, PRACTICE_FIXTURE, 'hit').find(
  (s) => s.tick === 45
)!.snapshot;
function setup(spine = true) {
  const world = World.fromSnapshot(snapshot, PRACTICE_FIXTURE),
    made: TargetPoseSampler[] = [];
  const roots = new EAttachmentRoots(
    () => 2,
    (rig: MobileRig) => {
      const reference = new THREE.Group();
      reference.scale.setScalar(0.01);
      for (const name of [
        'C_Buffbone_Glb_Center_Loc',
        'C_BUFFBONE_GLB_HEAD_LOC',
        'C_BUFFBONE_GLB_LAYOUT_LOC',
        spine ? 'spine' : 'C_BUFFBONE_GLB_SPINE_LOC',
      ]) {
        const bone = new THREE.Bone();
        bone.name = name;
        bone.position.set(20, 100, 30);
        reference.add(bone);
      }
      const sampler = new TargetPoseSampler(
        reference,
        Object.entries(MOBILE_CLIP_DURATIONS[rig]).map(
          ([name, seconds]) => new THREE.AnimationClip(name, seconds, [])
        )
      );
      vi.spyOn(sampler, 'dispose');
      vi.spyOn(sampler, 'sample');
      made.push(sampler);
      return sampler;
    }
  );
  roots.begin(world);
  return { world, roots, made, groups: eVisualGroups(world.ahriEVisuals[0]) };
}
test('E attachment roots use private exact-name poses in saved body frames without changing World', () => {
  const { world, roots, made, groups } = setup(),
    before = world.snapshot();
  for (const group of groups.filter((g) => g.role !== 'flight')) {
    const pose = eVisualPose(group, 45)!;
    const expected = new THREE.Vector3(0.2, 1, 0.3)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), pose.facing)
      .add(new THREE.Vector3(pose.x * 0.01, 2, pose.y * 0.01));
    expected.set(
      Math.fround(expected.x * 100) * 0.01,
      Math.fround(expected.y * 100) * 0.01,
      Math.fround(expected.z * 100) * 0.01
    );
    expect(roots.position(group, 45)!.toArray()).toEqual(expected.toArray());
  }
  expect(roots.samplerCount).toBe(2);
  expect(roots.localFallbacks).toEqual([]);
  expect(world.snapshot()).toBe(before);
  roots.retain(new Set());
  expect(roots.samplerCount).toBe(0);
  for (const sampler of made) expect(sampler.dispose).toHaveBeenCalledTimes(1);
  roots.dispose();
});
test('missing native hit-bone names remain explicit local fallbacks rather than invented aliases', () => {
  const { roots, groups } = setup(false),
    hit = groups.find((g) => g.role === 'hit')!;
  expect(eVisualAttachment(hit)).toBe('spine');
  const pose = eVisualPose(hit, 45)!;
  expect(roots.position(hit, 45)!.toArray()).toEqual([
    pose.x * 0.01,
    2 + pose.radius * 0.015,
    pose.y * 0.01,
  ]);
  expect(roots.localFallbacks).toEqual([hit.key + ':spine']);
  roots.retain(new Set());
  expect(roots.localFallbacks).toEqual([]);
  roots.dispose();
});
test('flight root uses the explicit one-metre adapter and returned vectors cannot poison cache', () => {
  const { roots, made, groups } = setup(),
    flight = groups.find((g) => g.role === 'flight')!;
  const pose = eVisualPose(flight, 25)!,
    point = roots.position(flight, 25)!;
  expect(point.toArray()).toEqual([pose.x * 0.01, 3, pose.y * 0.01]);
  point.set(999, 999, 999);
  expect(roots.position(flight, 25)!.toArray()).toEqual([pose.x * 0.01, 3, pose.y * 0.01]);
  expect(made).toHaveLength(0);
  for (const tick of [NaN, Infinity, -Infinity]) expect(roots.position(flight, tick)).toBeNull();
  roots.dispose();
});
test('current-tick pose queries refresh while old poses stay cached and World replacement disposes samplers', () => {
  const { world, roots, made, groups } = setup(),
    cast = groups[0];
  roots.position(cast, 1);
  roots.position(cast, 45);
  expect(made[0].sample).toHaveBeenCalledTimes(2);
  roots.begin(world);
  roots.position(cast, 1);
  roots.position(cast, 45);
  expect(made[0].sample).toHaveBeenCalledTimes(3);
  const copy = World.fromSnapshot(world.snapshot(), world.battlefield);
  roots.begin(copy);
  expect(made[0].dispose).toHaveBeenCalledTimes(1);
  roots.position(eVisualGroups(copy.ahriEVisuals[0])[0], 45);
  expect(made).toHaveLength(2);
  roots.dispose();
});

test('native bone handoff commits source-centimetre float32 before tiny private-matrix rounding noise', () => {
  const { world, roots, made, groups } = setup(),
    cast = groups[0];
  const expected = roots.position(cast, 45)!.toArray();
  const sampler = made[0],
    native = sampler.bonePosition.bind(sampler);
  const read = vi.spyOn(sampler, 'bonePosition').mockImplementation((name, out) => {
    const found = native(name, out);
    out.y += Number.EPSILON * 4;
    return found;
  });
  roots.begin(world);
  expect(roots.position(cast, 45)!.toArray()).toEqual(expected);
  expect(read).toHaveBeenCalled();
  roots.dispose();
});
