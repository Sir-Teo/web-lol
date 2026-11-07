import { expect, test } from 'vitest';
import samples from '../docs/reference/source-particle-draw-samples.json';
import {
  sourceParticleOrbit,
  sourceParticleStretch,
  type SourceStretchGeometry,
} from '../src/render/source-particle-draw-values';
const hex = (array: Float32Array) =>
  Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('hex');
for (const [index, sample] of samples.orbits.entries())
  test('external birth orbital basis ' + index, () => {
    const result = sourceParticleOrbit(sample.velocity, sample.age);
    expect(result ? hex(result) : null).toBe(sample.expected);
  });
for (const [index, sample] of samples.stretches.entries())
  test('external particle velocity stretch ' + index, () => {
    expect(
      sourceParticleStretch(
        sample.geometry as SourceStretchGeometry,
        sample.travel,
        sample.scale,
        sample.minimum,
        sample.simple
      )
    ).toBe(sample.expected);
  });

test('orbital output storage is independent and zero orbital velocity remains absent', () => {
  const velocity = [0, 1.5, 0],
    expected = sourceParticleOrbit(velocity, 0.5)!;
  sourceParticleOrbit(velocity, 0.5)!.fill(999);
  expect(sourceParticleOrbit(velocity, 0.5)).toEqual(expected);
  expect(velocity).toEqual([0, 1.5, 0]);
  expect(sourceParticleOrbit([0, 0, 0], 1)).toBeNull();
  expect(sourceParticleOrbit([0, 1.5, 0], -1e-8)).not.toBeNull();
});

test('invalid draw values reject before returning a basis or stretch', () => {
  for (const vector of [
    [1, 2],
    [NaN, 0, 0],
    [Infinity, 0, 0],
    [1e40, 0, 0],
  ]) {
    expect(() => sourceParticleOrbit(vector, 1)).toThrow();
    expect(() => sourceParticleStretch('billboard', vector, 0.004, 1.3)).toThrow();
  }
  expect(() => sourceParticleOrbit([0, 1, 0], NaN)).toThrow();
  expect(() => sourceParticleOrbit([0, 1, 0], Infinity)).toThrow();
  expect(() =>
    sourceParticleStretch('invalid' as SourceStretchGeometry, [0, 0, 0], 1, 1)
  ).toThrow();
  expect(() => sourceParticleStretch('quad', [0, 0, 0], NaN, 1)).toThrow();
  expect(() => sourceParticleStretch('quad', [0, 0, 0], 1, Infinity)).toThrow();
});
