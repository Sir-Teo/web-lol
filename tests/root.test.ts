import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function setup() {
  const world = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    findPath: (_a, b) => [{ x: b.x, y: b.y }],
    lineOfSight: () => true,
  });
  world.nextWaveTick = Infinity;
  Object.assign(world.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
  return world;
}

test('root holds movement orders through saved continuation and releases on its deadline', () => {
  const w = setup();
  w.setOrder(w.hero, { type: 'move', point: { x: 1000, y: 0 } });
  w.applyRoot(w.hero, 120);
  w.step(60);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step(59);
    expect(world.hero.x).toBe(0);
    expect(world.hero.order.type).toBe('move');
    world.step();
    expect(world.hero.x).toBeGreaterThan(0);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('root preserves a committed basic attack and allows subsequent in-range attacks', () => {
  const w = setup();
  const enemy = w.spawn('champion', 'red', { x: 200, y: 0 });
  w.setOrder(w.hero, { type: 'attack', target: enemy.id });
  w.step();
  const release = w.hero.releaseTick;
  w.applyRoot(w.hero, 240);
  expect(w.hero.releaseTick).toBe(release);
  w.step(200);
  expect(w.hero.x).toBe(0);
  expect(
    w.events.filter((e) => e.type === 'attack' && e.unit === w.hero.id).length
  ).toBeGreaterThan(0);
  expect(enemy.hp).toBeLessThan(enemy.maxHp - 80);
});

test('root permits a non-movement spell and does not turn it into a stun', () => {
  const w = setup();
  const enemy = w.spawn('champion', 'red', { x: 500, y: 0 });
  w.applyRoot(w.hero, 120);
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: { x: 500, y: 0 } });
  w.step();
  expect(w.player.pendingCast?.ability).toBe('w');
  w.step(40);
  expect(enemy.hp).toBeLessThan(enemy.maxHp);
  expect(w.hero.stunUntil).toBe(0);
  expect(w.hero.x).toBe(0);
});

test('a root arriving before queued Flash execution rejects the blink without spending cooldown', () => {
  const w = setup();
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'd', point: { x: 400, y: 0 } });
  w.applyRoot(w.hero, 2);
  w.step();
  expect(w.hero.x).toBe(0);
  expect(w.player.cooldowns.d).toBe(0);
  expect(w.events.some((e) => e.text === 'Cannot cast that spell while rooted')).toBe(true);
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'd', point: { x: 400, y: 0 } });
  w.step();
  expect(w.hero.x).toBe(400);
  expect(w.player.cooldowns.d).toBeGreaterThan(w.tick);
});

test('roots retain the longest deadline, reject invalid applications and clear on respawn', () => {
  const w = setup();
  expect(w.applyRoot(w.hero, 120)).toBe(true);
  w.step(10);
  w.applyRoot(w.hero, 5);
  expect(w.hero.rootUntil).toBe(120);
  w.applyRoot(w.hero, 150);
  expect(w.hero.rootUntil).toBe(160);
  for (const invalid of [0, -1, 0.5, Infinity, NaN])
    expect(w.applyRoot(w.hero, invalid)).toBe(false);
  const tower = w.spawn('turret', 'red', { x: 1000, y: 0 });
  expect(w.applyRoot(tower, 120)).toBe(false);
  w.damage(tower, w.hero, 10000, 'true');
  expect(w.applyRoot(w.hero, 120)).toBe(false);
  w.hero.respawnTick = w.tick + 1;
  w.step();
  expect(w.hero.rootUntil).toBe(0);
  const invalid = JSON.parse(w.snapshot());
  delete invalid.units[0].rootUntil;
  expect(() => World.fromSnapshot(JSON.stringify(invalid), w.battlefield)).toThrow();
  w.winner = 'blue';
  expect(w.applyRoot(w.hero, 120)).toBe(false);
});
