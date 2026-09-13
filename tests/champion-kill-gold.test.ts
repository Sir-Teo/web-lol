import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { CHAMPION_BASE_KILL_GOLD } from '../src/content/champion-kill-gold';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { World } from '../src/simulation/world';

test('base kill gold retains the pinned standard-mode table', () => {
  const pin = JSON.parse(readFileSync('docs/reference/assist-window.json', 'utf8'));
  expect(CHAMPION_BASE_KILL_GOLD).toEqual(pin.record.BaseGold);
});

for (const team of ['blue', 'red'] as const)
  test(`${team} killers receive victim-level gold at every supported level`, () => {
    for (let level = 1; level <= 18; level++) {
      const w = new World(false, PRACTICE_FIXTURE);
      const killer = w.spawn('champion', team, { x: 0, y: 0 });
      const victim = w.spawn('champion', team === 'blue' ? 'red' : 'blue', { x: 0, y: 0 });
      const recipient = w.championState(killer.id)!;
      recipient.level = 19 - level; // Deliberately different from the victim.
      w.championState(victim.id)!.level = level;
      const expected = 300 + Math.max(0, level - 6) * 10;
      w.damage(killer, victim, 10000, 'true');
      expect(recipient.gold).toBe(500 + expected);
      expect(recipient.kills).toBe(1);
      expect(recipient.cs).toBe(0);
      expect(w.events.find((event) => event.type === 'gold')).toMatchObject({
        value: expected,
        unit: killer.id,
        audience: [team],
      });
      w.damage(killer, victim, 10000, 'true');
      expect(recipient.gold).toBe(500 + expected);
    }
  });

test('saved victim progression determines a posthumous killer reward', () => {
  const w = new World(false, PRACTICE_FIXTURE);
  const victim = w.spawn('champion', 'red', { x: 0, y: 0 });
  w.gainExperience(1e6, victim.id);
  w.damage(victim, w.hero, 10000, 'true');
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  const before = restored.player.gold;
  restored.damage(restored.hero, restored.unit(victim.id)!, 10000, 'true');
  expect(restored.player.gold - before).toBe(420);
  expect(restored.hero.hp).toBe(0);
  w.damage(w.hero, victim, 10000, 'true');
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('fixture overrides and nonchampion final blows keep their explicit semantics', () => {
  const w = new World(false, PRACTICE_FIXTURE);
  const victim = w.spawn('champion', 'red', { x: 0, y: 0 });
  w.gainExperience(1e6, victim.id);
  victim.goldBounty = 75;
  w.damage(w.hero, victim, 10000, 'true');
  expect(w.player.gold).toBe(575);
  const other = w.spawn('champion', 'red', { x: 0, y: 0 });
  w.damage(w.spawn('melee', 'blue', { x: 0, y: 0 }), other, 10000, 'true');
  expect(w.player.gold).toBe(575);
  expect(w.player.kills).toBe(1);
});
