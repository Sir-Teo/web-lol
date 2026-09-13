import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

function cast() {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  w.enqueue({
    type: 'cast',
    unit: w.hero.id,
    ability: 'r',
    point: { x: w.hero.x + 10000, y: w.hero.y },
  });
  w.step();
  return w;
}

test('crystal arrow accelerates from 1500 to 2100 over three seconds then stays capped', () => {
  const w = cast();
  expect(w.projectiles[0].speed).toBeCloseTo(1500 + 200 / 60);
  w.step(59);
  expect(w.projectiles[0].speed).toBeCloseTo(1700);
  expect(w.projectiles[0].x - w.hero.x).toBeCloseTo(1600);
  w.step(120);
  expect(w.projectiles[0].speed).toBeCloseTo(2100);
  expect(w.projectiles[0].x - w.hero.x).toBeCloseTo(5400);
  w.step(60);
  expect(w.projectiles[0].speed).toBe(2100);
  expect(w.projectiles[0].x - w.hero.x).toBeCloseTo(7500);
  w.step(120);
  expect(w.projectiles).toHaveLength(1);
  expect(w.projectiles[0].x - w.hero.x).toBeCloseTo(11700);
  expect(w.projectiles[0].remaining).toBeCloseTo(13300);
  w.step(379);
  expect(w.projectiles).toHaveLength(1);
  expect(w.projectiles[0].remaining).toBeCloseTo(35);
  w.step(1);
  expect(w.projectiles).toHaveLength(0);
});

test('saved accelerating arrows continue identically through the speed cap', () => {
  const w = cast();
  w.step(88);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (let i = 0; i < 160; i++) {
    w.step();
    restored.step();
    expect(restored.snapshot()).toBe(w.snapshot());
  }
});

test('a saved cross-map arrow hits an enemy beyond the previous 10000-unit cutoff', () => {
  const w = cast();
  const target = w.spawn('dummy', 'red', { x: w.hero.x + 15000, y: w.hero.y });
  w.step(359);
  expect(w.projectiles[0].remaining).toBeCloseTo(13300);
  expect(target.hp).toBe(target.maxHp);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(100);
  restored.step(100);
  expect(target.hp).toBeLessThan(target.maxHp);
  expect(w.projectiles).toHaveLength(0);
  expect(restored.snapshot()).toBe(w.snapshot());
});
