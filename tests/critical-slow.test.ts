import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

function volley(level = 1) {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  if (level === 18) w.gainExperience(1e6);
  const target = w.spawn('champion', 'red', { x: w.hero.x + 400, y: w.hero.y });
  target.stunUntil = Infinity;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: target });
  for (let i = 0; i < 60 && !target.criticalSlow; i++) w.step();
  return { w, target };
}

test('Volley champion slow decays from doubled strength over one second then expires at two', () => {
  for (const level of [1, 18]) {
    const { w, target } = volley(level);
    const base = level === 1 ? 0.8 : 0.7,
      peak = level === 1 ? 0.6 : 0.4;
    expect(w.movementSpeed(target)).toBeCloseTo(target.speed * peak);
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, restored]) {
      const victim = world.unit(target.id)!;
      world.step(30);
      expect(world.movementSpeed(victim)).toBeCloseTo((victim.speed * (base + peak)) / 2);
      world.step(30);
      expect(world.movementSpeed(victim)).toBeCloseTo(victim.speed * base);
      world.step(60);
      expect(world.movementSpeed(victim)).toBe(victim.speed);
    }
    expect(restored.snapshot()).toBe(w.snapshot());
  }
});

test('a subsequent basic attack refreshes normal Frost without erasing critical decay', () => {
  const { w, target } = volley();
  const effect = { ...target.criticalSlow! };
  w.setOrder(w.hero, { type: 'attack', target: target.id });
  for (let i = 0; i < 50 && target.slowUntil === effect.startTick + 120; i++) w.step();
  w.setOrder(w.hero, { type: 'idle' });
  expect(target.slowUntil).toBeGreaterThan(effect.startTick + 120);
  expect(target.criticalSlow).toEqual(effect);
  expect(w.movementSpeed(target)).toBeLessThan(target.speed * 0.8);
});

test('snapshots reject reversed critical-slow time and strength bounds', () => {
  const { w, target } = volley();
  for (const change of [{ endTick: 0 }, { startMultiplier: 0.9 }, { endMultiplier: 1.1 }]) {
    const saved = JSON.parse(w.snapshot());
    Object.assign(saved.units.find((u: { id: number }) => u.id === target.id).criticalSlow, change);
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
  }
});
