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
