import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { ITEMS } from '../src/content/rules';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

test('all current item sell prices match the pinned data', () => {
  const pin = JSON.parse(readFileSync('docs/reference/item-selling.json', 'utf8'));
  for (const item of ITEMS) expect(item.sell).toBe(pin.items[item.icon].gold.sell);
});

test('selling removes only the selected copy and preserves growth and checkpoint state', () => {
  const w = new World(false, PRACTICE_FIXTURE);
  w.player.gold = 2000;
  expect(w.buy('sword')).toBeNull();
  expect(w.buy('boots')).toBeNull();
  expect(w.buy('sword')).toBeNull();
  w.gainExperience(280);
  const damage = w.hero.damage;
  expect(w.sell(2)).toBeNull();
  expect(w.player.inventory).toEqual(['sword', 'boots']);
  expect(w.player.gold).toBe(1245);
  expect(w.hero.damage).toBe(damage - 10);
  expect(w.sell(1)).toBeNull();
  expect(w.hero.speed).toBe(325);
  expect(w.buy('boots')).toBeNull();
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('enemy ownership and dead health are preserved when selling a health item', () => {
  const w = new World(false, PRACTICE_FIXTURE);
  const bot = w.spawn('champion', 'red', w.battlefield.spawns.red);
  expect(w.buy('blade', bot.id)).toBeNull();
  w.damage(w.hero, bot, 10000, 'true');
  const deadline = bot.respawnTick;
  const humanGold = w.player.gold;
  expect(w.sell(0, bot.id)).toBeNull();
  expect(bot.hp).toBe(0);
  expect(bot.maxHp).toBe(610);
  expect(bot.respawnTick).toBe(deadline);
  expect(w.championState(bot.id)!.gold).toBe(230);
  expect(w.player.gold).toBe(humanGold);
});

test('invalid sales are atomic; losing item health cannot kill a living champion', () => {
  const w = new World(false, PRACTICE_FIXTURE);
  w.buy('blade');
  w.hero.hp = 10;
  for (const slot of [-1, 1, 0.5, NaN]) {
    const before = w.snapshot();
    expect(w.sell(slot)).not.toBeNull();
    expect(w.snapshot()).toBe(before);
  }
  w.hero.x += 1000;
  const before = w.snapshot();
  expect(w.sell(0)).toContain('fountain');
  expect(w.snapshot()).toBe(before);
  w.hero.x -= 1000;
  expect(w.sell(0)).toBeNull();
  expect(w.hero.hp).toBe(1);
  expect(w.player.gold).toBe(230);
  w.winner = 'blue';
  expect(w.sell(0)).toBe('The game has ended');
});
