import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { particleColorLookup } from '../src/render/particle-color-lookup';
import { LUX_BINDING_TARGET_LOOKUPS } from '../src/content/lux-binding-target-lookups';
const reference = JSON.parse(readFileSync('docs/reference/particle-color-lookup.json', 'utf8'));

test('all four selectors match the independently executed reference at GPU precision', () => {
  for (const s of reference.samples) {
    const actual = particleColorLookup(
      { lookupTypes: s.types, lookupScales: s.scales, lookupOffsets: s.offsets },
      s.phase,
      s.birthRandom,
      s.travel
    );
    expect(actual.map(Math.fround)).toEqual(s.expected);
  }
});
test('target rune/bar lookup retains birth random while its lifetime axis advances', () => {
  for (const name of ['orbitrunes', 'bars', 'orbitcap1']) {
    const profile = LUX_BINDING_TARGET_LOOKUPS.find((p) => p.name === name)!;
    expect(profile.lookupTypes).toEqual([1, 3]);
    expect(profile.texture).toBeTruthy();
    const early = particleColorLookup(profile, 0.1, 0.37),
      late = particleColorLookup(profile, 0.9, 0.37);
    expect(early).toEqual([0.1, 0.37]);
    expect(late).toEqual([0.9, 0.37]);
    expect(particleColorLookup(profile, 0.1, 0.81)[1]).toBe(0.81);
  }
});
test('constant ignores offset and lookup coordinates remain unclamped until sampling', () => {
  expect(
    particleColorLookup(
      { lookupTypes: [0, 3], lookupScales: [2, -3], lookupOffsets: [9, -1] },
      0.5,
      0.75
    )
  ).toEqual([2, -3.25]);
  expect(() =>
    particleColorLookup({ lookupTypes: [4, 0], lookupScales: [1, 1], lookupOffsets: [0, 0] }, 0, 0)
  ).toThrow(RangeError);
});
