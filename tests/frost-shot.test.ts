import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

function hit(level: number) {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  for (let next = 2; next <= level; next++) w.gainExperience(280 + (next - 2) * 100);
  const target = w.spawn('dummy', 'red', { x: w.hero.x + 400, y: w.hero.y });
  target.speed = 325;
  w.setOrder(w.hero, { type: 'attack', target: target.id });
  for (let i = 0; i < 100 && !target.slowUntil; i++) w.step();
  w.setOrder(w.hero, { type: 'idle' });
  return { w, target };
}

test('basic Frost Shot scales with attacker level and applies a two-second deadline', () => {
  for (const level of [1, 9, 18]) {
    const { w, target } = hit(level);
    const multiplier = 0.8 - ((level - 1) / 17) * 0.1;
    expect(target.slowMultiplier).toBeCloseTo(multiplier);
    expect(target.slowUntil).toBe(w.tick + 120);
    expect(w.movementSpeed(target)).toBeCloseTo(target.speed * multiplier);
  }
});

test('a saved slow keeps its impact strength through attacker leveling and expires exactly', () => {
  const { w, target } = hit(1);
  w.gainExperience(1e6);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    const victim = world.unit(target.id)!;
    world.step(119);
    expect(world.movementSpeed(victim)).toBeCloseTo(victim.speed * 0.8);
    world.step();
    expect(world.movementSpeed(victim)).toBe(victim.speed);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('snapshot rejects missing or out-of-range slow multipliers', () => {
  const { w, target } = hit(1);
  for (const value of [-0.1, 1.1, null, undefined]) {
    const saved = JSON.parse(w.snapshot());
    saved.units.find((unit: { id: number }) => unit.id === target.id).slowMultiplier = value;
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
  }
});
