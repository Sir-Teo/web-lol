import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import reference from '../docs/reference/wwise145-log1-reference.json';
import { wwise145Fade } from '../src/audio/wwise145-fade';

test('Log1 matches forty-five direct pinned external-reader evaluations', () => {
  expect(
    createHash('sha256')
      .update(readFileSync('tools/assets/read-wwise145-log1-reference.py'))
      .digest('hex')
  ).toBe(reference.producerSha256);
  expect(reference.referenceRevision).toBe('71654ed1a2c4642894bd7e7ed79eba66986fb770');
  expect(reference.cases).toHaveLength(45);
  for (const c of reference.cases) {
    expect(c.curve).toBe(2);
    expect(wwise145Fade(2, c.t, c.initial, c.target)).toBeCloseTo(c.value, 14);
  }
  expect(wwise145Fade(2, 0.5, 1, 0)).toBe(0.375);
});
test('Log1 clamps finite domain boundaries and rejects nonfinite endpoints', () => {
  expect(wwise145Fade(2, -1, 0.7, 0)).toBe(0.7);
  expect(wwise145Fade(2, 2, 0.7, 0)).toBe(0);
  for (const value of [NaN, Infinity, -Infinity]) {
    expect(() => wwise145Fade(2, value, 1, 0)).toThrow(RangeError);
    expect(() => wwise145Fade(2, 0.5, value, 0)).toThrow(RangeError);
    expect(() => wwise145Fade(2, 0.5, 1, value)).toThrow(RangeError);
  }
});
