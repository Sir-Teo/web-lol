import { expect, test } from 'vitest';
import { DataUtils } from 'three';
import { particleHalf } from '../src/render/particle-half';

test('every binary16 value round trips, preserving signed zero and infinities', () => {
  for (let bits = 0; bits <= 0xffff; bits++) {
    const value = DataUtils.fromHalfFloat(bits),
      actual = particleHalf(value);
    if (!(Number.isNaN(value) ? Number.isNaN(actual) : Object.is(actual, value)))
      throw new Error(`Half value ${bits.toString(16)} did not round trip`);
  }
});
test('every finite positive half interval rounds its midpoint and adjacent float32 inputs correctly', () => {
  const float = new Float32Array(1),
    bits = new Uint32Array(float.buffer);
  for (let half = 0; half < 0x7bff; half++) {
    const lower = DataUtils.fromHalfFloat(half),
      upper = DataUtils.fromHalfFloat(half + 1);
    float[0] = (lower + upper) / 2;
    const midpoint = bits[0];
    for (const offset of [-1, 0, 1]) {
      bits[0] = midpoint + offset;
      const expected = offset < 0 || (offset === 0 && (half & 1) === 0) ? lower : upper;
      if (!Object.is(particleHalf(float[0]), expected))
        throw new Error(`Half interval ${half}, midpoint offset ${offset}`);
      if (!Object.is(particleHalf(-float[0]), -expected))
        throw new Error(`Negative half interval ${half}, midpoint offset ${offset}`);
    }
  }
});
test('binary16 overflow, underflow and float32 input conversion retain the packet policy', () => {
  expect(particleHalf(65519.99609375)).toBe(65504);
  expect(particleHalf(65520)).toBe(Infinity);
  expect(particleHalf(-65520)).toBe(-Infinity);
  expect(Object.is(particleHalf(-(2 ** -26)), -0)).toBe(true);
  expect(particleHalf(2 ** -25)).toBe(0);
  expect(particleHalf(2 ** -25 + 2 ** -48)).toBe(2 ** -24);
  expect(particleHalf(1 + 2 ** -11 + 2 ** -30)).toBe(1);
});
const standard = (Math as unknown as { f16round?: (value: number) => number }).f16round;
test.skipIf(!standard)(
  'a deterministic float32 corpus agrees with the independent ECMAScript half conversion',
  () => {
    const convert = standard!,
      float = new Float32Array(1),
      bits = new Uint32Array(float.buffer);
    let state = 0x12345678;
    for (let i = 0; i < 100_000; i++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      bits[0] = state;
      const expected = convert(float[0]),
        actual = particleHalf(float[0]);
      if (!(Number.isNaN(expected) ? Number.isNaN(actual) : Object.is(expected, actual)))
        throw new Error(`Float32 input ${state.toString(16)} differs from ECMAScript`);
    }
  }
);
