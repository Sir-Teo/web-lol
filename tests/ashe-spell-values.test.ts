import { expect, test } from 'vitest';
import {
  asheFocusValues,
  asheVolleyValues,
  asheHawkshotValues,
  asheCrystalArrowValues,
  asheSpellResources,
} from '../src/simulation/ashe-spell-values';
import { World } from '../src/simulation/world';

test('all normal ranks expose combat values and resources together', () => {
  expect([1, 2, 3, 4, 5].map((rank) => asheVolleyValues(rank, 25))).toEqual([
    { mana: 75, cooldownSeconds: 18, arrows: 7, damage: 85 },
    { mana: 70, cooldownSeconds: 14.5, arrows: 8, damage: 120 },
    { mana: 65, cooldownSeconds: 11, arrows: 9, damage: 155 },
    { mana: 60, cooldownSeconds: 7.5, arrows: 10, damage: 190 },
    { mana: 55, cooldownSeconds: 4, arrows: 11, damage: 225 },
  ]);
  expect([1, 2, 3].map((rank) => asheCrystalArrowValues(rank, 40))).toEqual([
    { mana: 100, cooldownSeconds: 100, damage: 248 },
    { mana: 100, cooldownSeconds: 80, damage: 448 },
    { mana: 100, cooldownSeconds: 60, damage: 648 },
  ]);
  expect([1, 2, 3, 4, 5].map((rank) => asheFocusValues(rank).damageMultiplier)).toEqual([
    1.1, 1.15, 1.2, 1.25, 1.3,
  ]);
  expect([1, 2, 3, 4, 5].map((rank) => asheFocusValues(rank).bonusAttackSpeed)).toEqual([
    0.2, 0.3, 0.4, 0.5, 0.6,
  ]);
  expect([1, 2, 3, 4, 5].map((rank) => asheHawkshotValues(rank))).toEqual(
    [90, 80, 70, 60, 50].map((rechargeSeconds) => ({
      mana: 0,
      cooldownSeconds: 5,
      rechargeSeconds,
    }))
  );
});

test('unlearned and invalid ranks cannot silently use trailing export values', () => {
  for (const ability of ['q', 'w', 'e', 'r'] as const)
    for (const rank of [0, -1, 1.5, NaN, Infinity, ability === 'r' ? 4 : 6])
      expect(() => asheSpellResources(ability, rank)).toThrow(RangeError);
});

test('rank previews use owned stats without counting champion growth as bonus AD', () => {
  const w = new World(false);
  w.player.gold = 1275;
  expect(w.buy('pickaxe')).toBeNull();
  expect(w.buy('tome')).toBeNull();
  w.gainExperience(1e6);
  const before = w.snapshot();
  expect(w.volleyDamage(w.hero, 5)).toBe(225);
  expect(w.crystalArrowDamage(w.hero, 3)).toBe(624);
  expect(w.volleyDamage()).toBe(85);
  expect(w.crystalArrowDamage()).toBe(224);
  expect(w.snapshot()).toBe(before);
});
