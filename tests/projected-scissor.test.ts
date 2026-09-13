import * as THREE from 'three';
import { expect, test } from 'vitest';
import { projectedScissor } from '../src/render/projected-scissor';
const box = (a: number[], b: number[]) =>
  new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b));
test('depth scissor covers all corners with physical-pixel padding and clamps edges', () => {
  const clip = new THREE.Matrix4(),
    size = new THREE.Vector2(1000, 500);
  expect(projectedScissor(box([-0.2, -0.2, 0], [0.2, 0.2, 0.5]), clip, size)?.toArray()).toEqual([
    398, 198, 204, 104,
  ]);
  expect(projectedScissor(box([0.9, -0.2, 0], [1.2, 0.2, 0.5]), clip, size)?.toArray()).toEqual([
    948, 198, 52, 104,
  ]);
  expect(projectedScissor(box([1.5, -0.2, 0], [2, 0.2, 0.5]), clip, size)?.z).toBe(0);
});
test('near-plane and behind-camera bounds use full-frame fallback', () => {
  expect(
    projectedScissor(
      box([-0.2, -0.2, -1], [0.2, 0.2, 0.5]),
      new THREE.Matrix4(),
      new THREE.Vector2(100, 100)
    )
  ).toBeNull();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  expect(
    projectedScissor(
      box([-0.1, -0.1, 0.1], [0.1, 0.1, 1]),
      camera.projectionMatrix,
      new THREE.Vector2(100, 100)
    )
  ).toBeNull();
});
