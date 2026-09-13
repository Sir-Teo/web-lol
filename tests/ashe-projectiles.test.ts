import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

test('ordinary and empowered arrows travel at source speed and hit on the expected tick', () => {
  for (const empowered of [false, true]) {
    const w = new World(false);
    w.nextWaveTick = Infinity;
    const target = w.spawn('dummy', 'red', { x: w.hero.x + 550, y: w.hero.y });
    if (empowered) w.player.qUntil = 360;
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.step();
    const release = w.hero.releaseTick!;
    w.step(release - w.tick);
    const arrow = w.projectiles[0];
    expect(arrow.speed).toBe(2500);
    expect(arrow.x - w.hero.x).toBeCloseTo(2500 / 60);
    const travelTicks = Math.ceil((550 - target.radius - arrow.radius) / (2500 / 60));
    w.setOrder(w.hero, { type: 'idle' });
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, restored]) {
      const victim = world.unit(target.id)!;
      world.step(travelTicks - 2);
      expect(victim.hp).toBe(victim.maxHp);
      world.step();
      expect(victim.hp).toBeLessThan(victim.maxHp);
      expect(world.projectiles.some((p) => p.id === arrow.id)).toBe(false);
      world.step(16);
      expect(world.projectiles).toHaveLength(0);
      expect(world.pendingAttackProjectiles).toHaveLength(0);
    }
    expect(restored.snapshot()).toBe(w.snapshot());
  }
});
