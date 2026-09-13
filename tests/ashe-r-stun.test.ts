import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

function castAt(travel: number) {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const target = w.spawn('dummy', 'red', { x: w.hero.x + travel + 100, y: w.hero.y });
  target.radius = 35; // Arrow radius 65: first contact after exactly `travel`.
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', point: target });
  return { w, target };
}

test('R stun scales from actual swept travel, with an 800-unit floor and 2800-unit cap', () => {
  for (const [distance, ticks] of [
    [0, 60],
    [800, 60],
    [800.01, 61],
    [1600, 120],
    [2800, 210],
    [5000, 210],
  ]) {
    const { w, target } = castAt(distance);
    for (let i = 0; i < 400 && target.stunUntil === 0; i++) w.step();
    expect(target.stunUntil - w.tick).toBe(ticks);
  }
});

test('caster movement does not change flight distance and a saved stun expires on its deadline', () => {
  const { w, target } = castAt(1600);
  w.step();
  w.hero.x -= 5000;
  w.hero.previous = { x: w.hero.x, y: w.hero.y };
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    const victim = world.unit(target.id)!;
    for (let i = 0; i < 100 && victim.stunUntil === 0; i++) world.step();
    expect(victim.stunUntil - world.tick).toBe(120);
    world.step(119);
    expect(victim.stunUntil > world.tick).toBe(true);
    world.step();
    expect(victim.stunUntil > world.tick).toBe(false);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
});
