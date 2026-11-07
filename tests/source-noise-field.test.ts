import { expect, test } from 'vitest';
import reference from '../docs/reference/source-noise-field-samples.json';
import {
  sourceNoiseClock,
  sourceNoiseImpulses,
  sourceNoiseInto,
  SOURCE_NOISE_FIELD_POLICY,
} from '../src/render/source-noise-field';

test.each(reference.clocks)(
  'the emitter-wide noise clock matches the external rate $rate sequence',
  (sample) => {
    const clock = sourceNoiseClock();
    for (const state of sample.samples) {
      expect(sourceNoiseImpulses(clock, sample.rate, state.now)).toBe(state.kicks);
      expect(clock).toEqual({ last: state.last, fired: state.fired });
    }
  }
);
test.each(reference.impulses)(
  'external impulse profile=$profile phase=$phase serial=$serial place=$place kicks=$noise.kicks',
  (sample) => {
    const velocity = Float32Array.from(sample.before);
    sourceNoiseInto(velocity, sample.at, sample.noise, sample.serial);
    expect(Array.from(new Uint32Array(velocity.buffer))).toEqual(sample.afterBits);
  }
);
test('warmed impulse code retains the independently generated float32 result bits', () => {
  const sample = reference.impulses.find(
    (s) => s.noise.kicks === 3 && s.noise.delta > 0 && s.place === 'inside'
  )!;
  for (let i = 0; i < 12000; i++)
    sourceNoiseInto(Float32Array.from(sample.before), sample.at, sample.noise, sample.serial);
  for (const s of reference.impulses) {
    const velocity = Float32Array.from(s.before);
    sourceNoiseInto(velocity, s.at, s.noise, s.serial);
    expect(Array.from(new Uint32Array(velocity.buffer))).toEqual(s.afterBits);
  }
});
test('invalid clock or impulse input is rejected before changing owned state', () => {
  const clock = sourceNoiseClock();
  for (const [rate, now] of [
    [-1, 0],
    [5, NaN],
    [Infinity, 1],
    [1e300, 1e300],
  ]) {
    expect(() => sourceNoiseImpulses(clock, rate, now)).toThrow(RangeError);
    expect(clock).toEqual({ last: null, fired: 0 });
  }
  const s = reference.impulses[0],
    velocity = Float32Array.from(s.before);
  for (const change of [
    { radius: -1 },
    { kicks: 257 },
    { axes: [1, NaN, 1] },
    { first: -1 },
    { slot: -1 },
  ]) {
    expect(() => sourceNoiseInto(velocity, s.at, { ...s.noise, ...change }, s.serial)).toThrow(
      RangeError
    );
    expect(Array.from(velocity)).toEqual(s.before);
  }
  expect(SOURCE_NOISE_FIELD_POLICY.nativeRandomStreamCertified).toBe(false);
});
