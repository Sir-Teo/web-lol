import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { LUX_BINDING_ATTENUATION } from '../src/content/lux-binding-attenuation';
import { luxBindingCastAttenuation } from '../src/audio/lux-binding-cast-attenuation';
const reference = JSON.parse(readFileSync('docs/reference/lux-binding-attenuation.json', 'utf8'));

test('Lux attenuation follows its independently mapped parent routing', () => {
  expect(LUX_BINDING_ATTENUATION).toEqual(reference.profile);
  expect(
    createHash('sha256').update(readFileSync('docs/reference/lux-binding-audio.json')).digest('hex')
  ).toBe(reference.sourceGraphSha256);
  expect(LUX_BINDING_ATTENUATION.parentMixerId).toBe(413871746);
  expect(LUX_BINDING_ATTENUATION.unresolvedOutputBusId).toBe(1259461568);
  expect(LUX_BINDING_ATTENUATION.curveToUse.slice(0, 3)).toEqual([0, 0, 0]);
});
test('distance gain matches independent parser samples before adding container gain', () => {
  for (const sample of reference.samples) {
    const result = luxBindingCastAttenuation(sample.distance);
    expect(result.attenuationDb, `attenuation at ${sample.distance}`).toBeCloseTo(sample.db, 10);
    expect(result.db).toBeCloseTo(sample.db - 16, 10);
    expect(result.amplitude).toBeCloseTo(sample.amplitude * 10 ** (-16 / 20), 12);
  }
  expect(luxBindingCastAttenuation(1750).db).toBe(-16);
  expect(luxBindingCastAttenuation(2000).db).toBeCloseTo(-28, 5);
  expect(luxBindingCastAttenuation(2300).db).toBeCloseTo(-40, 5);
  expect(luxBindingCastAttenuation(3000).db).toBe(-112.3);
});
test('rejects non-finite and negative source distances', () => {
  for (const distance of [-1, NaN, Infinity, -Infinity])
    expect(() => luxBindingCastAttenuation(distance)).toThrow(RangeError);
});
