import { expect, test } from 'vitest';
import { championDeathTicks } from '../src/simulation/champion-death';
import { World } from '../src/simulation/world';

test('scaling begins after 15 minutes and uses bounded cumulative time bands', () => {
  const cases = [
    [0, 3150],
    [600 * 60, 3150],
    [900 * 60, 3150],
    [900 * 60 + 1, 3164],
    [930 * 60, 3164],
    [930 * 60 + 1, 3177],
    [1800 * 60, 3552],
    [1800 * 60 + 1, 3562],
    [2700 * 60, 3836],
    [2700 * 60 + 1, 3881],
    [3300 * 60, 4725],
    [7200 * 60, 4725],
  ];
  for (const [tick, duration] of cases) expect(championDeathTicks(18, tick)).toBe(duration);
  expect(championDeathTicks(1, 3300 * 60)).toBe(900);
});

test('crossing a scaling boundary while dead does not extend the saved deadline', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  w.gainExperience(1e6);
  w.tick = 900 * 60 - 2;
  w.step(); // Settle map/resource clocks before saving this diagnostic late death.
  w.damage(w.hero, w.hero, 1e6, 'true');
  const deadline = w.tick + 3150;
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step(2);
    expect(world.hero.respawnTick).toBe(deadline);
    world.tick = deadline - 2;
    world.step();
    expect(world.hero.hp).toBe(0);
    world.step();
    expect(world.hero.hp).toBe(world.hero.maxHp);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('late deaths apply capped scaling to both teams without changing dummy timers', () => {
  const w = new World(false);
  w.tick = 3600 * 60;
  for (const team of ['blue', 'red'] as const) {
    const champion = w.spawn('champion', team, { x: 0, y: 0 });
    w.damage(w.hero, champion, 1e6, 'true');
    expect(champion.respawnTick).toBe(w.tick + 900);
  }
  const dummy = w.spawn('dummy', 'red', { x: 0, y: 0 });
  w.damage(w.hero, dummy, 1e6, 'true');
  expect(dummy.respawnTick).toBe(w.tick + 180);
});
