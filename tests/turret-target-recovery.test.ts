import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function lane() {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  w.hero.x = 200;
  w.hero.y = 0;
  const tower = w.spawn('turret', 'red', { x: 0, y: 0 });
  tower.range = 750;
  const defender = w.spawn('champion', 'red', { x: 300, y: 0 });
  const minion = w.spawn('melee', 'blue', { x: 400, y: 0 });
  minion.speed = 0;
  minion.nextAttackTick = 10000;
  minion.hp = minion.maxHp = 10000;
  w.damage(w.hero, defender, 1, 'true');
  expect(tower.order).toEqual({ type: 'attack', target: w.hero.id });
  return { w, tower, minion };
}

test('turret drops out-of-range retaliation and resumes lane defense without resetting its attack clock', () => {
  const { w, tower, minion } = lane();
  w.step();
  const deadline = tower.nextAttackTick;
  while (!w.projectiles.some((p) => p.source === tower.id)) w.step();
  const shot = w.projectiles.find((p) => p.source === tower.id)!;
  w.hero.x = 1200;
  w.step();
  expect(tower.order.type).toBe('idle');
  expect(tower.nextAttackTick).toBe(deadline);
  expect(w.projectiles.find((p) => p.id === shot.id)?.target).toBe(w.hero.id);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step(180);
    expect(world.unit(minion.id)!.hp).toBeLessThan(minion.maxHp);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('turret retains an in-range retaliation target over a closer minion', () => {
  const { w, tower, minion } = lane();
  minion.x = 50;
  w.step();
  expect(tower.attackTarget).toBe(w.hero.id);
  expect(tower.order).toEqual({ type: 'attack', target: w.hero.id });
});

test('invalid retaliation reacquires a visible lane target in the same tick', () => {
  const { w, tower, minion } = lane();
  w.hero.hp = 0;
  w.hero.deadAt = w.tick;
  w.step();
  expect(tower.order.type).toBe('idle');
  expect(tower.attackTarget).toBe(minion.id);
  expect(tower.releaseTick).not.toBeNull();
});

test('hidden retaliation targets are released without acquiring another hidden unit', () => {
  const { w, tower, minion } = lane();
  w.battlefield.lineOfSight = (_a, b) => b.x >= 350;
  w.step();
  expect(tower.attackTarget).toBe(minion.id);
  expect(tower.order.type).toBe('idle');
});

test('retaliation range uses the target radius at the boundary', () => {
  for (const offset of [-0.01, 0.01]) {
    const { w, tower, minion } = lane();
    w.hero.x = tower.range + w.hero.radius + offset;
    w.step();
    expect(tower.attackTarget).toBe(offset < 0 ? w.hero.id : minion.id);
  }
});
