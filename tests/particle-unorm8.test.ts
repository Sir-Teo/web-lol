import { expect, test } from 'vitest';
import { particleUnorm8 } from '../src/render/particle-unorm8';

test('all normalized byte values round trip through the ray color format', () => {
  for (let byte = 0; byte < 256; byte++) expect(particleUnorm8(byte / 255)).toBe(byte / 255);
});
test('the ray path clamps and rounds its finite components instead of truncating the fast quad path', () => {
  expect([-10, -0, 0, 0.5, 1, 1.5, 1e30].map(particleUnorm8)).toEqual([
    0,
    0,
    0,
    128 / 255,
    1,
    1,
    1,
  ]);
});
test.each([
  [0.0019607841968536377, 1],
  [0.5039215683937073, 129],
  [0.5078431367874146, 130],
  [0.5117647051811218, 131],
])('float32 FMA boundary at %s produces byte %s', (value, byte) => {
  // Independent C fmaf counterexamples: double-only rounding returns byte-1.
  expect(Math.floor(value * 255 + 0.5)).toBe(byte - 1);
  expect(particleUnorm8(value)).toBe(byte / 255);
});
