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

it('renders a private skeleton and retires its bone texture exactly once without touching borrowed data', () => {
  const { root, joint, clips } = fixture(),
    geometry = new THREE.BufferGeometry(),
    material = new THREE.MeshBasicMaterial(),
    mesh = new THREE.SkinnedMesh(geometry, material),
    sourceSkeleton = new THREE.Skeleton([joint]);
  root.add(mesh);
  mesh.bind(sourceSkeleton);
  sourceSkeleton.computeBoneTexture();
  const sampler = new TargetPoseSampler(root, clips),
    parent = new THREE.Group();
  parent.add(sampler.renderRoot);
  const copy = sampler.renderRoot.children.find(
    (o) => o instanceof THREE.SkinnedMesh
  ) as THREE.SkinnedMesh;
  expect(copy.geometry).toBe(geometry);
  expect(copy.material).toBe(material);
  expect(copy.skeleton).not.toBe(sourceSkeleton);
  expect(copy.skeleton.bones[0]).not.toBe(joint);
  copy.skeleton.computeBoneTexture();
  let privateDisposals = 0,
    borrowedDisposals = 0;
  copy.skeleton.boneTexture!.addEventListener('dispose', () => privateDisposals++);
  for (const resource of [geometry, material, sourceSkeleton.boneTexture!])
    resource.addEventListener('dispose', () => borrowedDisposals++);
  sampler.sample([{ clip: 'move', time: 0.5, weight: 1 }]);
  expect(copy.skeleton.bones[0].position.x).toBe(2);
  expect(joint.position.x).toBe(0);
  sampler.dispose();
  sampler.dispose();
  expect(parent.children).toHaveLength(0);
  expect(privateDisposals).toBe(1);
  expect(borrowedDisposals).toBe(0);
  expect(() => sampler.renderRoot).toThrow('disposed');
  sourceSkeleton.dispose();
  geometry.dispose();
  material.dispose();
});

it('selects an authored chest independently of Lux critical routing, preserving its complete matrix and case-folded uniqueness', () => {
  const { root, clips } = fixture(),
    s = new TargetPoseSampler(root, clips),
    point = new THREE.Vector3(),
    matrix = new THREE.Matrix4();
  s.sample([{ clip: 'move', time: 0.5, weight: 1 }]);
  expect(s.bonePosition('c_buffbone_glb_chest_loc', point)).toBe(true);
  expect(point.toArray()).toEqual([12, 2, 0]);
  expect(s.boneMatrix('C_BUFFBONE_GLB_CHEST_LOC', matrix)).toBe(true);
  expect(new THREE.Vector3().setFromMatrixPosition(matrix)).toEqual(point);
  s.hitPosition(false, point);
  expect(point.toArray()).toEqual([12, 1, 0]);
  s.dispose();
  expect(() => s.boneMatrix('weapon', matrix)).toThrow('disposed');
  const duplicate = new THREE.Bone();
  duplicate.name = 'c_buffbone_glb_chest_loc';
  root.add(duplicate);
  const ambiguous = new TargetPoseSampler(root, clips);
  expect(() => ambiguous.bonePosition(duplicate.name, point)).toThrow('Ambiguous');
  ambiguous.dispose();
});
