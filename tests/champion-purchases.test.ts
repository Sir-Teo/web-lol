import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

function shop() {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const bot = w.spawn('champion', 'red', w.battlefield.spawns.red);
  bot.ai = false;
  return { w, bot, state: w.championState(bot.id)! };
}

test('enemy purchases spend its gold and modify only its own inventory and stats', () => {
  const { w, bot, state } = shop();
  expect(w.buy('blade', bot.id)).toBeNull();
  expect(state.gold).toBe(50);
  expect(state.inventory).toEqual(['blade']);
  expect(bot.damage).toBe(69);
  expect(bot.maxHp).toBe(690);
  expect(bot.hp).toBe(690);
  expect(w.player.gold).toBe(500);
  expect(w.player.inventory).toEqual([]);
  expect(w.hero.maxHp).toBe(610);
  expect(w.hero.damage).toBe(59);
});

test('shop checks the correct fountain, capacity, balance and duplicate boots', () => {
  const { w, bot, state } = shop();
  Object.assign(bot, w.battlefield.spawns.blue);
  expect(w.buy('blade', bot.id)).toMatch(/fountain/);
  Object.assign(bot, w.battlefield.spawns.red);
  state.gold = 2000;
  expect(w.buy('boots', bot.id)).toBeNull();
  expect(w.buy('boots', bot.id)).toMatch(/already own/);
  state.inventory = ['sword', 'sword', 'sword', 'sword', 'sword', 'sword'];
  expect(w.buy('blade', bot.id)).toMatch(/full/);
  state.inventory = [];
  state.gold = 449.99;
  expect(w.buy('blade', bot.id)).toMatch(/Not enough/);
  expect(w.buy('blade', 999999)).toBe('Unknown champion');
});

test('health purchases while dead increase maximum HP without reviving either owner', () => {
  const { w, bot } = shop();
  for (const champion of [w.hero, bot]) {
    champion.hp = 0;
    champion.deadAt = 0;
    champion.respawnTick = 600;
    expect(w.buy('blade', champion.id)).toBeNull();
    expect(champion.hp).toBe(0);
    expect(champion.maxHp).toBe(690);
    expect(champion.respawnTick).toBe(600);
  }
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(600);
  restored.step(600);
  expect(restored.snapshot()).toBe(w.snapshot());
  expect(bot.hp).toBe(690);
});

test('healthy fountain bot buys crit-build components within budget and restores its next choice', () => {
  const { w, bot, state } = shop();
  bot.ai = true;
  bot.speed = 0;
  state.gold = 3000;
  w.step();
  expect(state.inventory).toEqual(['blade']);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(100);
  restored.step(100);
  expect(restored.snapshot()).toBe(w.snapshot());
  expect(state.inventory).toEqual(['blade', 'boots', 'bf-sword', 'pickaxe']);
  expect(state.gold).toBe(75);
});

test('bot saves for its next item and cannot shop away from its fountain', () => {
  const { w, bot, state } = shop();
  bot.ai = true;
  state.gold = 400;
  w.step();
  expect(state.inventory).toEqual([]);
  expect(state.gold).toBe(400);
  state.gold = 1000;
  bot.x = bot.y = 0;
  bot.nextThink = w.tick + 1;
  w.step();
  expect(state.inventory).toEqual([]);
});
