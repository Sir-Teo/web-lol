import { expect, test } from 'vitest';
import { asheFocusFlurry } from '../src/simulation/ashe-spell-values';

test('all five Q ranks prepare five equal arrow payloads and one on-hit arrow', () => {
  for (const [rank, each] of [
    [1, 22],
    [2, 23],
    [3, 24],
    [4, 25],
    [5, 26],
  ]) {
    const arrows = asheFocusFlurry(rank, 100);
    expect(arrows).toHaveLength(5);
    for (const arrow of arrows) expect(arrow.damage).toBeCloseTo(each);
    expect(arrows.map((arrow) => arrow.appliesOnHit)).toEqual([true, false, false, false, false]);
    expect(arrows.map((arrow) => arrow.spell)).toEqual([
      'AsheQAttack',
      ...Array(4).fill('AsheQAttackNoOnHit'),
    ]);
    expect(arrows.reduce((sum, arrow) => sum + arrow.damage, 0)).toBeCloseTo(each * 5);
  }
});

test('flurry payload handles zero damage and rejects invalid input instead of manufacturing hits', () => {
  expect(asheFocusFlurry(1, 0).every((arrow) => arrow.damage === 0)).toBe(true);
  for (const damage of [-1, Infinity, NaN])
    expect(() => asheFocusFlurry(1, damage)).toThrow(RangeError);
  for (const rank of [0, 6, 1.5]) expect(() => asheFocusFlurry(rank, 100)).toThrow(RangeError);
});
