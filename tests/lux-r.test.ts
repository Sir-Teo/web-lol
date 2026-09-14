import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function setup() {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
  const targets = [200, 500, 800].map((x) => {
    const target = w.spawn('dummy', 'red', { x, y: 0 });
    Object.assign(target, { hp: 5000, maxHp: 5000, magicResist: 100 });
    return target;
  });
  return { w, lux, targets, state: w.championState(lux.id)! };
}

test('R captures its damage/resources, hits all targets simultaneously and refreshes passive', () => {
  const { w, lux, targets, state } = setup();
  w.releaseLightBinding(lux, { x: 1300, y: 0 }, 80);
  w.step(30);
  state.inventory.push('tome');
  const hp = targets.map((u) => u.hp);
  w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 1, y: 0 } });
  w.step();
  expect(state.pendingCast).toMatchObject({
    ability: 'r',
    damage: 324,
    releaseTick: 91,
    origin: { x: 0, y: 0 },
    point: { x: 3340, y: 0 },
  });
  expect(state.cooldowns.r).toBe(3631);
  expect(lux.mana).toBeCloseTo(340.03);
  expect(w.player.cooldowns.r).toBe(0);
  state.inventory.length = 0;
  w.step(59);
  expect(targets.map((u) => u.hp)).toEqual(hp);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step();
    expect(world.luxBeams).toHaveLength(1);
    expect(targets.map((u, i) => hp[i] - world.unit(u.id)!.hp)).toEqual([177, 177, 162]);
    for (const u of targets)
      expect(world.unit(u.id)!.illumination).toEqual([{ sourceId: lux.id, endTick: 451 }]);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
  const beamSaved = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, beamSaved]) world.step(18);
  expect(w.luxBeams).toHaveLength(1);
  expect(beamSaved.snapshot()).toBe(w.snapshot());
  const tailSaved = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, beamSaved, tailSaved]) world.step(18);
  expect(w.luxBeams).toHaveLength(1);
  for (const world of [w, beamSaved, tailSaved]) world.step();
  expect(w.luxBeams).toEqual([]);
  expect(beamSaved.snapshot()).toBe(w.snapshot());
  expect(tailSaved.snapshot()).toBe(w.snapshot());
});

test('R samples positions at release, ignores allies, and excludes structures', () => {
  const { w, lux, targets } = setup();
  const ally = w.spawn('dummy', 'blue', { x: 300, y: 0 });
  const tower = w.spawn('turret', 'red', { x: 400, y: 0 });
  tower.stunUntil = 10000;
  w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 10000, y: 0 } });
  w.step(60);
  targets[0].y = 200;
  targets[1].x = 3600;
  targets[2].y = 90;
  w.step();
  expect(targets.map((u) => u.hp < u.maxHp)).toEqual([false, false, true]);
  expect(ally.hp).toBe(ally.maxHp);
  expect(tower.hp).toBe(tower.maxHp);
  expect(targets[2].rootUntil).toBe(0);
  expect(targets[2].stunUntil).toBe(0);
  expect(targets[2].slowUntil).toBe(0);
});

test('stun during committed R does not interrupt it, while caster death cancels it', () => {
  for (const dead of [false, true]) {
    const { w, lux, targets, state } = setup();
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 500, y: 0 } });
    w.step();
    if (dead) w.damage(targets[0], lux, 10000, 'true');
    else lux.stunUntil = 1000;
    w.step(60);
    expect(state.pendingCast).toBeNull();
    expect(w.luxBeams.length).toBe(dead ? 0 : 1);
    expect(targets[0].hp < targets[0].maxHp).toBe(!dead);
  }
});

test('saved R rejects changed release timing, missing origin and invalid retained beams', () => {
  const { w, lux, state } = setup();
  w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 500, y: 0 } });
  w.step();
  const valid = w.snapshot();
  state.pendingCast!.releaseTick++;
  expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).toThrow();
  state.pendingCast!.releaseTick--;
  delete state.pendingCast!.origin;
  expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).toThrow();
  const restored = World.fromSnapshot(valid, w.battlefield);
  restored.step(60);
  restored.luxBeams[0].sourceId = w.hero.id;
  expect(() => World.fromSnapshot(restored.snapshot(), w.battlefield)).toThrow();
});

test('Flash during R preserves the original beam and cast animation through save', () => {
  const { w, lux, targets, state } = setup();
  w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 500, y: 0 } });
  w.step(20);
  w.enqueue({ type: 'cast', unit: lux.id, ability: 'd', point: { x: 0, y: 400 } });
  w.step();
  expect(lux.y).toBe(400);
  expect(state.castAnimation).toEqual({ ability: 'r', startTick: 1 });
  expect(state.pendingCast!.origin).toEqual({ x: 0, y: 0 });
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step(40);
    expect(world.luxBeams[0].origin).toEqual({ x: 0, y: 0 });
    expect(world.luxBeams[0].point).toEqual({ x: 3340, y: 0 });
    expect(world.unit(targets[0].id)!.hp).toBe(4850);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
});
