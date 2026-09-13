import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

function quietWorld() {
  const w = new World(false);
  w.nextWaveTick = Number.POSITIVE_INFINITY;
  w.units = [w.hero];
  return w;
}
function advance(w: World, ticks: number) {
  for (let i = 0; i < ticks; i++) w.step();
}

test('ambient income waits until 65 seconds, then accrues 20.4 gold per ten seconds', () => {
  const w = quietWorld();
  advance(w, 65 * 60);
  expect(w.player.gold).toBe(500);
  w.step();
  expect(w.player.gold).toBe(500.034);
  advance(w, 599);
  expect(w.player.gold).toBe(520.4);
  advance(w, 40 * 60);
  expect(w.player.gold).toBe(602);
});

test('fractional income survives a checkpoint without restarting the accrual phase', () => {
  const w = quietWorld();
  w.tick = 65 * 60;
  advance(w, 17);
  expect(w.player.gold).toBe(500.578);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  advance(w, 583);
  advance(restored, 583);
  expect(w.player.gold).toBe(520.4);
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('purchases require the full price and retain fractional change', () => {
  const w = quietWorld();
  w.tick = 65 * 60;
  w.player.gold = 449.99;
  expect(w.buy('blade')).toBe('Not enough gold');
  w.step();
  expect(w.buy('blade')).toBeNull();
  expect(w.player.gold).toBeCloseTo(0.024);
  advance(w, 599);
  expect(w.player.gold).toBe(20.39);
});

test('death permits ambient income but the completed match freezes it', () => {
  const w = quietWorld();
  w.tick = 65 * 60;
  w.hero.hp = 0;
  w.hero.deadAt = w.tick;
  w.hero.respawnTick = w.tick + 1000;
  advance(w, 300);
  expect(w.hero.hp).toBe(0);
  expect(w.player.gold).toBe(510.2);
  w.winner = 'blue';
  const before = w.snapshot();
  advance(w, 300);
  expect(w.snapshot()).toBe(before);
});

test('time jumps do not replay income for simulation steps that never ran', () => {
  const w = quietWorld();
  w.tick = 30 * 60 * 60;
  w.step();
  expect(w.player.gold).toBe(500.034);
});
