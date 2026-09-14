import { expect, it } from 'vitest';
import * as THREE from 'three';
import { LuxImpactAttachments } from '../src/render/lux-impact-attachments';
import { TargetPoseSampler } from '../src/render/target-pose-sampler';
import type { LuxImpactVisual, LuxImpactFrame } from '../src/simulation/types';
function effect(): LuxImpactVisual {
  const frame = (tick: number, x: number, facing: number, time: number): LuxImpactFrame => ({
    tick,
    x,
    y: 0,
    facing,
    structurePose: null,
    animationTimeline: {
      tick,
      primary: {
        clip: 'idle1',
        kind: 'idle',
        time,
        rate: 0,
        loop: false,
        unclampedTime: time,
        cut: false,
        settled: true,
      },
      transition: null,
    },
  });
  return {
    id: 3,
    sourceId: 1,
    targetId: 2,
    targetRig: 'ashe-base',
    targetTransform: null,
    team: 'blue',
    critical: true,
    startTick: 0,
    detachedTick: null,
    frames: [frame(0, 0, 0, 0), frame(1, 100, Math.PI / 2, 1)],
  };
}
it('places historical source bones with saved facing, elevation, interpolation and independent restore caches', () => {
  const reference = new THREE.Group(),
    center = new THREE.Bone(),
    chest = new THREE.Bone();
  center.name = 'C_BUFFBONE_GLB_CENTER_LOC';
  center.position.y = 1;
  chest.name = 'C_BUFFBONE_GLB_CHEST_LOC';
  chest.position.set(1, 2, 0);
  reference.add(center, chest);
  const clip = new THREE.AnimationClip('idle1', 1, [
    new THREE.VectorKeyframeTrack(`${chest.name}.position`, [0, 1], [1, 2, 0, 3, 2, 0]),
  ]);
  const sampler = new TargetPoseSampler(reference, [clip]);
  const path = new LuxImpactAttachments(sampler, (p) => p.x * 0.005),
    e = effect();
  expect(path.point(e, 0).toArray()).toEqual([1, 2, 0]);
  const end = path.point(e, 1);
  expect(end.x).toBeCloseTo(1, 12);
  expect(end.y).toBe(2.5);
  expect(end.z).toBeCloseTo(-3, 12);
  expect(path.point(e, 0.5).toArray()).toEqual(path.point(e, 0).lerp(end, 0.5).toArray());
  path.point(e, 1).set(100, 100, 100);
  expect(path.point(e, 10)).toEqual(end);
  expect(path.point(e, -10).toArray()).toEqual([1, 2, 0]);
  expect(path.point({ ...e, critical: false }, 1).toArray()).toEqual([1, 1.5, 0]);
  const restored = structuredClone(e);
  restored.frames[1].animationTimeline!.primary.time = 0;
  restored.frames[1].animationTimeline!.primary.unclampedTime = 0;
  expect(path.point(restored, 1).z).toBeCloseTo(-1, 12);
  expect(path.point(e, 1)).toEqual(end);
  expect(chest.position.toArray()).toEqual([1, 2, 0]);
  path.dispose();
  expect(() => sampler.sample([])).toThrow('disposed');
});
it('retains an explicit centre fallback for unsupported poses, including elevation interpolation', () => {
  const e = effect();
  e.targetRig = null;
  e.frames.forEach((f) => (f.animationTimeline = null));
  const path = new LuxImpactAttachments(null, (p) => p.x * 0.01);
  expect(path.point(e, 0).toArray()).toEqual([0, 0.9, 0]);
  expect(path.point(e, 0.5).toArray()).toEqual([0.5, 1.4, 0]);
  path.dispose();
});

it('applies authored scale, translation and axis conversion to structure bones, with explicit missing-bone fallback', () => {
  const root = new THREE.Group(),
    chest = new THREE.Bone();
  chest.name = 'C_BUFFBONE_GLB_CHEST_LOC';
  chest.position.set(1, 2, 3);
  root.add(chest);
  const clip = new THREE.AnimationClip('idle1', 1, []);
  const path = new LuxImpactAttachments(new TargetPoseSampler(root, [clip]), () => 999);
  const e = effect();
  e.targetRig = 'blue-turret';
  e.targetTransform = [2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 8000, 500, 7000, 1];
  for (const frame of e.frames) {
    frame.animationTimeline = null;
    frame.structurePose = { kind: 'idle', clip: 'idle1', time: 0, loop: true };
  }
  expect(path.point(e, 0).toArray()).toEqual([7.75, 11, -7.75]);
  const fixture = structuredClone(e);
  fixture.targetTransform = null;
  expect(path.point(fixture, 0).toArray()).toEqual([1, 1001, -3]);
  const missing = new LuxImpactAttachments(
    new TargetPoseSampler(new THREE.Group(), [clip]),
    () => 4
  );
  const noBone = structuredClone(e);
  noBone.targetRig = 'blue-inhibitor';
  expect(missing.point(noBone, 0).toArray()).toEqual([0, 4.9, 0]);
  expect(() => missing.point(e, 0)).toThrow('turret rig');
  path.dispose();
  missing.dispose();
});
