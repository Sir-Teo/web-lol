import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function danger(team: 'blue' | 'red' = 'red') {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    spawns: { blue: { x: -5000, y: 0 }, red: { x: 5000, y: 0 } },
    findPath: (_a, b) => [{ ...b }],
    reachable: (p) => ({ ...p }),
    lineOfSight: () => true,
    lineWalkable: () => true,
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -10000;
  const bot = w.spawn('champion', team, { x: team === 'red' ? 200 : -200, y: 0 });
  const enemy = w.spawn('champion', team === 'red' ? 'blue' : 'red', { x: 0, y: 0 });
  bot.hp = 50;
  bot.ai = true;
  const state = w.championState(bot.id)!;
  state.cooldowns.f = state.cooldowns.r = 10000;
  return { w, bot, enemy, state };
}

for (const team of ['blue', 'red'] as const) {
  test(`${team} critical-health bot flashes away through a saved normal command`, () => {
    const { w, bot, enemy, state } = danger(team);
    w.step();
    expect(w.commands.some((c) => c.type === 'cast' && c.ability === 'd')).toBe(true);
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, restored]) {
      world.step();
      const own = world.unit(bot.id)!;
      expect(Math.hypot(own.x - enemy.x, own.y - enemy.y)).toBeCloseTo(600);
      expect(world.championState(bot.id)!.cooldowns.d).toBe(world.tick + 18000);
      world.step(18);
      expect(own.order.type).toBe('move');
      expect(own.aiRetreating).toBe(true);
    }
    expect(state.cooldowns.d).toBeGreaterThan(w.tick);
    expect(w.player.cooldowns.d).toBe(0);
    expect(restored.snapshot()).toBe(w.snapshot());
  });
}

test('Flash is not wasted without critical health, a visible close threat or useful terrain clearance', () => {
  for (const reason of ['healthy', 'hidden', 'far', 'cooldown', 'terrain', 'home']) {
    const { w, bot, enemy, state } = danger();
    if (reason === 'healthy') bot.hp = 100;
    if (reason === 'hidden') w.battlefield.lineOfSight = () => false;
    if (reason === 'far') enemy.x = -1000;
    if (reason === 'cooldown') state.cooldowns.d = 1000;
    if (reason === 'terrain') w.battlefield.reachable = () => ({ x: bot.x + 50, y: bot.y });
    if (reason === 'home') {
      bot.x = 4900;
      enemy.x = 4800;
    }
    w.step();
    expect(
      w.commands.some((c) => c.type === 'cast' && c.ability === 'd'),
      reason
    ).toBe(false);
  }
});

test('visible tower danger blocks an otherwise useful Flash landing', () => {
  const { w } = danger();
  const tower = w.spawn('turret', 'blue', { x: 600, y: 0 });
  tower.range = 1000;
  w.step();
  expect(w.commands.some((c) => c.type === 'cast' && c.ability === 'd')).toBe(false);
});

test('a second visible enemy prevents flashing into the apparent escape direction', () => {
  const { w } = danger();
  w.spawn('champion', 'blue', { x: 700, y: 0 });
  w.step();
  expect(w.commands.some((c) => c.type === 'cast' && c.ability === 'd')).toBe(false);
});

test('queued emergency Flash is rejected if stunned before execution', () => {
  const { w, bot, state } = danger();
  w.step();
  const point = { x: bot.x, y: bot.y };
  bot.stunUntil = 1000;
  w.step();
  expect({ x: bot.x, y: bot.y }).toEqual(point);
  expect(state.cooldowns.d).toBe(0);
});
