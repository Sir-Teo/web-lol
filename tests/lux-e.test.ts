import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { LUX_E_BURST_TICKS } from '../src/content/lux-e-particle-timing';

function setup() {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
  const enemy = w.spawn('champion', 'red', { x: 600, y: 0 });
  enemy.hp = enemy.maxHp = 10000;
  enemy.magicResist = 30;
  const state = w.championState(lux.id)!;
  const cast = (point = { x: 600, y: 0 }) => {
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point });
    w.step();
  };
  return { w, lux, enemy, state, cast };
}

test('Rift Lux can learn E and restore its rank without receiving Hawkshot charges', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, id: 'rift', initialUnits: [] });
  const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
  const state = w.championState(lux.id)!;
  expect(state.spellRanks.e).toBe(0);
  expect(w.learnSpell('e', lux.id)).toBeNull();
  expect(state.spellRanks.e).toBe(1);
  expect(state.eCharges).toBe(0);
  expect(state.eRechargeTick).toBeNull();
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});

test('E captures damage and own resources, travels through enemies, arms and times out exactly once', () => {
  const { w, lux, enemy, state, cast } = setup();
  state.inventory.push('tome');
  cast();
  expect(state.pendingCast).toMatchObject({
    damage: 81,
    releaseTick: 16,
    detonateRequested: false,
  });
  expect(state.cooldowns.e).toBe(601);
  expect(lux.mana).toBeCloseTo(370.03);
  expect(state.eCharges).toBe(0);
  state.inventory.length = 0;
  w.step(14);
  const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, saved]) {
    world.step(30);
    expect(world.singularities[0]).toMatchObject({ arrivalTick: 45, endTick: 345, damage: 81 });
    expect(world.unit(enemy.id)!.hp).toBe(10000);
    expect(world.slowFactor(world.unit(enemy.id)!)).toBe(0.75);
    world.step(299);
    expect(world.unit(enemy.id)!.hp).toBe(10000);
    world.step();
    expect(world.unit(enemy.id)!.hp).toBeCloseTo(10000 - 81 / 1.3 + 0.7 / 60);
    expect(world.unit(enemy.id)!.illumination).toEqual([{ sourceId: lux.id, endTick: 705 }]);
    expect(world.unit(enemy.id)!.slows[0].endTick).toBe(405);
    expect(World.fromSnapshot(world.snapshot(), world.battlefield).snapshot()).toBe(
      world.snapshot()
    );
    world.step(60);
    expect(world.slowFactor(world.unit(enemy.id)!)).toBe(1);
    expect(world.singularities).toHaveLength(1);
    world.step(LUX_E_BURST_TICKS - 60);
    expect(world.singularities).toEqual([]);
  }
  expect(saved.snapshot()).toBe(w.snapshot());
});

test('free recast buffers during windup or flight and detonates on arrival at zero mana', () => {
  for (const wait of [0, 20]) {
    const { w, lux, enemy, state, cast } = setup();
    cast();
    w.step(wait);
    lux.mana = 0;
    cast();
    const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, saved]) world.step(45 - world.tick);
    expect(saved.snapshot()).toBe(w.snapshot());
    expect(w.singularities[0].detonatedTick).toBe(45);
    expect(enemy.hp).toBeCloseTo(9950 + 0.7 / 60);
    expect(state.cooldowns.e).toBe(601);
    expect(lux.mana).toBeLessThan(2);
  }
});

test('range clamp, self cast and all five resource ranks work without Hawkshot charges', () => {
  for (let rank = 1; rank <= 5; rank++) {
    const { w, state, cast } = setup();
    state.spellRanks.e = rank;
    cast({ x: 10000, y: 0 });
    expect(state.pendingCast!.point).toEqual({ x: 1100, y: 0 });
    expect(state.pendingCast!.damage).toBe(65 + (rank - 1) * 50);
    expect(w.abilityResources('e', state.id)).toEqual({
      mana: 60 + rank * 10,
      cooldownSeconds: 10.5 - rank * 0.5,
    });
  }
  const { w, cast } = setup();
  cast({ x: 0, y: 0 });
  w.step(15);
  expect(w.singularities[0]).toMatchObject({ x: 0, y: 0, arrivalTick: 16, endTick: 316 });
});

test('zone slow leaves and re-enters independently; detonation samples current positions and excludes allies/structures', () => {
  const { w, lux, enemy, cast } = setup();
  const ally = w.spawn('champion', 'blue', { x: 600, y: 0 });
  const tower = w.spawn('turret', 'red', { x: 600, y: 0 });
  tower.stunUntil = Infinity;
  cast();
  w.step(44);
  enemy.y = 600;
  w.step(15);
  expect(w.slowFactor(enemy)).toBe(1);
  enemy.y = 0;
  w.step();
  expect(w.slowFactor(enemy)).toBe(0.75);
  w.applyShield(ally, lux, 100, 60);
  cast();
  expect(enemy.hp).toBeCloseTo(9950 + 0.7 / 60);
  expect(ally.hp).toBe(ally.maxHp);
  expect(tower.hp).toBe(tower.maxHp);
  expect(w.shieldAmount(lux)).toBe(100);
});

test('recast during R preserves its pending origin and damage; repeated commands cannot double detonate', () => {
  const { w, lux, enemy, state, cast } = setup();
  cast();
  w.step(44);
  w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 1000, y: 0 } });
  w.step();
  const pending = structuredClone(state.pendingCast);
  w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: lux });
  cast();
  expect(state.pendingCast).toEqual(pending);
  expect(enemy.hp).toBeCloseTo(9950 + 0.7 / 60);
  expect(state.castAnimation!.ability).toBe('r');
});

test('a committed E persists after caster death, while death in windup cancels it', () => {
  for (const released of [false, true]) {
    const { w, lux, enemy, cast } = setup();
    cast();
    if (released) w.step(15);
    w.damage(enemy, lux, 10000, 'true');
    const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, saved]) world.step(345 - world.tick);
    expect(saved.snapshot()).toBe(w.snapshot());
    expect(enemy.hp).toBeCloseTo(released ? 9950 + 0.7 / 60 : 10000);
  }
});

test('armed zone supplies team vision beyond the caster and removes it on detonation', () => {
  const { w, lux, cast } = setup();
  const hidden = { x: 1720, y: 0 };
  expect(w.pointVisible(hidden, 'blue')).toBe(false);
  cast({ x: 1100, y: 0 });
  w.step(69);
  expect(w.pointVisible(hidden, 'blue')).toBe(true);
  expect(w.visionSources('red').some((s) => s.x === 1100 && s.y === 0)).toBe(false);
  cast();
  expect(w.pointVisible(hidden, 'blue')).toBe(false);
  expect(lux.hp).toBe(lux.maxHp);
});

test('saved E rejects missing windup payload and corrupt or duplicate zone state', () => {
  const { w, state, cast } = setup();
  cast();
  delete state.pendingCast!.detonateRequested;
  expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).toThrow();
  state.pendingCast!.detonateRequested = false;
  w.step(44);
  const valid = w.snapshot();
  for (const corrupt of [
    (world: World) => {
      world.singularities[0].endTick!++;
    },
    (world: World) => {
      world.singularities[0].sourceId = world.hero.id;
    },
    (world: World) => {
      world.singularities[0].point.x = 2000;
    },
    (world: World) => {
      world.singularities.push({ ...world.singularities[0], id: world.nextId++ });
    },
  ]) {
    const saved = World.fromSnapshot(valid, w.battlefield);
    corrupt(saved);
    expect(() => World.fromSnapshot(saved.snapshot(), w.battlefield)).toThrow();
  }
});
