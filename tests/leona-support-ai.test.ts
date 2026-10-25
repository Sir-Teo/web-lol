import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { assignRole } from '../src/simulation/bot-jungle';

function setup(team: 'blue' | 'red') {
  const sign = team === 'blue' ? 1 : -1;
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    spawns: { blue: { x: -2500, y: 0 }, red: { x: 2500, y: 0 } },
    inBrush: () => false,
    lineOfSight: () => true,
    lineWalkable: () => true,
    reachable: (p) => ({ x: p.x, y: p.y }),
    findPath: (_a, b) => [{ x: b.x, y: b.y }],
  });
  w.nextWaveTick = Infinity;
  w.hero.x = -3000;
  w.hero.y = -3000;
  const leona = w.spawn('champion', team, { x: 0, y: 0 }, 'leona');
  const carry = w.spawn('champion', team, { x: -500 * sign, y: 0 }, 'ashe');
  assignRole(w.championState(leona.id)!, 'support');
  assignRole(w.championState(carry.id)!, 'carry');
  const enemyTeam = team === 'blue' ? 'red' : 'blue';
  const enemy = w.spawn('champion', enemyTeam, { x: 600 * sign, y: 0 }, 'lux');
  const other = w.spawn('champion', enemyTeam, { x: 650 * sign, y: 0 }, 'ashe');
  other.ai = false;
  carry.ai = enemy.ai = false;
  w.learnSpell('q', leona.id);
  leona.ai = true;
  leona.nextThink = 1;
  return { w, leona, carry, enemy, other, sign };
}
for (const team of ['blue', 'red'] as const)
  test(`${team} Leona support stages with the carry instead of pursuing mobile ranged opponents alone`, () => {
    const { w, leona, sign } = setup(team);
    w.step();
    expect(leona.order.type).toBe('move');
    if (leona.order.type === 'move') expect(leona.order.point.x * sign).toBeLessThan(-500);
    expect(leona.x * sign).toBeLessThan(0);
  });

for (const team of ['blue', 'red'] as const) {
  test(`${team} support can peel an enemy already inside melee reach`, () => {
    const { w, leona, enemy, sign } = setup(team);
    enemy.x = 150 * sign;
    w.step();
    expect(leona.order).toEqual({ type: 'attack', target: enemy.id });
    expect(leona.releaseTick).not.toBeNull();
  });
  test(`${team} support can walk into a sufficiently long observed hold`, () => {
    const { w, leona, enemy, other, sign } = setup(team);
    // Isolate the held catch; the shared outnumbered guard must remain active.
    other.x = 2000 * sign;
    w.applyRoot(enemy, 200);
    w.step();
    expect(leona.order).toEqual({ type: 'attack', target: enemy.id });
    const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
    w.step(120);
    copy.step(120);
    expect(copy.snapshot()).toBe(w.snapshot());
    expect(enemy.hp).toBeLessThan(enemy.maxHp);
  });
}

test('a nearby allied attack in actual reach permits a short support approach', () => {
  const { w, leona, carry, enemy } = setup('blue');
  enemy.x = 400;
  carry.x = 100;
  w.setOrder(carry, { type: 'attack', target: enemy.id });
  w.step();
  expect(leona.order).toEqual({ type: 'attack', target: enemy.id });
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(120);
  copy.step(120);
  expect(copy.snapshot()).toBe(w.snapshot());
});

for (const unavailable of ['out-of-reach', 'stunned', 'retreating', 'distant-approach'] as const)
  test(`an ally who is ${unavailable} does not authorize an unsupported chase`, () => {
    const { w, leona, carry, enemy } = setup('blue');
    enemy.x = 400;
    carry.x = 100;
    w.setOrder(carry, { type: 'attack', target: enemy.id });
    if (unavailable === 'out-of-reach') carry.x = -500;
    if (unavailable === 'stunned') w.applyStun(carry, 100);
    if (unavailable === 'retreating') carry.aiRetreating = true;
    if (unavailable === 'distant-approach') {
      enemy.x = 900;
      carry.x = 500;
    }
    w.step();
    expect(leona.order.type).not.toBe('attack');
  });

for (const unavailable of ['brief-hold', 'slowed', 'rooted'] as const)
  test(`a ${unavailable} support contact forecast cannot authorize the held-target walk`, () => {
    const { w, leona, enemy } = setup('blue');
    w.applyRoot(enemy, unavailable === 'brief-hold' ? 5 : 100);
    if (unavailable === 'slowed') {
      leona.slowUntil = 200;
      leona.slowMultiplier = 0.1;
    }
    if (unavailable === 'rooted') w.applyRoot(leona, 100);
    w.step();
    expect(leona.order.type).not.toBe('attack');
  });

test('a human support attack order still approaches an unheld ranged enemy', () => {
  const { w, leona, enemy } = setup('blue');
  leona.ai = false;
  w.setOrder(leona, { type: 'attack', target: enemy.id });
  w.step(30);
  expect(leona.order).toEqual({ type: 'attack', target: enemy.id });
  expect(leona.x).toBeGreaterThan(100);
});

test('an already committed support windup survives the next tactical decision', () => {
  const { w, leona, enemy } = setup('blue');
  leona.ai = false;
  enemy.x = 150;
  w.setOrder(leona, { type: 'attack', target: enemy.id });
  w.step();
  const release = leona.releaseTick,
    cycle = structuredClone(leona.attackCycle);
  expect(release).not.toBeNull();
  leona.ai = true;
  leona.nextThink = w.tick + 1;
  w.step();
  expect(leona.releaseTick).toBe(release);
  expect(leona.attackCycle).toEqual(cycle);
});

test('a wall blocks the contact forecast despite a long visible hold', () => {
  const { w, leona, enemy } = setup('blue');
  w.applyRoot(enemy, 200);
  w.battlefield.lineWalkable = (_a, b) => b.x < 200;
  w.step();
  expect(leona.order.type).not.toBe('attack');
});
