import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

test('Q lasts six seconds and saved continuation preserves its exact expiry', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  w.player.qStacks = 4;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
  w.step();
  expect(w.player.qUntil).toBe(361);
  expect(w.player.qStacks).toBe(0);
  w.step(240);
  expect(w.attackSpeedMultiplier(w.hero, undefined)).toBe(1.4);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step(119);
    expect(world.attackSpeedMultiplier(world.hero, undefined)).toBe(1.4);
    world.step();
    expect(world.attackSpeedMultiplier(world.hero, undefined)).toBe(1);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
});
