import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { experienceToNextLevel } from '../src/simulation/progression';

function setup(team: 'blue' | 'red' = 'blue') {
  const world = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
  world.nextWaveTick = Infinity;
  world.hero.x = world.hero.y = -3000;
  const bot = world.spawn('champion', team, world.battlefield.spawns[team], 'leona');
  const state = world.championState(bot.id)!;
  state.role = 'support';
  bot.ai = true;
  bot.nextThink = Infinity;
  return { world, bot, state };
}

for (const team of ['blue', 'red'] as const)
  test(`${team} development Leona spends legal skill points through level eighteen`, () => {
    const { world, bot, state } = setup(team);
    const choices: string[] = [];
    for (let level = 1; level <= 18; level++) {
      if (level > 1) world.gainExperience(experienceToNextLevel(state.level), bot.id);
      const before = { ...state.spellRanks };
      world.step();
      for (const key of ['q', 'w', 'e', 'r'] as const)
        if (state.spellRanks[key] !== before[key]) choices.push(key);
      expect(state.skillPoints).toBe(0);
      expect(Object.values(state.spellRanks).reduce((sum, rank) => sum + rank, 0)).toBe(level);
      expect(state.eCharges).toBe(0);
    }
    expect(choices).toEqual([
      'q',
      'e',
      'w',
      'w',
      'w',
      'r',
      'w',
      'e',
      'w',
      'e',
      'r',
      'e',
      'e',
      'q',
      'q',
      'r',
      'q',
      'q',
    ]);
    expect(state.spellRanks).toEqual({ q: 5, w: 5, e: 5, r: 3 });
    expect(world.player.spellRanks).toEqual({ q: 1, w: 1, e: 1, r: 1 });
  });

test('Leona buys defensive components and consumes them once when upgrading', () => {
  const { world, bot, state } = setup();
  state.gold = 10000;
  const inventories: (string | null)[][] = [];
  for (let i = 0; i < 10; i++) {
    bot.x = world.battlefield.spawns.blue.x;
    bot.y = world.battlefield.spawns.blue.y;
    bot.nextThink = world.tick + 1;
    world.step();
    inventories.push([...state.inventory]);
  }
  expect(inventories.slice(0, 4)).toEqual([
    ['ruby'],
    ['ruby', 'boots'],
    ['ruby', 'boots', 'cloth'],
    ['ruby', 'boots', 'cloth', 'mantle'],
  ]);
  expect(state.inventory.filter(Boolean).sort()).toEqual(['belt', 'boots', 'cloak', 'vest']);
  expect(inventories.slice(6)).toEqual(Array(4).fill(inventories[6]));
  expect(bot.maxHp).toBe(996);
  expect(bot.armor).toBe(83);
  expect(bot.magicResist).toBe(77);
  expect(bot.damage).toBe(60);
  expect(bot.speed).toBe(360);
});

test('saved AI learning and shopping resume with identical futures', () => {
  const { world, bot } = setup();
  bot.nextThink = 0;
  world.gainExperience(2400, bot.id);
  world.step();
  expect(world.championState(bot.id)!.spellRanks).toEqual({ q: 1, w: 3, e: 1, r: 1 });
  expect(world.championState(bot.id)!.inventory).toContain('ruby');
  const restored = World.fromSnapshot(world.snapshot(), world.battlefield);
  for (const w of [world, restored]) {
    w.gainExperience(10000, bot.id);
    w.step(180);
  }
  expect(restored.snapshot()).toBe(world.snapshot());
});

test('the bot policy does not open Leona player or ordinary Rift spawning', () => {
  expect(() => new World(false, PRACTICE_FIXTURE, 'leona')).toThrow(/non-player/);
  const rift = new World(false, { ...PRACTICE_FIXTURE, id: 'rift', initialUnits: [] });
  expect(() => rift.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona')).toThrow(/development/);
});
