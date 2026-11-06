import { expect, test } from 'vitest';
import samples from '../docs/reference/source-emission-count-samples.json';
import {
  sourceEmissionCount,
  type SourceEmissionCountInput,
} from '../src/render/source-emission-count';
import { execFileSync } from 'node:child_process';

for (const sample of samples.samples)
  test(`external emission count ${sample.name}`, () => {
    const before = structuredClone(sample.input);
    expect(sourceEmissionCount(sample.input)).toBe(sample.expected);
    expect(sample.input).toEqual(before);
  });
for (const sequence of samples.sequences)
  test(`external 60-step count replay at rate ${sequence.rate} drops spawn remainders`, () => {
    const state: SourceEmissionCountInput = { ...samples.samples[0].input, rate: sequence.rate };
    const counts = [];
    for (let tick = 1; tick <= 60; tick++) {
      state.age = tick / 60;
      const count = sourceEmissionCount(state);
      counts.push(count);
      if (count > 0) {
        state.lastSpawn = state.age;
        state.emitted = true;
        state.spawned += count;
      }
    }
    expect(counts).toEqual(sequence.counts);
  });

test('external fixtures reproduce without importing the application kernel', () => {
  execFileSync(process.execPath, [
    'tools/assets/export-source-emission-count-samples.mjs',
    '--check',
  ]);
});
for (const edit of [
  { rate: NaN },
  { rate: -1 },
  { age: Infinity },
  { lastSpawn: 1 },
  { periodLength: 0 },
  { periodLength: -1 },
  { maxPerFrame: 0.5 },
  { segmentLimit: -1 },
  { spawned: -1 },
  { emitted: 1 },
])
  test(`rejects invalid resolved count input ${JSON.stringify(edit)}`, () => {
    expect(() =>
      sourceEmissionCount({ ...samples.samples[0].input, ...edit } as SourceEmissionCountInput)
    ).toThrow();
  });
