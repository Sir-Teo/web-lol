import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

function attacking() {
  const world = new World(false);
  world.nextWaveTick = Infinity;
  const target = world.spawn('dummy', 'red', { x: world.hero.x + 300, y: world.hero.y });
  world.player.qUntil = 2;
  world.enqueue({
    type: 'order',
    unit: world.hero.id,
    order: { type: 'attack', target: target.id },
  });
  world.step();
  return { world, target };
}

test('scheduled attack cycle survives buff expiry, baseline changes and checkpoint restoration', () => {
  const { world } = attacking();
  expect(world.hero.attackCycle).toEqual({ startTick: 1, endTick: 77 });
  world.step(5);
  world.hero.attackPeriod = 120;
  expect(world.hero.attackCycle).toEqual({ startTick: 1, endTick: 77 });
  const restored = World.fromSnapshot(world.snapshot(), world.battlefield);
  expect(restored.hero.attackCycle).toEqual(world.hero.attackCycle);
  for (let i = 0; i < 150; i++) {
    world.step();
    restored.step();
    expect(restored.snapshot()).toBe(world.snapshot());
  }
});

test('cancel, stun, invalid target and death clear the scheduled attack presentation', () => {
  for (const cause of ['cancel', 'stun', 'target-death', 'death'] as const) {
    const { world, target } = attacking();
    if (cause === 'cancel') world.setOrder(world.hero, { type: 'idle' });
    if (cause === 'stun') world.hero.stunUntil = 100;
    if (cause === 'target-death') world.damage(world.hero, target, 1e6, 'true');
    if (cause === 'death') world.damage(target, world.hero, 1e6, 'true');
    world.step();
    expect(world.hero.attackCycle).toBeNull();
  }
});

test('snapshot decoder rejects reversed and zero-duration attack cycles', () => {
  const { world } = attacking();
  for (const endTick of [0, 1]) {
    const saved = JSON.parse(world.snapshot());
    saved.units.find((u: { id: number }) => u.id === world.hero.id).attackCycle.endTick = endTick;
    expect(() => World.fromSnapshot(JSON.stringify(saved), world.battlefield)).toThrow();
  }
});
