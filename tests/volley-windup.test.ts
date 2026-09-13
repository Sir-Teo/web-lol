import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

function start() {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const origin = { x: w.hero.x, y: w.hero.y };
  w.enqueue({
    type: 'cast',
    unit: w.hero.id,
    ability: 'w',
    point: { x: origin.x + 1200, y: origin.y },
  });
  w.step();
  return { w, origin };
}

test('Volley locks movement until release, pays once and resumes a deferred order', () => {
  const { w, origin } = start();
  const mana = w.hero.mana,
    cooldown = w.player.cooldowns.w;
  expect(w.player.pendingCast!.releaseTick).toBe(16);
  expect(w.projectiles).toHaveLength(0);
  w.enqueue({
    type: 'order',
    unit: w.hero.id,
    order: { type: 'move', point: { x: origin.x, y: origin.y + 200 } },
  });
  w.step(14);
  expect({ x: w.hero.x, y: w.hero.y }).toEqual(origin);
  expect(w.projectiles).toHaveLength(0);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step();
    expect(world.player.pendingCast).toBeNull();
    expect(world.projectiles).toHaveLength(7);
    expect(world.projectiles[3].previous).toEqual(origin);
    expect(world.projectiles[3].direction).toEqual({ x: 1, y: 0 });
    expect(world.projectiles[3].remaining).toBe(1175);
    expect(world.hero.y).not.toBe(origin.y);
    expect(world.hero.mana).toBeGreaterThanOrEqual(mana);
    expect(world.player.cooldowns.w).toBe(cooldown);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('Volley replaces an attack windup and survives stun, but death cancels release', () => {
  for (const dying of [false, true]) {
    const w = new World(false);
    w.nextWaveTick = Infinity;
    const target = w.spawn('dummy', 'red', { x: w.hero.x + 600, y: w.hero.y });
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.step();
    expect(w.hero.releaseTick).not.toBeNull();
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: target });
    w.step();
    expect(w.hero.releaseTick).toBeNull();
    expect(w.hero.attackCycle).toBeNull();
    if (dying) w.damage(target, w.hero, 1e6, 'true');
    else w.hero.stunUntil = 100;
    w.step(15);
    expect(w.projectiles.filter((p) => p.type === 'volley')).toHaveLength(dying ? 0 : 7);
    expect(w.projectiles.some((p) => p.type === 'attack')).toBe(false);
    expect(w.player.pendingCast).toBeNull();
  }
});

test('pending Volley rejects additional ability casts and recall while allowing Heal', () => {
  const { w } = start();
  const pending = structuredClone(w.player.pendingCast);
  w.player.qStacks = 4;
  w.player.qStackExpiry = 240;
  w.hero.hp = 100;
  for (const ability of ['q', 'w', 'e', 'r', 'd', 'f'] as const)
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability,
      point: { x: w.hero.x + 100, y: w.hero.y },
    });
  w.enqueue({ type: 'recall', unit: w.hero.id });
  w.step();
  expect(w.player.pendingCast).toEqual(pending);
  expect(w.player.recallEnd).toBeNull();
  expect(w.hero.hp).toBeGreaterThan(100);
  expect(w.player.cooldowns.f).toBeGreaterThan(0);
  for (const ability of ['q', 'e', 'r', 'd'] as const) expect(w.player.cooldowns[ability]).toBe(0);
});

test('pending cast snapshots reject wrong duration, future starts and expired release', () => {
  const { w } = start();
  for (const patch of [
    { releaseTick: 15 },
    { startTick: 2, releaseTick: 17 },
    { startTick: 0, releaseTick: 15, ability: 'r' },
  ]) {
    const saved = JSON.parse(w.snapshot());
    Object.assign(saved.player.pendingCast, patch);
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
  }
  const saved = JSON.parse(w.snapshot());
  saved.tick = 16;
  expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
});
