import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { LUX_ILLUMINATION_ATTENUATION } from '../src/content/lux-illumination-attenuation';
import { luxIlluminationAttenuation } from '../src/audio/lux-illumination-attenuation';
const reference = JSON.parse(
  readFileSync('docs/reference/lux-illumination-attenuation.json', 'utf8')
);

test('Lux attenuation follows its independently mapped parent routing', () => {
  expect(LUX_ILLUMINATION_ATTENUATION).toEqual(reference.profile);
  expect(
    createHash('sha256')
      .update(readFileSync('docs/reference/lux-illumination-audio.json'))
      .digest('hex')
  ).toBe(reference.sourceGraphSha256);
  expect(LUX_ILLUMINATION_ATTENUATION.parentMixerId).toBe(413871746);
  expect(LUX_ILLUMINATION_ATTENUATION.unresolvedOutputBusId).toBe(1259461568);
  expect(LUX_ILLUMINATION_ATTENUATION.curveToUse.slice(0, 3)).toEqual([0, 0, 0]);
});
test('distance gain matches independent parser samples before adding container gain', () => {
  for (const sample of reference.samples) {
    const result = luxIlluminationAttenuation(sample.distance);
    expect(result.attenuationDb, `attenuation at ${sample.distance}`).toBeCloseTo(sample.db, 10);
    expect(result.db).toBeCloseTo(sample.db - 12, 10);
    expect(result.amplitude).toBeCloseTo(sample.amplitude * 10 ** (-12 / 20), 12);
  }
  expect(luxIlluminationAttenuation(1750).db).toBe(-12);
  expect(luxIlluminationAttenuation(2000).db).toBeCloseTo(-24, 5);
  expect(luxIlluminationAttenuation(2300).db).toBeCloseTo(-36, 5);
  expect(luxIlluminationAttenuation(3000).db).toBe(-108.3);
});
test('rejects non-finite and negative source distances', () => {
  for (const distance of [-1, NaN, Infinity, -Infinity])
    expect(() => luxIlluminationAttenuation(distance)).toThrow(RangeError);
});
