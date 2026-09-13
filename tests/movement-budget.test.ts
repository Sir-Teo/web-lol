import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import type { Vec2 } from '../src/simulation/math';

function moving(path: Vec2[]) {
  const world = new World(false, {
    ...PRACTICE_FIXTURE,
    findPath: () => path.map((p) => ({ ...p })),
  });
  world.nextWaveTick = Infinity;
  Object.assign(world.hero, { x: 0, y: 0, previous: { x: 0, y: 0 }, speed: 600 });
  world.enqueue({
    type: 'order',
    unit: world.hero.id,
    order: { type: 'move', point: path.at(-1)! },
  });
  return world;
}

test('movement retains a tick’s distance across zero-length, short and turning path segments', () => {
  const world = moving([
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 4 },
    { x: 100, y: 4 },
  ]);
  world.step();
  expect(world.hero.x).toBeCloseTo(6);
  expect(world.hero.y).toBe(4);
  expect(world.hero.previous).toEqual({ x: 0, y: 0 });
  expect(world.hero.path).toEqual([{ x: 100, y: 4 }]);
  world.step();
  expect(world.hero.x).toBeCloseTo(16);
});

test('equivalent straight paths travel equally despite different waypoint density', () => {
  const sparse = moving([{ x: 100, y: 0 }]);
  const dense = moving(Array.from({ length: 101 }, (_, x) => ({ x, y: 0 })));
  for (let tick = 0; tick < 10; tick++) {
    sparse.step();
    dense.step();
    expect(dense.hero.x).toBeCloseTo(sparse.hero.x);
  }
  expect(dense.hero.x).toBe(100);
  expect(dense.hero.path).toHaveLength(0);
});

test('movement stops at its reachable endpoint instead of spending the leftover distance beyond it', () => {
  const world = moving([
    { x: 3, y: 0 },
    { x: 3, y: 4 },
  ]);
  world.step();
  expect(world.hero.x).toBe(3);
  expect(world.hero.y).toBe(4);
  expect(world.hero.order.type).toBe('idle');
  world.step();
  expect(world.hero.x).toBe(3);
  expect(world.hero.y).toBe(4);
});

test('effective speed composes slow and haste and expires them at their exact deadlines', () => {
  const world = moving([{ x: 1000, y: 0 }]);
  world.hero.slowUntil = 2;
  world.healSpeedEnd = 3;
  world.step();
  expect(world.hero.x).toBeCloseTo(9.1);
  world.step();
  expect(world.hero.x).toBeCloseTo(22.1);
  world.step();
  expect(world.hero.x).toBeCloseTo(32.1);
});
