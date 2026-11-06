import { expect, test } from 'vitest';
import reference from '../docs/reference/wwise145-linear-exp1-reference.json';
import { wwise145Fade } from '../src/audio/wwise145-fade';

test('Linear and Exp1 match ninety direct external-reader evaluations', () => {
  expect(reference.cases).toHaveLength(90);
  for (const c of reference.cases)
    expect(wwise145Fade(c.curve as 4 | 6, c.t, c.initial, c.target)).toBeCloseTo(c.value, 14);
  expect(wwise145Fade(6, 0.5, 1, 0)).toBe(0.625);
});
test('fade boundaries clamp to their endpoints and nonfinite/unsupported inputs reject', () => {
  expect(wwise145Fade(6, -1, 0.7, 0)).toBe(0.7);
  expect(wwise145Fade(6, 2, 0.7, 0)).toBe(0);
  for (const value of [NaN, Infinity, -Infinity]) {
    expect(() => wwise145Fade(6, value, 1, 0)).toThrow(RangeError);
    expect(() => wwise145Fade(6, 0.5, value, 0)).toThrow(RangeError);
    expect(() => wwise145Fade(6, 0.5, 1, value)).toThrow(RangeError);
  }
  expect(() => wwise145Fade(3 as 4, 0.5, 1, 0)).toThrow(RangeError);
});
