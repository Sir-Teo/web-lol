import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import source from '../src/content/gromp-death.json';
import fixtures from '../docs/reference/gromp-plane-color-fixtures.json';
import routes from '../docs/reference/native-gromp-emitter-routes.json';
import plane from '../docs/reference/native-plane-color-packets.json';
import {
  prepareLegacyParticleColor,
  sampleLegacyParticleColor,
} from '../src/render/legacy-particle-color';
import { isGrompLegacyPlane, writeGrompPlaneColor } from '../src/render/gromp-plane-color';

const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const words = (values: readonly number[]) =>
  values.map((value) => {
    const bytes = Buffer.alloc(4);
    bytes.writeFloatLE(value);
    return bytes.readUInt32LE().toString(16).padStart(8, '0');
  });
const curves = new Map(
  [4].map((index) => [
    index,
    prepareLegacyParticleColor(source.profiles[index].color, source.profiles[index].colorCurve),
  ])
);

test('plane fixtures bind original source classes and independent compiler provenance', () => {
  expect(fixtures.compiler.flags).toEqual([
    '-std=c11',
    '-O2',
    '-ffp-contract=off',
    '-fno-fast-math',
  ]);
  expect(fixtures.compiler.nativeExecuted).toBe(false);
  expect(sha('tools/qa/lib/legacy-plane-color-reference.py')).toBe(fixtures.referenceToolSha256);
  for (const [path, expected] of Object.entries(fixtures.compiler.sourcePins))
    expect(sha(path)).toBe(expected);
  expect(source.profiles.map((_, index) => index).filter(isGrompLegacyPlane)).toEqual([4]);
  expect(routes.source.simpleProfiles).toEqual([0]);
  expect(plane.source.profileIndex).toBe(4);
  expect(plane.source.blendMode).toBe(1);
  expect(plane.primitive.virtualMethod).toBe('0x1018d5924');
  expect([4].map((index) => source.profiles[index].blend)).toEqual([1]);
});

for (const row of fixtures.rows)
  test(`Gromp legacy plane ${row.profileIndex} matches C at phase ${row.phase}`, () => {
    const color = sampleLegacyParticleColor(curves.get(row.profileIndex)!, row.phase),
      bytes = new Uint8Array(4);
    expect(words(color)).toEqual(row.words);
    expect(color).toEqual(row.rgba);
    writeGrompPlaneColor(bytes, 0, 1, color);
    expect([...bytes]).toEqual(row.bgra);
  });

test('Plane truncates half intensity and writes only the requested borrowed-color range', () => {
  const color = Object.freeze([0.5, 0.25, 1, 0.5]),
    bytes = new Uint8Array(20).fill(173);
  writeGrompPlaneColor(bytes, 1, 3, color);
  expect([...bytes]).toEqual([
    173,
    173,
    173,
    173,
    ...Array.from({ length: 3 }, () => [255, 63, 127, 127]).flat(),
    173,
    173,
    173,
    173,
  ]);
  expect(color).toEqual([0.5, 0.25, 1, 0.5]);
});

for (const color of [
  [NaN, 0, 0, 1],
  [Infinity, 0, 0, 1],
  [-0.01, 0, 0, 1],
  [1.01, 0, 0, 1],
  [0, 0, 0],
  [0, 0, 0, 1, 1],
])
  test(`scoped Gromp packing rejects unsupported RGBA ${color}`, () => {
    const bytes = new Uint8Array(8).fill(173);
    expect(() => writeGrompPlaneColor(bytes, 0, 1, color)).toThrow(RangeError);
    expect([...bytes]).toEqual(Array(8).fill(173));
  });

test('other primitives and non-index numbers stay outside the scoped plane policy', () => {
  for (const index of [0, 1, 2, 3, 5, 6, 7, -1, 4.5, NaN, Infinity])
    expect(isGrompLegacyPlane(index)).toBe(false);
});
