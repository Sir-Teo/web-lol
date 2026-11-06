import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import samples from '../docs/reference/source-legacy-shape-samples.json';
import { SourceLegacySpawnShape } from '../src/render/source-legacy-spawn-shape';
const hex = (array: Float32Array) =>
  Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('hex');
for (const [index, sample] of samples.samples.entries())
  test(`external legacy shape ${index}`, () => {
    const shape = new SourceLegacySpawnShape(samples.definitions[sample.definition].definition);
    let consumed = 0;
    const out = shape.sample(sample.phase, () => sample.draws[consumed++], sample.pinned);
    expect({
      raw: hex(out.raw),
      offset: hex(out.offset),
      turn: hex(out.turn),
      turned: out.turned,
    }).toEqual(sample.expected);
    expect(consumed).toBe(sample.consumed);
  });
test('external legacy fixtures reproduce without the application helper', () => {
  execFileSync(process.execPath, [
    'tools/assets/export-source-legacy-shape-samples.mjs',
    '--check',
  ]);
});
test('the actual zero-offset Baron legacy shape still consumes three table draws', () => {
  const shape = new SourceLegacySpawnShape(samples.definitions[0].definition);
  let consumed = 0;
  const out = shape.sample(0, () => {
    consumed++;
    return 0.5;
  });
  expect(consumed).toBe(3);
  expect(Array.from(out.offset)).toEqual([0, 0, 0]);
  expect(out.turned).toBe(false);
});
test('prepared input and returned buffers retain independent storage', () => {
  const input = structuredClone(samples.definitions[1].definition),
    shape = new SourceLegacySpawnShape(input);
  const expected = shape.sample(0, () => 0.5);
  input.offset.values[0][0] = 999;
  input.axes[0].fill(999);
  input.angles[0].constant[0] = 999;
  const next = shape.sample(0, () => 0.5);
  expect(next).toEqual(expected);
  next.offset.fill(999);
  next.raw.fill(999);
  next.turn.fill(999);
  expect(shape.sample(0, () => 0.5)).toEqual(expected);
});
test('a nonzero angle about a zero axis retains the external turned flag', () => {
  const shape = new SourceLegacySpawnShape(samples.definitions[4].definition);
  expect(shape.sample(0, () => 0.5).turned).toBe(true);
});
test('invalid shape dimensions and clocks reject', () => {
  const input = samples.definitions[0].definition;
  for (const edit of [
    { axes: [] },
    {
      axes: [
        [1, 2],
        [1, 2, 3],
      ],
    },
    {
      axes: [
        [NaN, 0, 0],
        [0, 0, 0],
      ],
    },
    { offset: { ...input.offset, constant: [1] } },
  ])
    expect(() => new SourceLegacySpawnShape({ ...input, ...edit })).toThrow();
  const shape = new SourceLegacySpawnShape(input);
  expect(() => shape.sample(NaN, () => 0.5)).toThrow();
  expect(() => shape.sample(0, () => 1)).toThrow();
});
