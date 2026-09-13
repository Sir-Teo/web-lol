import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

function setup() {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const point = { x: w.hero.x + 550, y: w.hero.y };
  const primary = w.spawn('dummy', 'red', point);
  primary.magicResist = 0;
  const edge = w.spawn('dummy', 'red', { x: point.x, y: point.y + 400 });
  edge.magicResist = 100;
  const outside = w.spawn('dummy', 'red', { x: point.x, y: point.y - 400.01 });
  const ally = w.spawn('dummy', 'blue', { x: point.x, y: point.y + 200 });
  const structure = w.spawn('turret', 'red', { x: point.x, y: point.y - 200 });
  structure.stunUntil = Infinity;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', point });
  return { w, primary, edge, outside, ally, structure };
}

test('R splash damages and slows the inclusive radius without duplicating the primary hit', () => {
  const { w, primary, edge, outside, ally, structure } = setup();
  for (let i = 0; i < 60 && primary.hp === primary.maxHp; i++) w.step();
  expect(primary.maxHp - primary.hp).toBe(200);
  expect(edge.maxHp - edge.hp).toBe(100);
  expect(edge.slowMultiplier).toBeCloseTo(0.8);
  expect(edge.slowUntil).toBe(w.tick + 120);
  expect(edge.stunUntil).toBe(0);
  expect(primary.stunUntil).toBe(w.tick + 120);
  for (const excluded of [outside, ally, structure]) {
    expect(excluded.hp).toBe(excluded.maxHp);
    expect(excluded.slowUntil).toBe(0);
  }
});

test('lethal primary impact still splashes minions and restores identically before contact', () => {
  const { w, primary, edge } = setup();
  primary.hp = 1;
  const minion = w.spawn('melee', 'red', { x: primary.x, y: primary.y + 300 });
  minion.magicResist = 0;
  minion.stunUntil = Infinity;
  w.step();
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(30);
  restored.step(30);
  expect(primary.hp).toBe(0);
  expect(edge.maxHp - edge.hp).toBe(100);
  expect(
    w.events.some(
      (event) => event.type === 'damage' && event.unit === minion.id && event.value === 200
    )
  ).toBe(true);
  expect(minion.slowMultiplier).toBeCloseTo(0.8);
  expect(restored.snapshot()).toBe(w.snapshot());
});
