import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

test('champion death duration follows all 18 source levels, including half seconds', () => {
  const seconds = [
    10, 10, 12, 12, 14, 16, 20, 25, 28, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50, 52.5,
  ];
  for (let level = 1; level <= 18; level++) {
    const w = new World(false);
    for (let next = 2; next <= level; next++) w.gainExperience(280 + (next - 2) * 100);
    w.tick = 123;
    w.damage(w.hero, w.hero, 1e6, 'true');
    expect(w.player.level).toBe(level);
    expect(w.hero.respawnTick).toBe(123 + seconds[level - 1] * 60);
  }
});

test('a level-18 death retains its deadline through saved continuation and expires exactly', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  w.gainExperience(1e6);
  w.tick = 123;
  w.damage(w.hero, w.hero, 1e6, 'true');
  expect(w.hero.respawnTick).toBe(3273);
  w.tick = 3271;
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step();
    expect(world.hero.hp).toBe(0);
    expect(world.hero.respawnTick).toBe(3273);
    world.step();
    expect(world.hero.hp).toBe(world.hero.maxHp);
    expect(world.hero.respawnTick).toBeNull();
  }
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('other champion prototypes do not inherit the player level for death duration', () => {
  const w = new World(false);
  w.gainExperience(1e6);
  for (const team of ['blue', 'red'] as const) {
    const champion = w.spawn('champion', team, { x: 0, y: 0 });
    w.damage(w.hero, champion, 1e6, 'true');
    expect(champion.respawnTick).toBe(w.tick + 600);
  }
});

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
