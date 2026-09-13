import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { MINION_XP_SHARES } from '../src/content/minion-xp-sharing';
import { readFileSync } from 'node:fs';

test('runtime XP shares preserve the normalized pinned mode table', () => {
  const pin = JSON.parse(readFileSync('docs/reference/minion-xp-sharing.json', 'utf8'));
  expect(MINION_XP_SHARES).toEqual(
    pin.data.mPlayerMinionSplitXp.map((n: number) => Number(n.toFixed(6)))
  );
  expect(MINION_XP_SHARES).toEqual([1, 0.65, 0.433, 0.325, 0.26, 0.217]);
});

for (const count of [1, 2, 3, 4, 5])
  test(`${count} enemy champions share minion XP while only the last hitter earns gold and CS`, () => {
    const w = new World(false, PRACTICE_FIXTURE);
    const bots = Array.from({ length: count }, () => w.spawn('champion', 'red', { x: 0, y: 0 }));
    const minion = w.spawn('melee', 'blue', { x: 100, y: 0 });
    minion.experienceBounty = 62;
    minion.goldBounty = 20;
    w.damage(bots[0], minion, 10000, 'true');
    for (const [i, bot] of bots.entries()) {
      const state = w.championState(bot.id)!;
      expect(state.xp).toBeCloseTo(62 * MINION_XP_SHARES[count - 1]);
      expect(state.gold).toBe(i === 0 ? 520 : 500);
      expect(state.cs).toBe(i === 0 ? 1 : 0);
    }
    expect(w.player.gold).toBe(500);
    expect(w.player.xp).toBe(0);
    expect(w.events.find((e) => e.type === 'gold')?.audience).toEqual(['red']);
  });

test('dead and distant champions do not dilute nearby XP; level cap recipients still count', () => {
  const w = new World(false, PRACTICE_FIXTURE);
  const nearby = w.spawn('champion', 'red', { x: 0, y: 0 });
  const capped = w.spawn('champion', 'red', { x: 1400, y: 0 });
  w.gainExperience(1e6, capped.id);
  const distant = w.spawn('champion', 'red', { x: 1400.001, y: 0 });
  const dead = w.spawn('champion', 'red', { x: 0, y: 0 });
  dead.hp = 0;
  dead.deadAt = 0;
  const minion = w.spawn('caster', 'blue', { x: 0, y: 0 });
  minion.experienceBounty = 31;
  w.damage(w.spawn('melee', 'red', { x: 0, y: 0 }), minion, 10000, 'true');
  expect(w.championState(nearby.id)!.xp).toBeCloseTo(20.15);
  for (const bot of [capped, distant, dead]) expect(w.championState(bot.id)!.xp).toBe(0);
});

test('enemy progression changes its stats, preserves death and restores independently', () => {
  const w = new World(false, PRACTICE_FIXTURE);
  w.nextWaveTick = Infinity;
  const bot = w.spawn('champion', 'red', { x: 0, y: 0 });
  bot.ai = false;
  w.gainExperience(280, bot.id);
  expect(w.championState(bot.id)!.level).toBe(2);
  expect(bot.maxHp).toBeCloseTo(682.72);
  expect(w.player.level).toBe(1);
  expect(w.hero.maxHp).toBe(610);
  w.damage(w.hero, bot, 10000, 'true');
  const respawn = bot.respawnTick;
  w.gainExperience(1e6, bot.id);
  expect(bot.hp).toBe(0);
  expect(bot.maxHp).toBe(2327);
  expect(bot.respawnTick).toBe(respawn);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(120);
  restored.step(120);
  expect(restored.snapshot()).toBe(w.snapshot());
  expect(w.events.filter((e) => e.type === 'level').every((e) => e.audience.join() === 'red')).toBe(
    true
  );
});

test('ambient gold and champion kill credit belong to the enemy even through death', () => {
  const w = new World(false, PRACTICE_FIXTURE);
  w.nextWaveTick = Infinity;
  const bot = w.spawn('champion', 'red', { x: 0, y: 0 });
  bot.ai = false;
  const state = w.championState(bot.id)!;
  w.damage(bot, w.hero, 10000, 'true');
  expect(state.kills).toBe(1);
  expect(state.gold).toBe(800);
  w.damage(w.hero, bot, 10000, 'true');
  bot.respawnTick = 10000;
  w.hero.respawnTick = 10000;
  w.tick = 65 * 60;
  w.step(60);
  expect(bot.hp).toBe(0);
  expect(w.hero.hp).toBe(0);
  expect(state.gold).toBeCloseTo(802.04);
  expect(w.player.gold).toBeCloseTo(802.04);
});
