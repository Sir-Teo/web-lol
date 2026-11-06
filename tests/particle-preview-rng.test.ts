import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import samples from '../docs/reference/particle-preview-rng-samples.json';
import { ParticlePreviewRng } from '../src/render/particle-preview-rng';
for (const sample of samples.samples)
  test(`external preview stream ${sample.seed}`, () => {
    const rng = new ParticlePreviewRng(sample.seed);
    expect(Array.from({ length: 64 }, () => rng.unitFloat())).toEqual(sample.values);
    const state = rng.snapshot(),
      copy = rng.clone(),
      restored = ParticlePreviewRng.fromState(JSON.parse(JSON.stringify(state)));
    for (const stream of [rng, copy, restored])
      expect(Array.from({ length: 16 }, () => stream.unitFloat())).toEqual(sample.next);
    expect(sample.values.every((v) => v >= 0 && v < 1 && Math.fround(v) === v)).toBe(true);
  });
test('external preview fixtures reproduce without the application generator', () => {
  execFileSync(process.execPath, [
    'tools/assets/export-particle-preview-rng-samples.mjs',
    '--check',
  ]);
});
test('range consumes one draw and independent clones do not advance their owner', () => {
  const rng = new ParticlePreviewRng(123),
    copy = rng.clone(),
    before = rng.snapshot();
  const next = copy.unitFloat();
  expect(rng.snapshot()).toBe(before);
  expect(rng.range(-10, 30)).toBe(-10 + 40 * next);
  expect(rng.snapshot()).toBe(copy.snapshot());
});
test('invalid seeds, state and ranges reject without consuming a draw', () => {
  for (const seed of [NaN, Infinity, 0.5, -2147483649, 4294967296])
    expect(() => new ParticlePreviewRng(seed)).toThrow();
  for (const state of [0, NaN, Infinity, 0.5, -2147483649, 2147483648])
    expect(() => ParticlePreviewRng.fromState(state)).toThrow();
  const rng = new ParticlePreviewRng(1),
    before = rng.snapshot();
  expect(() => rng.range(NaN, 1)).toThrow();
  expect(() => rng.range(0, Infinity)).toThrow();
  expect(rng.snapshot()).toBe(before);
});
