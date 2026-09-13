import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

test('death clears Focus and active Q without resetting cooldowns or inventory', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  w.buy('blade');
  w.player.qStacks = 4;
  w.player.qStackExpiry = 240;
  w.player.qUntil = 240;
  w.player.cooldowns.w = 500;
  const killer = w.spawn('dummy', 'red', { x: 0, y: 0 });
  w.damage(killer, w.hero, 1e6, 'true');
  expect(w.player.qStacks).toBe(0);
  expect(w.player.qStackExpiry).toBe(0);
  expect(w.player.qUntil).toBe(0);
  expect(w.player.cooldowns.w).toBe(500);
  expect(w.player.inventory).toEqual(['blade']);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.tick = world.hero.respawnTick! - 1;
    world.step();
    expect(world.hero.hp).toBe(world.hero.maxHp);
    expect(world.player.qStacks).toBe(0);
    expect(world.player.qUntil).toBe(0);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('an arrow released before death still damages its target without granting posthumous Focus', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const target = w.spawn('dummy', 'red', { x: w.hero.x + 550, y: w.hero.y });
  w.setOrder(w.hero, { type: 'attack', target: target.id });
  for (let i = 0; i < 60 && w.projectiles.length === 0; i++) w.step();
  expect(w.projectiles).toHaveLength(1);
  const hp = target.hp;
  w.damage(target, w.hero, 1e6, 'true');
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(60);
  restored.step(60);
  expect(target.hp).toBeLessThan(hp);
  expect(w.hero.hp).toBe(0);
  expect(w.player.qStacks).toBe(0);
  expect(w.player.qStackExpiry).toBe(0);
  expect(w.projectiles).toHaveLength(0);
  expect(restored.snapshot()).toBe(w.snapshot());
});
