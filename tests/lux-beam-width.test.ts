import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { luxBeamWidth } from '../src/render/lux-beam-width';

it('faces the eye with source-reflected handedness and preserves full 3D orthogonality', () => {
  const source = new Vector3(1, 2, 3),
    target = new Vector3(8, 5, 10),
    eye = new Vector3(-2, 12, 20);
  const width = luxBeamWidth(source, target, eye);
  expect(width.length()).toBeCloseTo(1, 12);
  expect(width.dot(target.clone().sub(source))).toBeCloseTo(0, 12);
  expect(width.dot(eye.clone().sub(source))).toBeCloseTo(0, 12);
  const reflected = luxBeamWidth(new Vector3(), new Vector3(1, 0, 0), new Vector3(0, 1, 1));
  expect(reflected.x).toBe(0);
  expect(reflected.y).toBeCloseTo(-Math.SQRT1_2, 12);
  expect(reflected.z).toBeCloseTo(Math.SQRT1_2, 12);
  expect(source.toArray()).toEqual([1, 2, 3]);
});
it('keeps parallel views finite and collapses a zero-length beam', () => {
  for (const target of [new Vector3(1, 0, 0), new Vector3(0, 1, 0)]) {
    const width = luxBeamWidth(new Vector3(), target, target.clone().multiplyScalar(5));
    expect(width.length()).toBeCloseTo(1, 12);
    expect(width.dot(target)).toBe(0);
  }
  expect(luxBeamWidth(new Vector3(), new Vector3(), new Vector3(0, 1, 0)).toArray()).toEqual([
    0, 0, 0,
  ]);
});
