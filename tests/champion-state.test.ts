import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { ASHE_E } from '../src/content/ashe-e';
import { TICK_RATE, ITEMS } from '../src/content/rules';

function champions() {
  const world = new World(false, PRACTICE_FIXTURE);
  world.nextWaveTick = Infinity;
  const enemy = world.spawn('champion', 'red', { x: 1000, y: -750 });
  const ally = world.spawn('champion', 'blue', { x: 500, y: -750 });
  return { world, enemy, ally };
}

test('champion state has unique mutable ownership and preserves the human view', () => {
  const { world, enemy, ally } = champions();
  const red = world.championState(enemy.id)!,
    blue = world.championState(ally.id)!;
  expect(world.championState(world.hero.id)).toBe(world.player);
  red.cooldowns.w = 80;
  red.inventory.push(ITEMS[0].id);
  red.gold = 0;
  red.qStacks = 3;
  expect(blue.cooldowns.w).toBe(0);
  expect(world.player.cooldowns.w).toBe(0);
  expect(blue.inventory).toEqual([]);
  expect(world.player.inventory).toEqual([]);
  expect(blue.gold).toBe(500);
  expect(world.player.gold).toBe(500);
  expect(world.championState(world.spawn('melee', 'red', { x: 0, y: 0 }).id)).toBeUndefined();
});

test('each champion recharges and loses Focus on its own deadlines, including through death', () => {
  const { world, enemy, ally } = champions();
  const red = world.championState(enemy.id)!,
    blue = world.championState(ally.id)!;
  red.eCharges = 0;
  red.eRechargeTick = 2;
  red.qStacks = 3;
  red.qStackExpiry = 2;
  blue.eCharges = 1;
  blue.eRechargeTick = 4;
  blue.qStacks = 2;
  blue.qStackExpiry = 4;
  enemy.hp = 0;
  enemy.deadAt = 0;
  enemy.respawnTick = 100000;
  world.step(2);
  expect(red.eCharges).toBe(1);
  expect(red.eRechargeTick).toBe(2 + ASHE_E.rechargeSecondsByRank[0] * TICK_RATE);
  expect(red.qStacks).toBe(2);
  expect(blue.eCharges).toBe(1);
  expect(blue.qStacks).toBe(2);
  expect(world.player.eCharges).toBe(ASHE_E.maximumCharges);
  world.step(2);
  expect(blue.eCharges).toBe(2);
  expect(blue.eRechargeTick).toBeNull();
  expect(blue.qStacks).toBe(1);
});

test('multiple champion resource timelines restore without sharing records or replaying events', () => {
  const { world, enemy, ally } = champions();
  const red = world.championState(enemy.id)!,
    blue = world.championState(ally.id)!;
  red.eCharges = 0;
  red.eRechargeTick = 30;
  red.qStacks = 4;
  red.qStackExpiry = 60;
  blue.eCharges = 1;
  blue.eRechargeTick = 40;
  blue.cooldowns.r = 1000;
  world.step(15);
  const restored = World.fromSnapshot(world.snapshot(), world.battlefield);
  expect(restored.championState(restored.hero.id)).toBe(restored.player);
  expect(restored.championState(enemy.id)).not.toBe(red);
  expect(restored.events).toEqual([]);
  for (let i = 0; i < 240; i++) {
    world.step();
    restored.step();
    expect(restored.snapshot()).toBe(world.snapshot());
  }
});

test('saved champion ownership rejects missing, duplicate, foreign, and malformed records', () => {
  const { world, enemy } = champions();
  const mutations = [
    (s: any) => s.otherChampions.pop(),
    (s: any) => s.otherChampions.push({ ...s.otherChampions[0] }),
    (s: any) => (s.otherChampions[0].id = s.player.id),
    (s: any) => (s.otherChampions[0].id = 999999),
    (s: any) => (s.otherChampions[0].eCharges = 99),
    (s: any) => (s.otherChampions[0].cooldowns.w = -1),
    (s: any) => (s.version = 24),
  ];
  for (const mutate of mutations) {
    const s = JSON.parse(world.snapshot());
    mutate(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), world.battlefield)).toThrow();
  }
  world.units = world.units.filter((u) => u.id !== enemy.id);
  expect(world.championState(enemy.id)).toBeUndefined();
  expect(JSON.parse(world.snapshot()).otherChampions).toHaveLength(1);
});

test('cast chronology checks apply to nonhuman owners too', () => {
  const { world } = champions();
  const s = JSON.parse(world.snapshot());
  s.otherChampions[0].castAnimation = { ability: 'w', startTick: 1 };
  expect(() => World.fromSnapshot(JSON.stringify(s), world.battlefield)).toThrow(/cast animation/);
});
