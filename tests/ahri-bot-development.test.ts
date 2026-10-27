import { expect, test } from 'vitest';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { experienceToNextLevel } from '../src/simulation/progression';
import { World } from '../src/simulation/world';

function setup(team: 'blue' | 'red' = 'blue') {
  const world = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
  world.nextWaveTick = Infinity;
  world.hero.x = world.hero.y = -3000;
  const bot = world.spawn('champion', team, world.battlefield.spawns[team], 'ahri');
  const state = world.championState(bot.id)!;
  state.role = 'mid';
  bot.ai = true;
  bot.nextThink = Infinity;
  return { world, bot, state };
}

for (const team of ['blue', 'red'] as const)
  test(`${team} Ahri spends legal points through level eighteen without borrowing Ashe charges`, () => {
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
      'q',
      'q',
      'r',
      'q',
      'w',
      'q',
      'w',
      'r',
      'w',
      'w',
      'e',
      'e',
      'r',
      'e',
      'e',
    ]);
    expect(state.spellRanks).toEqual({ q: 5, w: 5, e: 5, r: 3 });
    expect(world.player.spellRanks).toEqual({ q: 1, w: 1, e: 1, r: 1 });
  });

test('Ahri buys mage components, consumes upgrades once and stops at the bounded build', () => {
  const { world, bot, state } = setup();
  state.gold = 10000;
  const inventories: (string | null)[][] = [];
  const gold: number[] = [];
  for (let i = 0; i < 12; i++) {
    bot.x = world.battlefield.spawns.blue.x;
    bot.y = world.battlefield.spawns.blue.y;
    bot.nextThink = world.tick + 1;
    world.step();
    inventories.push([...state.inventory]);
    gold.push(state.gold);
  }
  expect(inventories.slice(0, 3)).toEqual([['tome'], ['tome', 'boots'], ['chapter', 'boots']]);
  expect(state.inventory.filter(Boolean).sort()).toEqual(['boots', 'chapter', 'deathcap', 'wand']);
  expect(state.inventory).not.toContain('tome');
  expect(state.inventory).not.toContain('rod');
  expect(state.inventory).not.toContain('blade');
  expect(state.inventory).not.toContain('infinity-edge');
  expect(inventories.slice(6)).toEqual(Array(6).fill(inventories[6]));
  expect(gold.slice(6)).toEqual(Array(6).fill(gold[6]));
  expect(state.gold).toBeGreaterThanOrEqual(0);
  expect(bot.speed).toBe(355);
  expect(bot.damage).toBe(53);
});

test('an unaffordable component changes neither gold nor inventory', () => {
  const { world, bot, state } = setup();
  state.gold = 0;
  bot.nextThink = 0;
  world.step();
  expect(state.gold).toBe(0);
  expect(state.inventory).toEqual([]);
});

test('learning and shopping resume exactly through saved AI continuations', () => {
  const { world, bot, state } = setup();
  state.gold = 10000;
  bot.nextThink = 0;
  world.gainExperience(2400, bot.id);
  world.step();
  expect(state.spellRanks).toEqual({ q: 3, w: 1, e: 1, r: 1 });
  expect(state.inventory).toEqual(['tome']);
  const copy = World.fromSnapshot(world.snapshot(), world.battlefield);
  for (const w of [world, copy]) {
    w.gainExperience(10000, bot.id);
    w.step(180);
  }
  expect(copy.snapshot()).toBe(world.snapshot());
});

test('dead Ahri can allocate accumulated points without being resurrected by learning', () => {
  const { world, bot, state } = setup('red');
  world.gainExperience(1e6, bot.id);
  world.damage(world.hero, bot, 100000, 'true');
  const copy = World.fromSnapshot(world.snapshot(), world.battlefield);
  for (const w of [world, copy]) {
    w.step();
    expect(w.unit(bot.id)!.hp).toBe(0);
    expect(w.championState(bot.id)!.spellRanks).toEqual({ q: 5, w: 5, e: 5, r: 3 });
    expect(w.championState(bot.id)!.skillPoints).toBe(0);
  }
  expect(copy.snapshot()).toBe(world.snapshot());
  expect(state.eCharges).toBe(0);
});

test('human Ahri remains manual and ordinary Rift admission still rejects Ahri', () => {
  const world = new World(
    false,
    {
      ...PRACTICE_FIXTURE,
      initialUnits: [],
      developmentAhri: true,
    },
    'ahri'
  );
  world.nextWaveTick = Infinity;
  world.gainExperience(1e6);
  world.step(180);
  expect(world.hero.ai).toBe(false);
  expect(world.player.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(world.player.skillPoints).toBe(18);
  expect(world.player.inventory).toEqual([]);
  expect(world.learnSpell('q')).toBeNull();
  const ordinary = new World(false, { ...PRACTICE_FIXTURE, id: 'rift', initialUnits: [] });
  expect(() => ordinary.spawn('champion', 'red', { x: 0, y: 0 }, 'ahri')).toThrow(/development/);
});
