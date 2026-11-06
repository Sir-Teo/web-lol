import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import samples from '../docs/reference/source-stepped-motion-samples.json';
import {
  sourceSteppedMotion,
  type SourceSteppedMotionInput,
} from '../src/render/source-stepped-motion';
const decode = (hex: string) => {
  const bytes = Buffer.from(hex, 'hex');
  return Float32Array.from({ length: bytes.length / 4 }, (_, i) => bytes.readFloatLE(i * 4));
};
const hex = (array: Float32Array) =>
  Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('hex');
const pack = (out: ReturnType<typeof sourceSteppedMotion>) => ({
  position: hex(out.position),
  velocity: hex(out.velocity),
  moving: hex(out.moving),
  fresh: out.fresh,
});
function input(index: number): SourceSteppedMotionInput {
  const s = samples.samples[index].input;
  return {
    ...s,
    position: decode(s.position),
    velocity: decode(s.velocity),
    birthAcceleration: decode(s.birthAcceleration),
    acceleration: decode(s.acceleration),
    carriedVelocity: decode(s.carriedVelocity),
    birthDrag: decode(s.birthDrag),
    drag: decode(s.drag),
  };
}
for (const [index, sample] of samples.samples.entries())
  test(`external stepped motion ${sample.name}`, () => {
    expect(pack(sourceSteppedMotion(input(index)))).toEqual(sample.expected);
  });
for (const sequence of samples.sequences)
  test(`external motion replay ${sequence.name}`, () => {
    let state: SourceSteppedMotionInput = structuredClone(sequence.input);
    for (const expected of sequence.steps) {
      const out = sourceSteppedMotion(state);
      expect(pack(out)).toEqual(expected);
      state = { ...state, position: out.position, velocity: out.velocity, fresh: out.fresh };
    }
  });
test('external motion fixtures reproduce without the application helper', () => {
  execFileSync(process.execPath, [
    'tools/assets/export-source-stepped-motion-samples.mjs',
    '--check',
  ]);
});
test('fresh births use zero delta and drag cannot reverse moving velocity', () => {
  const s = input(0);
  s.position = [0, 0, 0];
  s.velocity = [100, 0, 0];
  s.birthDrag = [0, 0, 0];
  s.dt = 1 / 30;
  s.fresh = true;
  const fresh = sourceSteppedMotion(s);
  expect(Array.from(fresh.position)).toEqual([0, 0, 0]);
  expect(fresh.velocity[0]).toBe(100);
  expect(sourceSteppedMotion({ ...s, fresh: false }).position[0]).toBeCloseTo(100 / 30, 6);
  const stopped = sourceSteppedMotion({
    ...s,
    fresh: false,
    velocity: [0, 0, 0],
    carriedVelocity: [5, 0, 0],
    drag: [100, 0, 0],
    dt: 1,
  });
  expect(stopped.moving[0]).toBe(0);
  expect(stopped.velocity[0]).toBe(-5);
  expect(stopped.position[0]).toBe(0);
});
test('motion reads and returns independent buffers', () => {
  const s = input(16),
    before = structuredClone(s),
    out = sourceSteppedMotion(s),
    expected = sourceSteppedMotion(s);
  expect(s).toEqual(before);
  out.position.fill(999);
  out.velocity.fill(999);
  out.moving.fill(999);
  expect(sourceSteppedMotion(s)).toEqual(expected);
  expect(s).toEqual(before);
});
test('invalid motion values and steps reject', () => {
  for (const edit of [
    { dt: -1 },
    { dt: NaN },
    { fresh: 1 },
    { position: [1, 2] },
    { velocity: [NaN, 0, 0] },
    { drag: [Infinity, 0, 0] },
  ])
    expect(() =>
      sourceSteppedMotion({ ...input(0), ...edit } as SourceSteppedMotionInput)
    ).toThrow();
});
