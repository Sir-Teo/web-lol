import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

test('reordering swaps items or moves into an empty slot without changing combat stats or gold', () => {
  const w = new World(false, PRACTICE_FIXTURE);
  w.player.gold = 2000;
  w.buy('sword');
  w.buy('boots');
  const unit = JSON.stringify(w.hero),
    gold = w.player.gold;
  w.hero.x += 1000; // Reordering is allowed away from the shop.
  expect(w.moveItem(0, 5)).toBeNull();
  expect(w.player.inventory).toEqual([null, 'boots', null, null, null, 'sword']);
  expect(w.moveItem(5, 1)).toBeNull();
  expect(w.player.inventory).toEqual([null, 'sword', null, null, null, 'boots']);
  w.hero.x -= 1000;
  expect(JSON.stringify(w.hero)).toBe(unit);
  expect(w.player.gold).toBe(gold);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  expect(restored.player.inventory).toEqual(w.player.inventory);
  expect(restored.sell(5)).toBeNull();
  expect(restored.player.gold).toBe(gold + 210);
  expect(restored.hero.speed).toBe(325);
});

test('reordering a dead enemy inventory preserves ownership and rejects invalid operations atomically', () => {
  const w = new World(false, PRACTICE_FIXTURE);
  const bot = w.spawn('champion', 'red', w.battlefield.spawns.red);
  w.buy('blade', bot.id);
  w.damage(w.hero, bot, 10000, 'true');
  const hp = bot.hp,
    deadline = bot.respawnTick;
  expect(w.moveItem(0, 4, bot.id)).toBeNull();
  expect(w.championState(bot.id)!.inventory).toEqual([null, null, null, null, 'blade']);
  expect(w.player.inventory).toEqual([]);
  expect(bot.hp).toBe(hp);
  expect(bot.respawnTick).toBe(deadline);
  for (const [from, to] of [
    [0, 1],
    [4, 6],
    [4, -1],
    [4, NaN],
    [4.5, 0],
  ]) {
    const before = w.snapshot();
    expect(w.moveItem(from, to, bot.id)).not.toBeNull();
    expect(w.snapshot()).toBe(before);
  }
  expect(w.moveItem(4, 4, bot.id)).toBeNull();
  expect(w.moveItem(0, 1, 99999)).toBe('Unknown champion');
  w.winner = 'red';
  expect(w.moveItem(4, 0, bot.id)).toBe('The game has ended');
});
