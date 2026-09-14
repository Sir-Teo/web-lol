import { expect, test } from 'vitest';
import * as THREE from 'three';
import { writeRayQuad } from '../src/render/ray-quad';

const vector = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const ray = {
  center: vector(10, 20, 30),
  axis: vector(0, 0, 1),
  fallbackAcross: vector(-1, 0, 0),
  size: [4, 6, 2] as const,
};
function buffers(count = 6) {
  return {
    position: new THREE.BufferAttribute(new Float32Array(count * 3), 3),
    uv: new THREE.BufferAttribute(new Float32Array(count * 2), 2),
  };
}
function points(attribute: THREE.BufferAttribute) {
  return Array.from({ length: attribute.count }, (_, i) => [
    attribute.getX(i),
    attribute.getY(i),
    attribute.getZ(i),
  ]);
}

test('ray uses full extents, starts at the authored axial displacement, and preserves UV direction', () => {
  const { position, uv } = buffers();
  writeRayQuad(position, uv, 0, ray, vector(10, 30, 30));
  expect(points(position)).toEqual([
    [8, 20, 32],
    [12, 20, 32],
    [12, 20, 38],
    [8, 20, 32],
    [12, 20, 38],
    [8, 20, 38],
  ]);
  expect([...uv.array]).toEqual([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0]);
});

test('camera motion turns width around the source axis without changing length', () => {
  const { position, uv } = buffers();
  writeRayQuad(position, uv, 0, ray, vector(20, 20, 30));
  expect(points(position)).toEqual([
    [10, 22, 32],
    [10, 18, 32],
    [10, 18, 38],
    [10, 22, 32],
    [10, 18, 38],
    [10, 22, 38],
  ]);
});

test('axial and coincident eyes use the provided source X axis with no NaNs', () => {
  const { position, uv } = buffers();
  for (const eye of [vector(10, 20, 100), ray.center]) {
    writeRayQuad(position, uv, 0, ray, eye);
    expect(points(position)[0]).toEqual([12, 20, 32]);
    expect([...position.array].every(Number.isFinite)).toBe(true);
  }
});

test('writes one particle without replacing or corrupting surrounding buffer data', () => {
  const { position, uv } = buffers(18);
  position.array.fill(99);
  uv.array.fill(99);
  const original = position.array;
  writeRayQuad(position, uv, 6, ray, vector(10, 30, 30));
  expect(position.array).toBe(original);
  expect([...position.array.slice(0, 18), ...position.array.slice(36)]).toEqual(Array(36).fill(99));
  expect([...uv.array.slice(0, 12), ...uv.array.slice(24)]).toEqual(Array(24).fill(99));
  expect(() => writeRayQuad(position, uv, 13, ray, ray.center)).toThrow(RangeError);
  expect(() => writeRayQuad(position, uv, 0, { ...ray, size: [NaN, 1, 0] }, ray.center)).toThrow(
    RangeError
  );
});
