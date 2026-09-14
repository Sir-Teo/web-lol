import { expect, it } from 'vitest';
import * as THREE from 'three';
import { TargetPoseSampler } from '../src/render/target-pose-sampler';
function fixture() {
  const root = new THREE.Group(),
    joint = new THREE.Bone(),
    center = new THREE.Bone(),
    chest = new THREE.Bone();
  root.position.set(10, 0, 0);
  joint.name = 'Joint';
  center.name = 'C_BUFFBONE_GLB_CENTER_LOC';
  chest.name = 'C_BUFFBONE_GLB_CHEST_LOC';
  center.position.y = 1;
  chest.position.y = 2;
  root.add(joint);
  joint.add(center, chest);
  const clips = [
    new THREE.AnimationClip('move', 1, [
      new THREE.VectorKeyframeTrack('Joint.position', [0, 1], [0, 0, 0, 4, 0, 0]),
    ]),
    new THREE.AnimationClip('turn', 1, [
      new THREE.QuaternionKeyframeTrack('Joint.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 1, 0]),
    ]),
  ];
  return { root, joint, clips };
}
it('samples hierarchy translation, rotation and weighted rest contribution without touching the reference', () => {
  const { root, joint, clips } = fixture(),
    s = new TargetPoseSampler(root, clips),
    p = new THREE.Vector3();
  s.sample([{ clip: 'move', time: 0.5, weight: 1 }]);
  expect(s.hitPosition(false, p)).toBe(true);
  expect(p.toArray()).toEqual([12, 1, 0]);
  s.sample([{ clip: 'turn', time: 0.5, weight: 1 }]);
  s.hitPosition(true, p);
  expect(p.x).toBeCloseTo(8, 7);
  expect(p.y).toBeCloseTo(0, 7);
  s.sample([{ clip: 'move', time: 1, weight: 0.25 }]);
  s.hitPosition(false, p);
  expect(p.toArray()).toEqual([11, 1, 0]);
  expect(joint.position.toArray()).toEqual([0, 0, 0]);
  expect(joint.quaternion.toArray()).toEqual([0, 0, 0, 1]);
  s.sample([]);
  s.hitPosition(false, p);
  expect(p.toArray()).toEqual([10, 1, 0]);
  s.dispose();
});
it('seeks independently of call order, clamps clip time, and rejects invalid layers before mutation', () => {
  const { root, clips } = fixture(),
    s = new TargetPoseSampler(root, clips),
    p = new THREE.Vector3();
  const pose = [
    { clip: 'move', time: 0.3, weight: 0.6 },
    { clip: 'turn', time: 0.8, weight: 0.4 },
  ];
  s.sample(pose);
  s.hitPosition(true, p);
  const expected = p.clone();
  s.sample([{ clip: 'move', time: 50, weight: 1 }]);
  s.hitPosition(false, p);
  expect(p.toArray()).toEqual([14, 1, 0]);
  s.sample(pose);
  s.hitPosition(true, p);
  expect(p.toArray()).toEqual(expected.toArray());
  for (const layers of [
    [{ clip: 'absent', time: 0, weight: 1 }],
    [...pose, pose[0]],
    [{ clip: 'move', time: NaN, weight: 1 }],
    [{ clip: 'move', time: 0, weight: -1 }],
  ]) {
    expect(() => s.sample(layers)).toThrow();
    s.hitPosition(true, p);
    expect(p.toArray()).toEqual(expected.toArray());
  }
  s.dispose();
  s.dispose();
  expect(() => s.sample([])).toThrow();
});
it('reports missing bones and never disposes borrowed render resources', () => {
  const root = new THREE.Group(),
    geometry = new THREE.BoxGeometry(),
    material = new THREE.MeshBasicMaterial();
  root.add(new THREE.Mesh(geometry, material));
  let count = 0;
  geometry.addEventListener('dispose', () => count++);
  material.addEventListener('dispose', () => count++);
  const sampler = new TargetPoseSampler(root, []),
    p = new THREE.Vector3(7, 8, 9);
  sampler.sample([]);
  expect(sampler.hitPosition(true, p)).toBe(false);
  expect(p.toArray()).toEqual([7, 8, 9]);
  sampler.dispose();
  expect(count).toBe(0);
  geometry.dispose();
  material.dispose();
});
