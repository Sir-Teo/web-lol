import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function setup(team: 'blue' | 'red') {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => false });
  w.nextWaveTick = Infinity;
  const bot = w.spawn('champion', team, w.battlefield.spawns[team]);
  const state = w.championState(bot.id)!;
  state.gold = 20000;
  for (const item of ['blade', 'boots']) expect(w.buy(item, bot.id)).toBeNull();
  bot.ai = true;
  const think = () => {
    bot.nextThink = w.tick;
    w.step();
  };
  return { w, bot, state, think };
}

for (const team of ['blue', 'red'] as const) {
  test(`${team} bot buys affordable components then combines and keeps its completed item`, () => {
    const { w, bot, state, think } = setup(team);
    for (const [gold, item] of [
      [875, 'pickaxe'],
      [600, 'agility'],
      [1300, 'bf-sword'],
    ] as const) {
      state.gold = gold;
      think();
      expect(state.inventory).toContain(item);
      expect(state.gold).toBe(0);
    }
    state.gold = 725;
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    think();
    const rb = restored.unit(bot.id)!;
    rb.nextThink = restored.tick;
    restored.step();
    expect(w.snapshot()).toBe(restored.snapshot());
    expect(state.inventory.filter(Boolean).sort()).toEqual(['blade', 'boots', 'infinity-edge']);
    expect(w.criticalChance(bot)).toBe(0.25);
    expect(w.basicAttackDamageMultiplier(bot)).toBe(1.325);
    state.gold = 10000;
    for (let i = 0; i < 10; i++) think();
    expect(state.inventory.filter(Boolean).sort()).toEqual(['blade', 'boots', 'infinity-edge']);
    expect(state.gold).toBe(10000);
  });
}

test('bot buys the finished item directly when it can afford the complete price', () => {
  const { state, think } = setup('red');
  state.gold = 3500;
  think();
  expect(state.inventory).toContain('infinity-edge');
  expect(state.inventory).not.toContain('bf-sword');
  expect(state.gold).toBe(0);
});

test('full inventory containing recipe components can combine without selling unrelated items', () => {
  const { w, bot, state, think } = setup('red');
  bot.ai = false;
  for (const item of ['bf-sword', 'pickaxe', 'agility', 'sword'])
    expect(w.buy(item, bot.id)).toBeNull();
  expect(state.inventory).toHaveLength(6);
  state.gold = 725;
  bot.ai = true;
  think();
  expect(state.inventory.filter(Boolean).sort()).toEqual([
    'blade',
    'boots',
    'infinity-edge',
    'sword',
  ]);
  expect(state.gold).toBe(0);
});
