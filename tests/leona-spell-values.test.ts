import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { LEONA } from '../src/content/leona-progression';
import { LEONA_SPELLS, LEONA_SUNLIGHT } from '../src/content/leona-spells';
import {
  leonaDaybreakValues,
  leonaEclipseValues,
  leonaSolarFlareValues,
  leonaSpellResources,
  leonaSunlightDamage,
  leonaZenithValues,
} from '../src/simulation/leona-spell-values';

test('retained source pins and rank/formula checks reproduce generated files offline', () => {
  expect(
    execFileSync('python3', ['tools/assets/export-leona-kit.py', '--check'], {
      encoding: 'utf8',
      stdio: 'pipe',
    })
  ).toContain('Verified Leona stats, 18 Sunlight levels and all Q/W/E/R ranks');
});

test('all ordinary spell ranks use current damage and independently indexed resources', () => {
  const ranks = [1, 2, 3, 4, 5];
  expect(ranks.map((r) => leonaDaybreakValues(r, 0))).toEqual(
    [10, 35, 60, 85, 110].map((bonusMagicDamage, i) => ({
      bonusMagicDamage,
      mana: 30 + i * 5,
      cooldownSeconds: 5,
      stunSeconds: 1,
    }))
  );
  expect(ranks.map((r) => leonaZenithValues(r, 0))).toEqual(
    [50, 90, 130, 170, 210].map((magicDamage, i) => ({
      magicDamage,
      mana: 40 + i * 5,
      cooldownSeconds: 12 - i * 1.5,
      rootSeconds: 0.5,
    }))
  );
  expect(ranks.map((r) => leonaEclipseValues(r, 0, 0, 0))).toEqual(
    [55, 85, 115, 145, 175].map((magicDamage, i) => ({
      magicDamage,
      mana: 60,
      cooldownSeconds: 14 - i,
      armorBonus: 20 + i * 7.5,
      magicResistBonus: 20 + i * 7.5,
      flatReduction: 8 + i * 4,
      flatReductionMaximumFraction: 0.5,
      resistanceSeconds: 3,
    }))
  );
  expect([1, 2, 3].map((r) => leonaSolarFlareValues(r, 0))).toEqual(
    [150, 225, 300].map((magicDamage, i) => ({
      magicDamage,
      mana: 100,
      cooldownSeconds: 90 - i * 15,
      slowFraction: 0.8,
      crowdControlSeconds: 1.75,
    }))
  );
});

test('magic payloads scale with AP and Eclipse scales only the supplied bonus resistances', () => {
  expect(leonaDaybreakValues(5, 100).bonusMagicDamage).toBeCloseTo(140, 5);
  expect(leonaZenithValues(5, 100).magicDamage).toBeCloseTo(250, 5);
  expect(leonaSolarFlareValues(3, 100).magicDamage).toBeCloseTo(380, 5);
  const eclipse = leonaEclipseValues(3, 100, 100, 50);
  expect(eclipse.magicDamage).toBeCloseTo(155, 5);
  expect(eclipse.armorBonus).toBeCloseTo(55, 5);
  expect(eclipse.magicResistBonus).toBeCloseTo(45, 5);
  // Finite negative inputs are formula inputs too; no undocumented clamp.
  expect(leonaEclipseValues(1, -10, -5, -10).armorBonus).toBeCloseTo(19, 5);
  expect(leonaEclipseValues(1, -10, -5, -10).magicResistBonus).toBeCloseTo(18, 5);
});

test('Sunlight uses source character-level indices 1..18, excluding dummy and extended levels', () => {
  expect(Array.from({ length: 18 }, (_, i) => leonaSunlightDamage(i + 1))).toEqual([
    32, 39, 46, 53, 60, 67, 74, 81, 88, 95, 102, 109, 116, 123, 130, 137, 144, 151,
  ]);
  expect(LEONA_SUNLIGHT.markSeconds).toBe(2.5);
  const dd = JSON.parse(readFileSync('docs/reference/leona/ddragon-16.18.1.json', 'utf8'));
  expect(dd.data.Leona.passive.description).toContain('1.5 seconds');
  for (const level of [0, -1, 1.5, 19, 30, NaN, Infinity])
    expect(() => leonaSunlightDamage(level)).toThrow(RangeError);
});

test('invalid ranks cannot leak dummy/trailing values, including R trailing zero mana', () => {
  for (const spell of ['q', 'w', 'e', 'r'] as const) {
    for (const rank of [0, -1, 1.5, NaN, Infinity, -Infinity, spell === 'r' ? 4 : 6])
      expect(() => leonaSpellResources(spell, rank)).toThrow(RangeError);
  }
  for (const rank of [0, 6]) {
    expect(() => leonaDaybreakValues(rank, 0)).toThrow(RangeError);
    expect(() => leonaEclipseValues(rank, 0, 0, 0)).toThrow(RangeError);
    expect(() => leonaZenithValues(rank, 0)).toThrow(RangeError);
  }
  for (const rank of [0, 4]) expect(() => leonaSolarFlareValues(rank, 0)).toThrow(RangeError);
});

test('nonfinite stats fail before creating a combat payload', () => {
  for (const invalid of [NaN, Infinity, -Infinity]) {
    expect(() => leonaDaybreakValues(1, invalid)).toThrow(RangeError);
    expect(() => leonaZenithValues(1, invalid)).toThrow(RangeError);
    expect(() => leonaSolarFlareValues(1, invalid)).toThrow(RangeError);
    expect(() => leonaEclipseValues(1, invalid, 0, 0)).toThrow(RangeError);
    expect(() => leonaEclipseValues(1, 0, invalid, 0)).toThrow(RangeError);
    expect(() => leonaEclipseValues(1, 0, 0, invalid)).toThrow(RangeError);
  }
});

test('legacy child damage, retired-looking R on-hit fields and other-mode overrides stay separate', () => {
  const source = JSON.parse(readFileSync('docs/reference/leona/character.json', 'utf8')).records;
  const prefix = 'Characters/Leona/Spells/';
  const r = source[`${prefix}LeonaSolarFlareAbility/LeonaSolarFlare`].mSpell;
  expect(r.DataValues.find((v: { name: string }) => v.name === 'OnHitBaseDamage')).toBeDefined();
  expect(LEONA_SPELLS.r).not.toHaveProperty('onHitDamage');
  expect(LEONA_SPELLS.r.abilityPowerRatio).toBeCloseTo(0.8, 7);
  expect(r.DataValuesModeOverride.cherry.SpellDataValues[0].values[1]).toBe(1);
  const qChild = source[`${prefix}LeonaShieldOfDaybreakAbility/LeonaShieldOfDaybreakAttack`].mSpell;
  expect(qChild.mCoefficient).toBeCloseTo(0.4, 7);
  expect(LEONA_SPELLS.q.abilityPowerRatio).toBeCloseTo(0.3, 7);
  expect(LEONA_SPELLS.e).toMatchObject({
    displayRange: 875,
    authoredCastSeconds: 0.25,
    castCannotCancelWindup: true,
    missile: { speed: 2000, authoredWidth: 70, castRange: 900, projectToCastRange: true },
  });
  expect(LEONA_SPELLS.w).toMatchObject({ displayRange: 450, authoredCastRadius: 500 });
  expect(LEONA_SPELLS.r).toMatchObject({ authoredInnerRadius: 120, authoredOuterRadius: 300 });
});

test('progression preserves the AD conflict and converts AS growth and regeneration units once', () => {
  const dd = JSON.parse(readFileSync('docs/reference/leona/ddragon-16.18.1.json', 'utf8')).data
    .Leona.stats;
  expect(LEONA.damageGrowth).toBe(3);
  expect(dd.attackdamageperlevel).toBe(0);
  expect(LEONA.attackSpeedGrowth).toBeCloseTo(0.029, 8);
  expect(LEONA.healthRegen * 5).toBeCloseTo(dd.hpregen, 6);
  expect(LEONA.manaRegen * 5).toBeCloseTo(dd.mpregen, 6);
  expect(LEONA.manaRegenGrowth * 5).toBeCloseTo(dd.mpregenperlevel, 6);
  expect(LEONA).not.toHaveProperty('attackDelayCastOffsetPercentAttackSpeedRatio');
  expect(LEONA).not.toHaveProperty('windupTicks');
});
