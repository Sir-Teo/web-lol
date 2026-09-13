import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

function release(empowered: boolean) {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const target = w.spawn('dummy', 'red', { x: w.hero.x + 550, y: w.hero.y });
  target.armor = 100;
  if (empowered) w.player.qUntil = 360;
  w.setOrder(w.hero, { type: 'attack', target: target.id });
  for (let i = 0; i < 60 && !w.projectiles.length; i++) w.step();
  expect(w.projectiles).toHaveLength(1);
  w.setOrder(w.hero, { type: 'idle' });
  return { w, target };
}

test('rank-one Q captures 110% attack damage and applies armor once at impact', () => {
  for (const empowered of [false, true]) {
    const { w, target } = release(empowered);
    const raw = 59 * (empowered ? 1.1 : 1);
    expect(w.projectiles[0].damage).toBeCloseTo(raw);
    const hp = target.hp;
    w.step(60);
    expect(hp - target.hp).toBeCloseTo(raw / 2);
  }
});

test('Q damage survives expiry, changed AD, death and checkpoint restoration in flight', () => {
  const { w, target } = release(true);
  w.player.qUntil = w.tick;
  w.hero.damage = 500;
  w.damage(target, w.hero, 1e6, 'true');
  const hp = target.hp;
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(60);
  restored.step(60);
  expect(hp - target.hp).toBeCloseTo(32.45);
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('activating Q after release does not empower an ordinary arrow already in flight', () => {
  const { w, target } = release(false);
  w.player.qUntil = w.tick + 360;
  const hp = target.hp;
  w.step(60);
  expect(hp - target.hp).toBeCloseTo(29.5);
});
