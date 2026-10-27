import { expect, test } from 'vitest';
import { writeRayColor } from '../src/render/particle-ray-color';

test('native Ray byte words preserve BGRA channels and clamp finite components', () => {
  const bytes = new Uint8Array(4);
  writeRayColor(bytes, 0, 1, Object.freeze([0.5, 0.25, 0.75, 0.5]), 4);
  expect([...bytes]).toEqual([191, 64, 128, 128]);
  writeRayColor(bytes, 0, 1, [0.0019607841968536377, 0.5039215683937073, 1.5, 0.5], 1);
  expect([...bytes]).toEqual([255, 129, 1, 128]);
  writeRayColor(bytes, 0, 1, [-1, 3, 0.5, -0.5], 4);
  expect([...bytes]).toEqual([128, 255, 0, 0]);
});

test('native modes0/2 premultiply float32 RGB and set byte alpha255 without mutating source', () => {
  const color = Object.freeze([0.5, 0.25, 0.75, 0.5]);
  for (const blend of [0, 2]) {
    const bytes = new Uint8Array(4);
    writeRayColor(bytes, 0, 1, color, blend);
    expect([...bytes]).toEqual([96, 32, 64, 255]);
    expect(color).toEqual([0.5, 0.25, 0.75, 0.5]);
  }
});

test('a batched ray color update preserves the neighboring vertex words', () => {
  const bytes = new Uint8Array(16).fill(173);
  writeRayColor(bytes, 1, 2, [1, 0, 0.5, 1], 4);
  expect([...bytes]).toEqual([
    173, 173, 173, 173, 128, 0, 255, 255, 128, 0, 255, 255, 173, 173, 173, 173,
  ]);
  const before = bytes.slice();
  writeRayColor(bytes, 0, 0, [0, 0, 0, 0], 0);
  expect(bytes).toEqual(before);
});
