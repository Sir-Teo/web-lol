import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

for (const team of ['blue', 'red'] as const)
  test(`${team} champions recover at their own fountain and bots remain until healthy`, () => {
    const w = new World(false);
    w.nextWaveTick = Infinity;
    const bot = w.spawn('champion', team, w.battlefield.spawns[team]);
    bot.ai = true;
    bot.hp = 100;
    bot.mana = 0;
    w.step(60);
    expect(bot.hp).toBeCloseTo(100 + 610 * 0.09);
    expect(bot.mana).toBeCloseTo(280 * 0.12);
    expect(bot.aiRetreating).toBe(true);
    expect(bot.order.type).toBe('idle');
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    w.step(480);
    restored.step(480);
    expect(bot.aiRetreating).toBe(false);
    expect(bot.hp).toBeGreaterThanOrEqual(bot.maxHp * 0.85);
    expect(restored.snapshot()).toBe(w.snapshot());
  });

test('low-health bots replace an unrelated move order with their own home', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  for (const team of ['blue', 'red'] as const) {
    const bot = w.spawn('champion', team, { x: 0, y: 0 });
    bot.ai = true;
    bot.hp = 100;
    bot.order = { type: 'move', point: { x: 300, y: 300 } };
    w.step();
    expect(bot.aiRetreating).toBe(true);
    expect(bot.order).toEqual({ type: 'move', point: w.battlefield.spawns[team] });
  }
});

test('enemy fountains do not provide bonus healing, and dead champions do not regenerate', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const away = w.spawn('champion', 'red', w.battlefield.spawns.blue);
  away.hp = 100;
  away.mana = 0;
  const dead = w.spawn('champion', 'blue', w.battlefield.spawns.blue);
  dead.hp = 0;
  dead.deadAt = 0;
  w.step(60);
  expect(away.hp).toBeCloseTo(100.7);
  expect(away.mana).toBeCloseTo(1.4);
  expect(dead.hp).toBe(0);
});
