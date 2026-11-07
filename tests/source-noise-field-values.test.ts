import { expect, test } from 'vitest';
import data from '../src/content/ahri-r-particles.json';
import reference from '../docs/reference/source-noise-field-samples.json';
import { SourceNoiseFieldValues } from '../src/render/source-noise-field-values';
import type { SourceNoiseClock } from '../src/render/source-noise-field';

for (const profile of [10, 27])
  test('native noise field values match independent preparation for profile ' + profile, () => {
    const values = new SourceNoiseFieldValues(data.profiles[profile].fieldCollection);
    const clocks: SourceNoiseClock[] = [];
    for (const sample of reference.preparations.filter((s) => s.profile === profile))
      expect(values.sample(sample.phase, sample.tick / 60, clocks)).toEqual([sample.noise]);
  });
test('prepared field curves and axes own their native input and returned packets', () => {
  const raw = structuredClone(data.profiles[27].fieldCollection)!;
  const values = new SourceNoiseFieldValues(raw);
  raw.fieldNoiseDefinitions[0].axisFraction[0] = 0;
  const dynamics = (
    raw.fieldNoiseDefinitions[0].velocityDelta as { dynamics?: { values: number[] } }
  ).dynamics!;
  dynamics.values[1] = 999;
  const packet = values.sample(0.5, 1, []);
  expect(packet[0].axes).toEqual([24, 24, 24]);
  expect(packet[0].delta).toBe(6);
  (packet[0].axes as number[])[0] = 0;
  expect(values.sample(0.5, 1, [])[0].axes).toEqual([24, 24, 24]);
});
test('unsupported fields and defaults fail closed and invalid seeks leave all field clocks unchanged', () => {
  const raw = structuredClone(data.profiles[10].fieldCollection)!;
  expect(() => new SourceNoiseFieldValues({ ...raw, fieldAttractionDefinitions: [] })).toThrow(
    RangeError
  );
  expect(
    () =>
      new SourceNoiseFieldValues({
        ...raw,
        fieldNoiseDefinitions: [{ ...raw.fieldNoiseDefinitions[0], Position: [0, 0, 0] }],
      })
  ).toThrow(RangeError);
  expect(
    () =>
      new SourceNoiseFieldValues({
        ...raw,
        fieldNoiseDefinitions: [{ ...raw.fieldNoiseDefinitions[0], frequency: undefined }],
      })
  ).toThrow(RangeError);
  const values = new SourceNoiseFieldValues(raw),
    clocks: SourceNoiseClock[] = [];
  values.sample(0, 1, clocks);
  const before = structuredClone(clocks);
  expect(() => values.sample(0, 0.5, clocks)).toThrow(RangeError);
  expect(clocks).toEqual(before);
  expect(() => values.sample(NaN, 2, clocks)).toThrow(RangeError);
  expect(clocks).toEqual(before);
});

test('a rejected later field cannot partially advance an earlier field clock', () => {
  const raw = structuredClone(data.profiles[10].fieldCollection)!;
  const values = new SourceNoiseFieldValues({
    ...raw,
    fieldNoiseDefinitions: [
      raw.fieldNoiseDefinitions[0],
      structuredClone(raw.fieldNoiseDefinitions[0]),
    ],
  });
  const clocks = [
    { last: 0.5, fired: 1 },
    { last: 2, fired: 1 },
  ];
  const before = structuredClone(clocks);
  expect(() => values.sample(0.5, 1, clocks)).toThrow(RangeError);
  expect(clocks).toEqual(before);
});
