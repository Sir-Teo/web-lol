import { expect, test } from 'vitest';
import samples from '../docs/reference/source-spawn-shape-samples.json';
import { sourceSpawnShape, type SourceSpawnShape } from '../src/render/source-spawn-shape';
const hex = (value: Float32Array) =>
  Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('hex');
for (const sample of samples.samples)
  test(`source spawn shape matches independent float32 writer: ${sample.name}`, () => {
    let count = 0;
    // Frozen generator inputs are serialized discriminated shape declarations.
    const actual = sourceSpawnShape(
      sample.shape as unknown as SourceSpawnShape,
      () => sample.draws[count++]
    );
    expect(count).toBe(sample.draws.length);
    for (const field of ['raw', 'offset', 'turn'] as const)
      expect(hex(actual[field])).toBe(sample.expected[field]);
    expect(actual.turned).toBe(sample.expected.turned);
  });

test('point offsets consume no draws, preserve signed zero and return independent storage', () => {
  const shape = { kind: 'point', offset: [-0, -150, 0] } as const;
  const run = () =>
    sourceSpawnShape(shape, () => {
      throw Error('Unexpected draw');
    });
  const first = run();
  expect(Object.is(first.offset[0], -0)).toBe(true);
  first.raw.fill(999);
  expect(first.offset[1]).toBe(-150);
  first.turn.fill(999);
  expect(run().turn[0]).toBe(1);
});

test('volume shapes keep the source naive radius distributions', () => {
  let draws = [0.25, 0, 0];
  expect(
    Array.from(
      sourceSpawnShape({ kind: 'sphere', radius: 40, volume: true }, () => draws.shift()!).raw
    )
  ).toEqual([10, 0, 0]);
  draws = [0.25, 0.5, 0];
  expect(
    Array.from(
      sourceSpawnShape({ kind: 'cylinder', radius: 40, height: 100, volume: true }, () =>
        draws.shift()!
      ).raw
    )
  ).toEqual([-20, 50, 0]);
});

for (const value of [-1, 1, NaN, Infinity])
  test(`invalid shape random draw rejects ${value}`, () => {
    expect(() =>
      sourceSpawnShape({ kind: 'sphere', radius: 30, volume: true }, () => value)
    ).toThrow(RangeError);
  });

for (const shape of [
  { kind: 'point', offset: [0, NaN, 0] },
  { kind: 'point', offset: [0, 0] },
  { kind: 'sphere', radius: Infinity, volume: true },
  { kind: 'sphere', radius: Number.MAX_VALUE, volume: true },
  { kind: 'cylinder', radius: 30, height: NaN, volume: false },
])
  test(`invalid source shape rejects ${JSON.stringify(shape)}`, () => {
    expect(() => sourceSpawnShape(shape as unknown as SourceSpawnShape, () => 0)).toThrow(
      RangeError
    );
  });
