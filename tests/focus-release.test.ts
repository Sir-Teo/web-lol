import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

function setup() {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const target = w.spawn('dummy', 'red', { x: w.hero.x + 550, y: w.hero.y });
  w.setOrder(w.hero, { type: 'attack', target: target.id });
  w.step();
  return { w, target, release: w.hero.releaseTick! };
}

test('Focus arrives on release before impact, and impact neither adds nor refreshes it', () => {
  const { w, target, release } = setup();
  w.step(release - w.tick - 1);
  expect(w.player.qStacks).toBe(0);
  w.step();
  expect(w.projectiles).toHaveLength(1);
  expect(target.hp).toBe(target.maxHp);
  expect(w.player.qStacks).toBe(1);
  expect(w.player.qStackExpiry).toBe(release + 240);
  w.setOrder(w.hero, { type: 'idle' });
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(60);
  restored.step(60);
  expect(target.hp).toBeLessThan(target.maxHp);
  expect(w.player.qStacks).toBe(1);
  expect(w.player.qStackExpiry).toBe(release + 240);
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('canceled windups and a target lost before release grant no Focus', () => {
  for (const cause of ['cancel', 'target-death', 'stun', 'death']) {
    const { w, target, release } = setup();
    if (cause === 'cancel') w.setOrder(w.hero, { type: 'idle' });
    if (cause === 'target-death') w.damage(w.hero, target, 1e6, 'true');
    if (cause === 'stun') w.hero.stunUntil = release + 60;
    if (cause === 'death') w.damage(target, w.hero, 1e6, 'true');
    w.step(release - w.tick + 1);
    expect(w.player.qStacks).toBe(0);
    expect(w.projectiles).toHaveLength(0);
  }
});

test('the fourth released arrow unlocks Q before reaching its target', () => {
  const { w, target, release } = setup();
  w.player.qStacks = 3;
  w.player.qStackExpiry = 240;
  w.step(release - w.tick);
  expect(w.player.qStacks).toBe(4);
  expect(target.hp).toBe(target.maxHp);
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
  w.step();
  expect(w.player.qUntil).toBe(w.tick + 360);
  expect(w.player.qStacks).toBe(0);
  w.setOrder(w.hero, { type: 'idle' });
  w.step(60);
  expect(w.player.qStacks).toBe(0);
});
