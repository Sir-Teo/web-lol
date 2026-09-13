import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { experienceToNextLevel } from '../src/simulation/progression';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

for (const team of ['blue', 'red'] as const)
  test(`${team} bot follows the map-11 opening and spends legal points through level eighteen`, () => {
    const w = new World(false);
    w.nextWaveTick = Infinity;
    w.gainExperience(660);
    const bot = w.spawn('champion', team, w.battlefield.spawns[team]);
    bot.ai = true;
    const state = w.championState(bot.id)!;
    state.spellRanks = { q: 0, w: 0, e: 0, r: 0 };
    state.skillPoints = 1;
    const choices: string[] = [];
    for (let level = 1; level <= 18; level++) {
      if (level > 1) w.gainExperience(experienceToNextLevel(state.level), bot.id);
      const before = { ...state.spellRanks };
      w.step();
      for (const key of ['q', 'w', 'e', 'r'] as const)
        if (state.spellRanks[key] !== before[key]) choices.push(key);
      expect(state.skillPoints).toBe(0);
      expect(Object.values(state.spellRanks).reduce((a, b) => a + b, 0)).toBe(level);
    }
    expect(choices).toEqual([
      'w',
      'q',
      'e',
      'w',
      'w',
      'r',
      'w',
      'q',
      'w',
      'q',
      'r',
      'q',
      'q',
      'e',
      'e',
      'r',
      'e',
      'e',
    ]);
    expect(state.spellRanks).toEqual({ q: 5, w: 5, e: 5, r: 3 });
    expect(w.player.spellRanks).toEqual({ q: 1, w: 1, e: 1, r: 1 });
    expect(w.player.skillPoints).toBe(2);
  });

test('dead bot spends accumulated points identically after a saved continuation', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const bot = w.spawn('champion', 'red', { x: 0, y: 0 });
  bot.ai = true;
  const state = w.championState(bot.id)!;
  state.spellRanks = { q: 0, w: 0, e: 0, r: 0 };
  state.skillPoints = 1;
  w.gainExperience(1e6, bot.id);
  w.damage(w.hero, bot, 100000, 'true');
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step();
    expect(world.unit(bot.id)!.hp).toBe(0);
    expect(world.championState(bot.id)!.spellRanks).toEqual({ q: 5, w: 5, e: 5, r: 3 });
    expect(world.championState(bot.id)!.skillPoints).toBe(0);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('bot allocation feeds a real ranked Volley without requiring rank mutation', () => {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    lineOfSight: () => true,
    findPath: (_from, to) => [{ x: to.x, y: to.y }],
    reachable: (p) => ({ x: p.x, y: p.y }),
    lineWalkable: () => true,
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = 0;
  const bot = w.spawn('champion', 'red', { x: 900, y: 0 });
  bot.ai = true;
  w.gainExperience(660, bot.id);
  w.step(17);
  expect(w.championState(bot.id)!.spellRanks.w).toBe(2);
  const arrows = w.projectiles.filter((p) => p.source === bot.id && p.type === 'volley');
  expect(arrows).toHaveLength(8);
  for (const arrow of arrows) expect(arrow.damage).toBeCloseTo(95);
});
