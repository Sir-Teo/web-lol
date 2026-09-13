import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

for (const team of ['blue', 'red'] as const)
  test(`${team} champion respawns at its own fountain with resources and cleared combat state`, () => {
    const w = new World(false);
    w.nextWaveTick = Infinity;
    const champion = w.spawn('champion', team, { x: 0, y: 0 });
    const enemy = w.spawn('dummy', team === 'blue' ? 'red' : 'blue', { x: 100, y: 0 });
    champion.mana = 0;
    champion.stunUntil = 10000;
    champion.slowUntil = 10000;
    champion.aiRetreating = true;
    champion.path = [{ x: 200, y: 200 }];
    w.damage(enemy, champion, 1e6, 'true');
    const deadline = champion.respawnTick!;
    w.tick = deadline - 2;
    w.step();
    expect(champion.hp).toBe(0);
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    w.step();
    restored.step();
    expect({ x: champion.x, y: champion.y }).toEqual(w.battlefield.spawns[team]);
    expect(champion.previous).toEqual(w.battlefield.spawns[team]);
    expect(champion.hp).toBe(champion.maxHp);
    expect(champion.mana).toBe(champion.maxMana);
    expect(champion.deadAt).toBeNull();
    expect(champion.respawnTick).toBeNull();
    expect(champion.attackCycle).toBeNull();
    expect(champion.attackTarget).toBeNull();
    expect(champion.path).toEqual([]);
    expect(champion.order).toEqual({ type: 'idle' });
    expect(champion.stunUntil).toBe(0);
    expect(champion.slowUntil).toBe(0);
    expect(champion.aiRetreating).toBe(false);
    expect(restored.snapshot()).toBe(w.snapshot());
  });

test('practice dummies retain their original position when respawning', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const dummy = w.spawn('dummy', 'blue', { x: 300, y: 100 });
  w.damage(w.hero, dummy, 1e6, 'true');
  w.tick = dummy.respawnTick! - 1;
  w.step();
  expect({ x: dummy.x, y: dummy.y }).toEqual({ x: 300, y: 100 });
  expect(dummy.hp).toBe(dummy.maxHp);
});
