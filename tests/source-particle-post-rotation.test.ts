import { expect, test } from 'vitest';
import samples from '../docs/reference/source-particle-post-rotation-samples.json';
import { sourceParticlePostRotation } from '../src/render/source-particle-post-rotation';

for (const [index, sample] of samples.samples.entries())
  test('external spin/post-rotation composition ' + index, () => {
    const result = sourceParticlePostRotation(sample.spin, sample.postRotate);
    expect(Buffer.from(result.buffer).toString('hex')).toBe(sample.expected);
  });

test('post rotation preserves caller storage and returns independent matrices', () => {
  const spin = [17, -31, 43],
    post = [90, 0, 0];
  const expected = sourceParticlePostRotation(spin, post);
  sourceParticlePostRotation(spin, post).fill(999);
  expect(sourceParticlePostRotation(spin, post)).toEqual(expected);
  expect(spin).toEqual([17, -31, 43]);
  expect(post).toEqual([90, 0, 0]);
});

test('invalid native angles and world matrices reject before producing a basis', () => {
  for (const vector of [
    [1, 2],
    [NaN, 0, 0],
    [Infinity, 0, 0],
    [1e40, 0, 0],
  ]) {
    expect(() => sourceParticlePostRotation(vector, null)).toThrow();
    expect(() => sourceParticlePostRotation([0, 0, 0], vector)).toThrow();
  }
  for (const matrix of [[], Array(9).fill(NaN), Array(9).fill(Infinity), Array(9).fill(1e40)])
    expect(() => sourceParticlePostRotation([0, 0, 0], null, matrix)).toThrow();
});
