import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

test('rank-one Q adds the same ratio-scaled attack speed at early and late levels', () => {
  for (const level of [1, 18]) {
    const w = new World(false);
    w.nextWaveTick = Infinity;
    if (level === 18) w.gainExperience(1e6);
    w.player.qUntil = 360;
    const base = 60 / w.hero.attackPeriod;
    const effective = base * w.attackSpeedMultiplier(w.hero, undefined);
    expect(effective - base).toBeCloseTo(0.1316);
    const target = w.spawn('dummy', 'red', { x: w.hero.x + 300, y: w.hero.y });
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.step();
    expect(w.hero.attackCycle!.endTick - w.hero.attackCycle!.startTick).toBe(level === 1 ? 76 : 53);
    const other = w.spawn('champion', 'blue', { x: 0, y: 0 });
    expect(w.attackSpeedMultiplier(other, undefined)).toBe(1);
  }
});

test('Focus decays one stack per second after its four-second lifetime, including saved continuation', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  w.player.qStacks = 4;
  w.player.qStackExpiry = 240;
  w.step(239);
  expect(w.player.qStacks).toBe(4);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step();
    expect(world.player.qStacks).toBe(3);
    expect(world.player.qStackExpiry).toBe(300);
    world.step(59);
    expect(world.player.qStacks).toBe(3);
    world.step();
    expect(world.player.qStacks).toBe(2);
    world.step(60);
    expect(world.player.qStacks).toBe(1);
    world.step(60);
    expect(world.player.qStacks).toBe(0);
    expect(world.player.qStackExpiry).toBe(0);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('attacks during active Q deal damage without rebuilding Focus', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const target = w.spawn('dummy', 'red', { x: w.hero.x + 300, y: w.hero.y });
  w.player.qStacks = 4;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
  w.step();
  w.setOrder(w.hero, { type: 'attack', target: target.id });
  w.step(240);
  expect(target.hp).toBeLessThan(target.maxHp);
  expect(w.player.qStacks).toBe(0);
  expect(w.player.qStackExpiry).toBe(0);
});

test('a new attack refreshes the remaining Focus stack lifetime', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const target = w.spawn('dummy', 'red', { x: w.hero.x + 300, y: w.hero.y });
  w.player.qStacks = 4;
  w.player.qStackExpiry = 240;
  w.step(240);
  expect(w.player.qStacks).toBe(3);
  w.setOrder(w.hero, { type: 'attack', target: target.id });
  for (let i = 0; i < 60 && w.player.qStacks < 4; i++) w.step();
  expect(w.player.qStacks).toBe(4);
  expect(w.player.qStackExpiry).toBe(w.tick + 240);
  w.setOrder(w.hero, { type: 'idle' });
  w.step(239);
  expect(w.player.qStacks).toBe(4);
  w.step();
  expect(w.player.qStacks).toBe(3);
});

test('Q lasts six seconds and saved continuation preserves its exact expiry', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  w.player.qStacks = 4;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
  w.step();
  expect(w.player.qUntil).toBe(361);
  expect(w.player.qStacks).toBe(0);
  w.step(240);
  expect((60 / w.hero.attackPeriod) * (w.attackSpeedMultiplier(w.hero, undefined) - 1)).toBeCloseTo(
    0.1316
  );
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step(119);
    expect(
      (60 / world.hero.attackPeriod) * (world.attackSpeedMultiplier(world.hero, undefined) - 1)
    ).toBeCloseTo(0.1316);
    world.step();
    expect(world.attackSpeedMultiplier(world.hero, undefined)).toBe(1);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
});
