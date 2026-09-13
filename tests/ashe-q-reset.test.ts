import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

function setup() {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const target = w.spawn('dummy', 'red', { x: w.hero.x + 600, y: w.hero.y });
  w.player.qStacks = 4;
  w.player.qStackExpiry = 240;
  w.setOrder(w.hero, { type: 'attack', target: target.id });
  w.step();
  return { w, target };
}
function cast(w: World) {
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
  w.step();
}

test('Q resets recovery immediately and preserves an already released arrow', () => {
  const { w, target } = setup();
  w.step(w.hero.releaseTick! - w.tick);
  const arrow = w.projectiles.find((p) => p.type === 'attack')!;
  const damage = arrow.damage;
  const previousEnd = w.hero.attackCycle!.endTick;
  expect(w.hero.releaseTick).toBeNull();
  cast(w);
  expect(w.tick).toBeLessThan(previousEnd);
  expect(w.hero.attackCycle).toEqual({ startTick: w.tick, endTick: w.tick + 76, empowered: true });
  expect(w.hero.releaseTick).toBe(w.tick + 17);
  expect(w.hero.order).toEqual({ type: 'attack', target: target.id });
  expect(w.projectiles.find((p) => p.id === arrow.id)?.damage).toBe(damage);
  expect(w.player.qStacks).toBe(0);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (let i = 0; i < 100; i++) {
    w.step();
    restored.step();
    expect(restored.snapshot()).toBe(w.snapshot());
  }
});

test('Q replaces an unreleased windup without firing the cancelled attack', () => {
  const { w } = setup();
  w.step(5);
  const previousRelease = w.hero.releaseTick!;
  cast(w);
  const resetRelease = w.hero.releaseTick!;
  expect(resetRelease).toBeGreaterThan(previousRelease);
  expect(w.hero.attackCycle!.startTick).toBe(w.tick);
  expect(w.hero.attackCycle!.empowered).toBe(true);
  expect(w.projectiles).toHaveLength(0);
  w.step(previousRelease - w.tick);
  expect(w.projectiles).toHaveLength(0);
  w.step(resetRelease - w.tick);
  expect(w.projectiles.filter((p) => p.type === 'attack')).toHaveLength(1);
  expect(w.events.filter((e) => e.type === 'attack')).toHaveLength(1);
});

test('a rejected Q preserves the scheduled windup and recovery', () => {
  for (const failure of ['focus', 'mana', 'cooldown', 'stun']) {
    const { w } = setup();
    if (failure === 'focus') w.player.qStacks = 3;
    if (failure === 'mana') w.hero.mana = 0;
    if (failure === 'cooldown') w.player.cooldowns.q = 100;
    // Stun itself interrupts attacks; compare with the same world without Q.
    if (failure === 'stun') w.hero.stunUntil = 100;
    const baseline = World.fromSnapshot(w.snapshot(), w.battlefield);
    cast(w);
    baseline.step();
    expect(w.hero.attackCycle).toEqual(baseline.hero.attackCycle);
    expect(w.hero.releaseTick).toBe(baseline.hero.releaseTick);
    expect(w.hero.nextAttackTick).toBe(baseline.hero.nextAttackTick);
    expect(w.player.qUntil).toBe(0);
  }
});

test('Q preserves movement and does not force an attack from idle', () => {
  for (const moving of [false, true]) {
    const w = new World(false);
    w.nextWaveTick = Infinity;
    w.player.qStacks = 4;
    w.player.qStackExpiry = 240;
    if (moving) w.setOrder(w.hero, { type: 'move', point: { x: w.hero.x + 300, y: w.hero.y } });
    w.step();
    const order = structuredClone(w.hero.order);
    const before = { x: w.hero.x, y: w.hero.y };
    cast(w);
    expect(w.hero.order).toEqual(order);
    expect(w.hero.attackCycle).toBeNull();
    expect(w.hero.releaseTick).toBeNull();
    expect(w.hero.nextAttackTick).toBe(w.tick);
    expect(w.hero.x !== before.x || w.hero.y !== before.y).toBe(moving);
  }
});
