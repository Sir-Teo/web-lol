import { expect, test } from 'vitest';
import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import {
  animationCullingSphere,
  configureAnimationCulling,
  prepareAnimationBounds,
} from '../src/render/animation-bounds';

function rig() {
  const scene = new THREE.Group();
  const a = new THREE.Bone(),
    b = new THREE.Bone();
  a.name = 'jointA';
  b.name = 'jointB';
  a.add(b);
  b.position.set(0, 2, 0);
  scene.add(a);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([1, 2, 0, -2, 1, 3], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 1, 0, 0, 1, 0, 0, 0], 4));
  geometry.setAttribute(
    'skinWeight',
    new THREE.Float32BufferAttribute([0.5, 0.5, 0, 0, 1, 0, 0, 0], 4)
  );
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  mesh.name = 'building';
  mesh.position.set(1, 0, 2);
  scene.add(mesh);
  scene.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([a, b]));
  const clips = [
    new THREE.AnimationClip('move', 1, [
      new THREE.VectorKeyframeTrack('jointA.position', [0, 1], [0, 0, 0, 30, -10, 4]),
      new THREE.VectorKeyframeTrack('jointB.scale', [0, 1], [1, 1, 1, -3, 2, 0.5]),
      new THREE.QuaternionKeyframeTrack('jointA.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 1, 0]),
    ]),
  ];
  return { scene, mesh, clips };
}

test('bounds contain weighted skinning through translating, rotating and scaling bone chains and clones', () => {
  const { scene, mesh, clips } = rig();
  prepareAnimationBounds(scene, clips);
  expect(mesh.frustumCulled).toBe(true);
  const copied = clone(scene);
  copied.position.set(-100, 30, 40);
  copied.scale.set(2, 0.5, 3);
  const m = copied.getObjectByName('building') as THREE.SkinnedMesh;
  expect(m.boundingSphere).toEqual(mesh.boundingSphere);
  expect(m.boundingSphere).not.toBe(mesh.boundingSphere);
  const mixer = new THREE.AnimationMixer(copied);
  mixer.clipAction(clips[0]).play();
  const p = new THREE.Vector3();
  for (let step = 0; step < 100; step++) {
    mixer.setTime(step / 100);
    copied.updateMatrixWorld(true);
    for (let i = 0; i < 2; i++) {
      m.getVertexPosition(i, p);
      expect(p.distanceTo(m.boundingSphere!.center)).toBeLessThan(m.boundingSphere!.radius);
    }
  }
});

for (const kind of ['smooth', 'mesh-animation', 'additive', 'morph', 'detached'] as const)
  test(`unsupported ${kind} retains disabled culling`, () => {
    const { scene, mesh, clips } = rig();
    if (kind === 'smooth') clips[0].tracks[0].setInterpolation(THREE.InterpolateSmooth);
    if (kind === 'mesh-animation') clips[0].tracks[0].name = 'building.position';
    if (kind === 'additive') clips[0].blendMode = THREE.AdditiveAnimationBlendMode;
    if (kind === 'morph')
      mesh.geometry.morphAttributes.position = [mesh.geometry.attributes.position.clone()];
    if (kind === 'detached') mesh.bindMode = THREE.DetachedBindMode;
    prepareAnimationBounds(scene, clips);
    expect(mesh.frustumCulled).toBe(false);
    expect(mesh.userData.animationBounds).toBeUndefined();
  });

test('separate envelopes preserve the original first-pose sorting centre and clone independently', () => {
  const { scene, clips } = rig();
  const baseline = clone(scene);
  prepareAnimationBounds(scene, clips, true);
  const current = clone(scene);
  configureAnimationCulling(current);
  const originalMesh = baseline.getObjectByName('building') as THREE.SkinnedMesh;
  const mesh = current.getObjectByName('building') as THREE.SkinnedMesh & {
    intersectsFrustum: (f: THREE.Frustum) => boolean;
  };
  const mixers = [baseline, current].map((root) => {
    const mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(clips[0]).play();
    mixer.setTime(0.31);
    root.updateMatrixWorld(true);
    return mixer;
  });
  expect(mesh.boundingSphere).toBeNull();
  originalMesh.computeBoundingSphere();
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4());
  mesh.intersectsFrustum(frustum);
  expect(mesh.boundingSphere!.center.toArray()).toEqual(
    originalMesh.boundingSphere!.center.toArray()
  );
  const originalCenter = mesh.boundingSphere!.center.clone();
  const bound = animationCullingSphere(mesh)!;
  expect(bound).not.toBe(mesh.boundingSphere);
  const another = clone(current);
  configureAnimationCulling(another);
  const anotherMesh = another.getObjectByName('building') as THREE.SkinnedMesh;
  expect(animationCullingSphere(anotherMesh)).toEqual(bound);
  expect(animationCullingSphere(anotherMesh)).not.toBe(bound);
  const p = new THREE.Vector3();
  for (let step = 0; step < 100; step++) {
    mixers[1].setTime(step / 100);
    current.updateMatrixWorld(true);
    mesh.intersectsFrustum(frustum);
    expect(mesh.boundingSphere!.center.toArray()).toEqual(originalCenter.toArray());
    for (let i = 0; i < 2; i++) {
      mesh.getVertexPosition(i, p);
      expect(p.distanceTo(bound.center)).toBeLessThan(bound.radius);
    }
  }
});
