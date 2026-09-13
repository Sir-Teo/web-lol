import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

function setup() {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const target = w.spawn('champion', 'red', { x: w.hero.x + 400, y: w.hero.y });
  const other = w.spawn('champion', 'blue', { x: w.hero.x, y: w.hero.y });
  const lux = w.spawn('champion', 'blue', { x: w.hero.x, y: w.hero.y }, 'lux');
  target.stunUntil = Infinity;
  return { w, target, other, lux };
}

test('stronger slow expires independently and reveals the still-active weaker slow after save/load', () => {
  const { w, target, lux } = setup();
  w.applySlow(lux, target, 'lucent', 120, 0.7);
  w.applySlow(w.hero, target, 'frost', 30, 0.5);
  expect(w.slowFactor(target)).toBe(0.5);
  const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, saved]) {
    world.step(30);
    expect(world.slowFactor(world.unit(target.id)!)).toBe(0.7);
    expect(world.unit(target.id)!.slows).toHaveLength(1);
    world.step(90);
    expect(world.movementSpeed(world.unit(target.id)!)).toBe(target.speed);
    expect(world.unit(target.id)!.slows).toEqual([]);
  }
  expect(saved.snapshot()).toBe(w.snapshot());
});

test('critical decay competes with constant slows without multiplying them', () => {
  const { w, target, lux } = setup();
  w.applySlow(lux, target, 'lucent', 120, 0.6);
  w.applySlow(w.hero, target, 'critical-frost', 60, 0.4, 0.7);
  expect(w.slowFactor(target)).toBe(0.4);
  w.step(30);
  expect(w.slowFactor(target)).toBeCloseTo(0.55);
  w.step(20);
  expect(w.slowFactor(target)).toBe(0.6);
  w.step(10);
  expect(w.slowFactor(target)).toBe(0.6);
});

test('refresh is scoped to source and effect; caster death preserves an applied slow', () => {
  const { w, target, other } = setup();
  w.applySlow(w.hero, target, 'frost', 60, 0.7);
  w.applySlow(other, target, 'frost', 90, 0.8);
  w.step(20);
  w.applySlow(w.hero, target, 'frost', 60, 0.7);
  expect(target.slows).toHaveLength(2);
  w.damage(target, w.hero, 10000, 'true');
  w.step(60);
  expect(w.slowFactor(target)).toBe(0.8);
  w.damage(other, target, 10000, 'true');
  expect(target.slows).toEqual([]);
});

test('a lower-level Ashe Volley cannot erase another Ashes stronger critical slow', () => {
  const { w, target, other } = setup();
  w.gainExperience(1e6);
  target.hp = target.maxHp = 10000;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: target });
  while (!target.criticalSlow && w.tick < 60) w.step();
  expect(w.slowFactor(target)).toBeCloseTo(0.4);
  w.enqueue({ type: 'cast', unit: other.id, ability: 'w', point: target });
  while (!target.slows.some((s) => s.sourceId === other.id) && w.tick < 100) w.step();
  expect(target.criticalSlow!.startMultiplier).toBeCloseTo(0.6);
  expect(w.slowFactor(target)).toBeLessThan(0.6);
  expect(target.slows).toHaveLength(4);
  const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, saved]) world.step(150);
  expect(saved.snapshot()).toBe(w.snapshot());
  expect(w.slowFactor(target)).toBe(1);
});

test('slow API rejects invalid recipients, owners, ranges and deadlines', () => {
  const { w, target, lux } = setup();
  expect(w.applySlow(lux, target, 'frost', 60, 0.7)).toBe(false);
  expect(w.applySlow(w.hero, w.hero, 'frost', 60, 0.7)).toBe(false);
  expect(w.applySlow(w.hero, { ...target }, 'frost', 60, 0.7)).toBe(false);
  for (const duration of [0, -1, 0.5, Infinity, NaN])
    expect(w.applySlow(w.hero, target, 'frost', duration, 0.7)).toBe(false);
  for (const value of [-1, 1, Infinity, NaN])
    expect(w.applySlow(w.hero, target, 'frost', 60, value)).toBe(false);
  expect(w.applySlow(w.hero, target, 'frost', 60, 0.8, 0.7)).toBe(false);
  expect(target.slows).toEqual([]);
});

test('saved slows reject duplicate identity, crossed champion ownership, future starts and expired effects', () => {
  const { w, target, lux } = setup();
  w.applySlow(w.hero, target, 'frost', 60, 0.7);
  const valid = w.snapshot();
  for (const mutate of [
    (unit: typeof target) => {
      unit.slows.push({ ...unit.slows[0] });
    },
    (unit: typeof target) => {
      unit.slows[0].sourceId = lux.id;
    },
    (unit: typeof target) => {
      unit.slows[0].startTick = 1;
    },
    (unit: typeof target) => {
      unit.slows[0].endTick = 0;
    },
  ]) {
    const restored = World.fromSnapshot(valid, w.battlefield);
    mutate(restored.unit(target.id)!);
    expect(() => World.fromSnapshot(restored.snapshot(), w.battlefield)).toThrow();
  }
});
