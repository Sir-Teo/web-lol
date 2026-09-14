import { expect, it } from 'vitest';
import { luxBeamBirthOffset } from '../src/render/lux-beam-birth-offset';

it('samples source birth multipliers, including empty axes and intermediate knots', () => {
  const profile = {
    value: [2, 3],
    probabilities: [
      { times: [0, 0.25, 1], values: [-1, 0, 2] },
      { times: [], values: [] },
    ],
  };
  expect(luxBeamBirthOffset(profile, 0)).toEqual([-2, 0]);
  expect(luxBeamBirthOffset(profile, 0.25)).toEqual([0, 0]);
  expect(luxBeamBirthOffset(profile, 0.625)).toEqual([2, 0]);
  expect(luxBeamBirthOffset(profile, 1)).toEqual([4, 0]);
  expect(luxBeamBirthOffset({ value: [2, 3], probabilities: null }, 0.5)).toEqual([2, 3]);
  for (const chance of [-1, 1.1, NaN]) expect(() => luxBeamBirthOffset(profile, chance)).toThrow();
});
