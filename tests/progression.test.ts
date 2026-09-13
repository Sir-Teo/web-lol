import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

test('level thresholds carry experience across multiple levels and cap at 18', () => {
  const world = new World(false);
  world.gainExperience(279);
  expect(world.player.level).toBe(1);
  world.gainExperience(1);
  expect(world.player.level).toBe(2);
  expect(world.player.xp).toBe(0);
  world.gainExperience(860);
  expect(world.player.level).toBe(4);
  expect(world.player.xp).toBe(0);
  world.gainExperience(1e6);
  expect(world.player.level).toBe(18);
  expect(world.player.xp).toBe(0);
  const before = world.snapshot();
  world.gainExperience(1000);
  expect(world.snapshot()).toBe(before);
  const invalid = JSON.parse(before);
  invalid.player.level = 19;
  expect(() => World.fromSnapshot(JSON.stringify(invalid), world.battlefield)).toThrow();
});

test('source growth produces fractional early stats and the full level-18 totals', () => {
  const w = new World(false);
  expect(w.hero.magicResist).toBe(33);
  w.gainExperience(280);
  expect(w.hero.maxHp).toBeCloseTo(682.72);
  expect(w.hero.maxMana).toBeCloseTo(305.2);
  expect(w.hero.damage).toBeCloseTo(61.52);
  expect(w.hero.armor).toBeCloseTo(29.312);
  expect(w.hero.magicResist).toBeCloseTo(33.792);
  w.gainExperience(1e6);
  expect(w.hero.maxHp).toBe(2327);
  expect(w.hero.maxMana).toBe(875);
  expect(w.hero.damage).toBe(118.5);
  expect(w.hero.armor).toBe(104.2);
  expect(w.hero.magicResist).toBe(51.7);
  expect(w.hero.attackPeriod).toBe(60);
  expect(w.hero.windupTicks).toBe(13);
});

test('leveling retains item bonuses and missing resources without reviving a dead hero', () => {
  const w = new World(false);
  expect(w.buy('blade')).toBeNull();
  w.hero.hp -= 100;
  w.hero.mana -= 50;
  w.gainExperience(280);
  expect(w.hero.maxHp).toBeCloseTo(762.72);
  expect(w.hero.damage).toBeCloseTo(71.52);
  expect(w.hero.maxHp - w.hero.hp).toBeCloseTo(100);
  expect(w.hero.maxMana - w.hero.mana).toBeCloseTo(50);
  w.damage(w.hero, w.hero, 1e6, 'true');
  const deadAt = w.hero.deadAt,
    respawnTick = w.hero.respawnTick;
  w.gainExperience(380);
  expect(w.player.level).toBe(3);
  expect(w.hero.hp).toBe(0);
  expect(w.hero.deadAt).toBe(deadAt);
  expect(w.hero.respawnTick).toBe(respawnTick);
});

test('regeneration grows with level outside the fountain and restoration preserves progression', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  w.gainExperience(1e6);
  Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 }, hp: 100, mana: 100 });
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(60);
  restored.step(60);
  expect(w.hero.hp).toBeCloseTo(102.57);
  expect(w.hero.mana).toBeCloseTo(103.61);
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('leveling leaves an already-scheduled attack cycle intact', () => {
  const w = new World(false);
  const target = w.spawn('dummy', 'red', { x: w.hero.x + 300, y: w.hero.y });
  w.enqueue({ type: 'order', unit: w.hero.id, order: { type: 'attack', target: target.id } });
  w.step();
  const cycle = { ...w.hero.attackCycle! },
    release = w.hero.releaseTick;
  w.gainExperience(1e6);
  expect(w.hero.attackCycle).toEqual(cycle);
  expect(w.hero.releaseTick).toBe(release);
  expect(w.hero.nextAttackTick).toBe(cycle.endTick);
});
