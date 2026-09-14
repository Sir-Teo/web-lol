import { expect, test } from 'vitest';
import character from '../docs/reference/lux-character.json';
import model from '../public/assets/models/lux-base.json';
import variants from '../docs/reference/lux-attack-variants.json';
import { luxAttackAnimation } from '../src/content/lux-attack-animation';

test('equal ordinary Lux variants are backed by character slots and converted clips', () => {
  const record = Object.values(character.records).find(
    (r: any) => r.__type === 'CharacterRecord'
  ) as any;
  expect(record.basicAttack.mAttackProbability).toBe(0.5);
  expect(record.extraAttacks).toEqual([
    { mAttackProbability: 0.5, mAttackName: 'LuxBasicAttack2', __type: 'AttackSlotData' },
  ]);
  for (const name of ['attack1', 'attack2'])
    expect(model.clips.some((c) => c.name === name)).toBe(true);
  const first = variants.records['Characters/Lux/Spells/LuxBasicAttack'].mSpell;
  const second = variants.records['Characters/Lux/Spells/LuxBasicAttack2'].mSpell;
  expect(second.mAnimationName).toBe('Attack2');
  expect(second.mAlternateName).toBe('LuxBasicAttack');
  expect(second.mMissileSpec).toEqual(first.mMissileSpec);
  expect(second.castFrame).toBe(first.castFrame);
  expect(second.spellCastTime).toBe(first.spellCastTime);
  expect(second.mMissileEffectKey).toBe(first.mMissileEffectKey);
});

test('visual selection is stable across reordering and covers both weighted variants', () => {
  const cycles = Array.from({ length: 10000 }, (_, i) => ({ id: 3 + (i % 10), tick: 1 + 90 * i }));
  const expected = cycles.map((c) => luxAttackAnimation(c.id, c.tick));
  const reverse = [...cycles]
    .reverse()
    .map((c) => luxAttackAnimation(c.id, c.tick))
    .reverse();
  expect(reverse).toEqual(expected);
  const second = expected.filter((name) => name === 'attack2').length;
  expect(second).toBeGreaterThan(4800);
  expect(second).toBeLessThan(5200);
});
