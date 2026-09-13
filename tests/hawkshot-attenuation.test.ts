import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { HAWKSHOT_ATTENUATION } from '../src/content/hawkshot-attenuation';
import { hawkshotAttenuation } from '../src/audio/hawkshot-attenuation';

const reference = JSON.parse(readFileSync('docs/reference/hawkshot-attenuation.json', 'utf8'));
test('attenuation profile retains pinned source hierarchy, routing and curve fields', () => {
  expect(HAWKSHOT_ATTENUATION).toEqual(reference.profile);
  expect(
    createHash('sha256').update(readFileSync('docs/reference/hawkshot-audio.json')).digest('hex')
  ).toBe(reference.sourceGraphSha256);
  expect(HAWKSHOT_ATTENUATION.unresolvedOutputBusId).toBe(1259461568);
  expect(HAWKSHOT_ATTENUATION.curveToUse.slice(0, 3)).toEqual([0, 0, 0]);
  expect(HAWKSHOT_ATTENUATION.points.map((p) => p.interpolation)).toEqual([9, 2, 2, 2, 9, 4]);
});
test('distance interpolation and nonlinear scaling match independent pinned parser samples', () => {
  for (const sample of reference.samples) {
    const result = hawkshotAttenuation(sample.distance);
    expect(result.db, `dB at ${sample.distance}`).toBeCloseTo(sample.db, 10);
    expect(result.amplitude, `amplitude at ${sample.distance}`).toBeCloseTo(sample.amplitude, 12);
  }
  expect(hawkshotAttenuation(1750)).toEqual({ db: 0, amplitude: 1 });
  expect(hawkshotAttenuation(2000).db).toBeCloseTo(-12, 5);
  expect(hawkshotAttenuation(2300).db).toBeCloseTo(-24, 5);
  expect(hawkshotAttenuation(100000).db).toBe(-96.3);
});
test('invalid distance is rejected instead of propagating NaN into an audio graph', () => {
  for (const distance of [-1, NaN, Infinity, -Infinity])
    expect(() => hawkshotAttenuation(distance)).toThrow(RangeError);
});
