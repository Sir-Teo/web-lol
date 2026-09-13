import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function setup() {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
  const ally = w.spawn('champion', 'blue', { x: 500, y: 0 });
  const enemy = w.spawn('champion', 'red', { x: 500, y: 0 });
  const minion = w.spawn('melee', 'blue', { x: 500, y: 0 });
  const state = w.championState(lux.id)!;
  const cast = () => {
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'w', point: { x: 1, y: 0 } });
    w.step();
  };
  return { w, lux, ally, enemy, minion, state, cast };
}

test('W captures rank/AP, shields self at cast start and resumes a saved windup', () => {
  const { w, lux, state, cast } = setup();
  state.spellRanks.w = 5;
  state.inventory.push('tome');
  cast();
  expect(state.pendingCast).toMatchObject({
    ability: 'w',
    shield: 108,
    damage: 0,
    releaseTick: 16,
  });
  expect(lux.mana).toBeCloseTo(360.03);
  expect(state.cooldowns.w).toBe(601);
  expect(lux.shields).toEqual([
    { sourceId: lux.id, amount: 108, endTick: 151, prismaticCastTick: 1 },
  ]);
  state.inventory.length = 0;
  w.step(14);
  expect(w.projectiles).toHaveLength(0);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step();
    expect(world.projectiles[0]).toMatchObject({
      type: 'prismatic',
      prismatic: { shield: 108, phase: 'out' },
    });
    world.step(140);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
  expect(w.shieldAmount(lux)).toBe(216);
  expect(w.projectiles).toHaveLength(0);
});

test('each pass shields allies once, return refreshes remaining capacity and credits support', () => {
  const { w, lux, ally, enemy, minion, cast } = setup();
  cast();
  w.step(30);
  expect(w.shieldAmount(ally)).toBe(40);
  const firstDeadline = ally.shields[0].endTick;
  w.damage(enemy, ally, 10, 'true');
  w.step(10);
  expect(w.shieldAmount(ally)).toBe(30);
  const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, saved]) world.step(110);
  expect(saved.snapshot()).toBe(w.snapshot());
  expect(ally.shields).toHaveLength(1);
  expect(w.shieldAmount(ally)).toBe(70);
  expect(ally.shields[0].endTick).toBeGreaterThan(firstDeadline);
  expect(w.championState(ally.id)!.supportContributors).toEqual([
    { sourceId: lux.id, lastSupportTick: ally.shields[0].endTick - 150 },
  ]);
  expect(enemy.hp).toBe(enemy.maxHp);
  expect(enemy.shields).toEqual([]);
  expect(enemy.illumination).toEqual([]);
  expect(minion.shields).toEqual([]);
  w.step(ally.shields[0].endTick - w.tick);
  expect(w.shieldAmount(ally)).toBe(0);
});

test('return homes to a moving caster and can shield an ally missed outbound', () => {
  const { w, lux, ally, cast } = setup();
  ally.y = 500;
  cast();
  w.step(82);
  expect(w.projectiles[0].prismatic!.phase).toBe('return');
  expect(ally.shields).toEqual([]);
  lux.y = 600;
  ally.x = 600;
  ally.y = 300;
  const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, saved]) world.step(100);
  expect(saved.snapshot()).toBe(w.snapshot());
  expect(w.projectiles).toHaveLength(0);
  expect(w.shieldAmount(ally)).toBe(40);
  // The longer trip lets the first self grant expire; the return does not resurrect it.
  expect(w.shieldAmount(lux)).toBe(40);
});

test('depleted shields get only the new amount and separate casters retain separate grants', () => {
  const { w, ally, enemy, cast } = setup();
  const second = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
  cast();
  w.enqueue({ type: 'cast', unit: second.id, ability: 'w', point: { x: 500, y: 0 } });
  w.step(30);
  expect(w.shieldAmount(ally)).toBe(80);
  w.damage(enemy, ally, 80, 'true');
  expect(ally.shields).toEqual([]);
  w.step(120);
  expect(ally.shields).toHaveLength(2);
  expect(w.shieldAmount(ally)).toBe(80);
});

test('caster death cancels windup, but a released wand shields allies and returns to the corpse', () => {
  for (const released of [false, true]) {
    const { w, lux, ally, enemy, cast } = setup();
    cast();
    if (released) w.step(15);
    w.damage(enemy, lux, 10000, 'true');
    w.step();
    const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, saved]) world.step(150);
    expect(saved.snapshot()).toBe(w.snapshot());
    expect(w.projectiles).toHaveLength(0);
    expect(w.shieldAmount(ally)).toBe(released ? 80 : 0);
    expect(lux.shields).toEqual([]);
  }
});

test('saved W rejects incompatible owner, missing payload, repeated hits and altered launch timing', () => {
  const { w, lux, state, cast } = setup();
  cast();
  delete state.pendingCast!.shield;
  expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).toThrow();
  state.pendingCast!.shield = 40;
  w.step(15);
  const valid = w.snapshot();
  for (const corrupt of [
    (world: World) => {
      world.projectiles[0].source = world.hero.id;
    },
    (world: World) => {
      world.projectiles[0].prismatic!.hitsOut.push(lux.id);
    },
    (world: World) => {
      world.projectiles[0].launchTick!++;
    },
    (world: World) => {
      world.unit(lux.id)!.shields.push({ ...world.unit(lux.id)!.shields[0] });
    },
  ]) {
    const restored = World.fromSnapshot(valid, w.battlefield);
    corrupt(restored);
    expect(() => World.fromSnapshot(restored.snapshot(), w.battlefield)).toThrow();
  }
});
