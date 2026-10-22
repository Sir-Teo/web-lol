import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import pin from '../docs/reference/summoner-smite-source.json';
import parent from '../docs/reference/jungle-character-source.json';
import { SUMMONER_SMITE as S } from '../src/content/summoner-smite';
const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
test('standard Smite pins current damage and charge fields without adopting alternate-mode values', () => {
  const spell = pin.shared.records['Shared/Spells/SummonerSmite'].mSpell;
  const values = Object.fromEntries(spell.DataValues.map((v) => [v.name, v.values[0]]));
  expect([S.baseDamage, S.upgradedDamage, S.finalDamage]).toEqual([600, 1000, 1400]);
  expect([
    values.SmiteBaseDamage,
    values.SmiteUpgradedDamage,
    values.Smite2ndUpgradedDamage,
  ]).toEqual(pin.published.damage);
  expect([S.maxCharges, S.cooldownSeconds, S.rechargeSeconds, S.range]).toEqual([2, 15, 90, 500]);
  expect(spell.castRangeUseBoundingBoxes).toBe(true);
  expect(
    spell.canCastWhileDisabled && spell.mDoesntBreakChannels && spell.mCooldownNotAffectedByCDR
  ).toBe(true);
  expect(pin.strings.entries.spell_smite_shared_rules).toContain(
    'Cannot be cast on small monsters'
  );
});
test('all source target classifications match parent Root tags, including medium Krugs', () => {
  expect(sha(pin.characterSource.path)).toBe(pin.characterSource.sha256);
  for (const [species, item] of Object.entries(pin.characterSource.tags)) {
    const records = parent.records as unknown as Record<
      string,
      Record<string, { unitTagsString: string }>
    >;
    expect(item.unitTagsString).toBe(records[item.path][item.key].unitTagsString);
    expect((S.monsterTags as Record<string, readonly string[]>)[species]).toEqual(
      item.unitTagsString.split(' | ')
    );
  }
  expect(S.monsterTags['krug-medium']).toContain('Monster_Medium');
  expect(S.monsterTags['wolf-mini']).not.toContain('Monster_Large');
});
test('three original scripts expose metadata without claiming an active native startup or hit handler', () => {
  expect(pin.scripts.files).toHaveLength(3);
  for (const inventory of Object.values(pin.scriptInventory)) {
    expect(Object.keys(inventory)).toEqual(['<main>']);
    const f = inventory['<main>'];
    expect(f.children).toBe(0);
    expect(
      f.instructions.every((i) => ['LOADBOOL', 'LOADK', 'SETGLOBAL', 'RETURN'].includes(i.op))
    ).toBe(true);
  }
});
test('Smite source icon retains its pinned official PNG bytes', () => {
  expect(sha(pin.icon.path)).toBe(pin.icon.sha256);
  expect(readFileSync(pin.icon.path).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
});
