import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import samples from '../docs/reference/source-birth-value-samples.json';
import { SourceBirthValues } from '../src/render/source-birth-values';
const hex = (array: Float32Array) =>
  Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('hex');
for (const [index, sample] of samples.samples.entries())
  test(`external birth ${index}: ${samples.definitions[sample.definition].name}`, () => {
    const values = new SourceBirthValues(samples.definitions[sample.definition].definition);
    let consumed = 0;
    const result = values.sample(sample.phase, () => sample.draws[consumed++], sample.pinned);
    expect(hex(new Float32Array([result.lifetime]))).toBe(sample.expected.lifetime);
    for (const key of [
      'velocity',
      'rotation',
      'angularVelocity',
      'scale',
      'drag',
      'color',
    ] as const)
      expect(hex(result[key])).toBe(sample.expected[key]);
    expect(consumed).toBe(sample.consumed);
  });
test('external birth fixtures reproduce without the application helper', () => {
  execFileSync(process.execPath, ['tools/assets/export-source-birth-value-samples.mjs', '--check']);
});
test('birth definitions and returned vectors own their storage', () => {
  const input = structuredClone(samples.definitions[0].definition),
    values = new SourceBirthValues(input);
  const expected = values.sample(0, () => 0.5);
  input.lifetime.constant[0] = 999;
  input.velocity.values[0][0] = 999;
  const next = values.sample(0, () => 0.5);
  expect(next).toEqual(expected);
  next.velocity.fill(999);
  next.color.fill(999);
  expect(values.sample(0, () => 0.5)).toEqual(expected);
});
test('constant births consume no table draws and negative lifetime remains unbounded', () => {
  const input = samples.definitions.at(-1)!.definition;
  const constant = Object.fromEntries(
    Object.entries(input).map(([key, d]) => [key, { ...d, probabilities: [] }])
  ) as typeof input;
  const values = new SourceBirthValues(constant);
  expect(
    values.sample(0, () => {
      throw Error('constant has no tables');
    }).lifetime
  ).toBe(Infinity);
});
test('invalid widths, clocks, pins and draws reject', () => {
  const input = samples.definitions[0].definition;
  expect(
    () => new SourceBirthValues({ ...input, velocity: { ...input.velocity, constant: [1] } })
  ).toThrow();
  const values = new SourceBirthValues(input);
  for (const phase of [NaN, Infinity]) expect(() => values.sample(phase, () => 0.5)).toThrow();
  for (const pin of [-1, NaN, Infinity, 1.01])
    expect(() =>
      values.sample(
        0,
        () => {
          throw Error('invalid pin must not draw');
        },
        pin
      )
    ).toThrow('phase/pin');
  for (const draw of [-1, NaN, Infinity, 1])
    expect(() => values.sample(0, () => draw)).toThrow('draw');
});
