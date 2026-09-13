import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function setup() {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
  const target = w.spawn('dummy', 'red', { x: 200, y: 0 });
  Object.assign(target, { hp: 5000, maxHp: 5000, armor: 0, magicResist: 100 });
  w.releaseLightBinding(lux, { x: 1300, y: 0 }, 80);
  w.step(5);
  return { w, lux, target };
}

for (const level of [1, 18])
  test(`level ${level} attack consumes Illumination once with separate magic mitigation`, () => {
    const { w, lux, target } = setup();
    if (level === 18) w.gainExperience(1e6, lux.id);
    w.championState(lux.id)!.inventory.push('tome');
    const hp = target.hp;
    w.setOrder(lux, { type: 'attack', target: target.id });
    w.step(30);
    const passive = level === 1 ? 37 : 207;
    expect(target.hp).toBeCloseTo(hp - lux.damage - passive / 2);
    expect(target.illumination).toEqual([]);
    const afterFirst = target.hp;
    w.step(lux.attackPeriod);
    expect(target.hp).toBeCloseTo(afterFirst - lux.damage);
  });

test('Q refreshes a mark instead of consuming or stacking it', () => {
  const { w, lux, target } = setup();
  expect(target.illumination).toEqual([{ sourceId: lux.id, endTick: 365 }]);
  w.step(20);
  w.releaseLightBinding(lux, { x: 1300, y: 0 }, 80);
  w.step(5);
  expect(target.illumination).toEqual([{ sourceId: lux.id, endTick: 390 }]);
  expect(target.hp).toBe(4920);
});

test('saving a marked target with a basic attack in flight retains exactly one proc', () => {
  const { w, lux, target } = setup();
  w.setOrder(lux, { type: 'attack', target: target.id });
  w.step(15);
  expect(w.projectiles.some((p) => p.type === 'attack')).toBe(true);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step(10);
    expect(world.unit(target.id)!.illumination).toEqual([]);
    expect(world.unit(target.id)!.hp).toBe(4891);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('an attack landing on the expiry tick cannot consume the expired mark', () => {
  const { w, lux, target } = setup();
  w.step(340);
  w.setOrder(lux, { type: 'attack', target: target.id });
  w.step(15);
  const attack = w.projectiles.find((p) => p.type === 'attack')!;
  expect(attack).toBeDefined();
  // Hold this committed missile until the exact deadline to isolate expiry order.
  attack.speed = 0;
  w.step(4);
  attack.speed = 60000;
  w.step();
  expect(w.tick).toBe(365);
  expect(target.illumination).toEqual([]);
  expect(target.hp).toBe(4906);
});

test('allies cannot consume another Lux mark; target death clears all marks', () => {
  const { w, lux, target } = setup();
  const ally = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
  w.setOrder(ally, { type: 'attack', target: target.id });
  w.step(30);
  expect(target.illumination).toEqual([{ sourceId: lux.id, endTick: 365 }]);
  w.setOrder(ally, { type: 'idle' });
  w.releaseLightBinding(ally, { x: 1300, y: 0 }, 80);
  w.step(5);
  expect(target.illumination.map((mark) => mark.sourceId)).toEqual([lux.id, ally.id]);
  w.damage(target, lux, 10000, 'true');
  expect(target.illumination).toHaveLength(2);
  w.damage(ally, target, 10000, 'true');
  expect(target.illumination).toEqual([]);
  w.step(180);
  expect(target.deadAt).toBeNull();
  expect(target.illumination).toEqual([]);
});

test('saved marks reject wrong owners, duplicate owners, expired or impossible deadlines', () => {
  const { w, target, lux } = setup();
  for (const marks of [
    undefined,
    [{ sourceId: w.hero.id, endTick: 365 }],
    [{ sourceId: w.nextId, endTick: 365 }],
    [{ sourceId: lux.id, endTick: w.tick }],
    [{ sourceId: lux.id, endTick: 366 }],
    [target.illumination[0], target.illumination[0]],
  ]) {
    const saved = JSON.parse(w.snapshot());
    saved.units.find((u: { id: number }) => u.id === target.id).illumination = marks;
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
  }
});
