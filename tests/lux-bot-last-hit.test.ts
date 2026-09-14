import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function setup(team: 'blue' | 'red' = 'blue') {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.hero.x = w.hero.y = -10000;
  w.nextWaveTick = Infinity;
  const enemy = team === 'blue' ? 'red' : 'blue';
  const lux = w.spawn('champion', team, { x: 0, y: 0 }, 'lux');
  const near = w.spawn('melee', enemy, { x: 200, y: -200 });
  const marked = w.spawn('caster', enemy, { x: 500, y: 0 });
  near.speed = marked.speed = 0;
  near.nextAttackTick = marked.nextAttackTick = 10000;
  w.releaseLightBinding(lux, { x: 1300, y: 0 }, 0);
  w.step(30);
  expect(marked.illumination).toHaveLength(1);
  marked.hp = 70;
  lux.ai = true;
  lux.nextThink = w.tick + 1;
  return { w, lux, near, marked };
}

for (const team of ['blue', 'red'] as const)
  test(`${team} Lux last-hits using her own surviving mark and preserves the proc across reload`, () => {
    const { w, lux, near, marked } = setup(team);
    w.step();
    expect(lux.attackTarget).toBe(marked.id);
    const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, saved]) {
      world.step(40);
      expect(world.unit(marked.id)!.hp).toBe(0);
      expect(world.unit(near.id)!.hp).toBe(near.maxHp);
      expect(world.championState(lux.id)!.cs).toBe(1);
      expect(world.unit(marked.id)!.illumination).toEqual([]);
    }
    expect(saved.snapshot()).toBe(w.snapshot());
  });

test('Lux does not count foreign, expiring or heavily mitigated marks as lethal', () => {
  for (const condition of ['foreign', 'expires-in-flight', 'resistance']) {
    const { w, lux, near, marked } = setup();
    if (condition === 'foreign') {
      const other = w.spawn('champion', lux.team, { x: -1000, y: -1000 }, 'lux');
      marked.illumination[0].sourceId = other.id;
    }
    if (condition === 'expires-in-flight') marked.illumination[0].endTick = w.tick + 10;
    if (condition === 'resistance') marked.magicResist = 200;
    w.step();
    expect(lux.attackTarget, condition).toBe(near.id);
  }
});

test('the marked last-hit estimate includes current ability power', () => {
  const { w, lux, near, marked } = setup();
  marked.hp = 80;
  const withoutTome = World.fromSnapshot(w.snapshot(), w.battlefield);
  withoutTome.step();
  expect(withoutTome.unit(lux.id)!.attackTarget).toBe(near.id);
  w.championState(lux.id)!.inventory.push('tome');
  w.step();
  expect(lux.attackTarget).toBe(marked.id);
  w.step(40);
  expect(marked.hp).toBe(0);
  expect(w.championState(lux.id)!.cs).toBe(1);
});
