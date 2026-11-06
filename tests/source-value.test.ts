import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import samples from '../docs/reference/source-value-samples.json';
import { SourceValue } from '../src/render/source-value';
const hex = (array: Float32Array | Float64Array) =>
  Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('hex');
for (const [index, sample] of samples.samples.entries())
  test(`external value ${index}: ${samples.definitions[sample.definition].name}`, () => {
    const value = new SourceValue(samples.definitions[sample.definition].value);
    expect(hex(new Float64Array(value.sample(sample.phase)))).toBe(sample.expected.sampleHex);
    expect(hex(new Float64Array(value.drawShared(sample.phase, 0.25)))).toBe(
      sample.expected.sharedHex
    );
    let consumed = 0;
    const drawn = value.drawChannels(sample.phase, () => sample.draws[consumed++], sample.pinned);
    expect(hex(drawn)).toBe(sample.expected.channelsHex);
    expect(consumed).toBe(sample.consumed);
  });
test('external value fixtures reproduce without the application helper', () => {
  execFileSync(process.execPath, ['tools/assets/export-source-value-samples.mjs', '--check']);
});
test('prepared input and returned values own independent storage', () => {
  const definition = structuredClone(samples.definitions[0].value);
  const value = new SourceValue(definition),
    expected = value.sample(0.25);
  definition.constant.fill(999);
  definition.values.forEach((v) => v.fill(999));
  definition.probabilities.forEach((p) => p.values.fill(999));
  expect(value.sample(0.25)).toEqual(expected);
  value.sample(0.25).fill(999);
  value.drawShared(0.25, 0.5).fill(999);
  value.drawChannels(0.25, () => 0.5).fill(999);
  expect(value.sample(0.25)).toEqual(expected);
});
test('integrated values require an explicit integral adapter', () => {
  expect(
    () => new SourceValue({ ...samples.definitions[0].value, sourceType: 'IntegratedValueVector3' })
  ).toThrow('integral');
});
test('rejects invalid value dimensions, order, phases and random draws', () => {
  const definition = samples.definitions[0].value;
  for (const edit of [
    { constant: [] },
    { authoredKeyCount: 0.5 },
    { times: [1, 0] },
    { values: [[NaN]] },
    { probabilities: [{ times: [0], values: [], single: 1 }] },
  ])
    expect(() => new SourceValue({ ...definition, ...edit })).toThrow();
  const value = new SourceValue(definition);
  for (const phase of [NaN, Infinity]) expect(() => value.sample(phase)).toThrow();
  for (const chance of [-1, NaN, Infinity, 1.01]) {
    expect(() => value.drawShared(0, chance)).toThrow();
    expect(() => value.drawChannels(0, () => 0.5, chance)).toThrow();
  }
  for (const chance of [-1, NaN, Infinity, 1])
    expect(() => value.drawChannels(0, () => chance)).toThrow();
});
