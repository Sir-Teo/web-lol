import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { LUX_E_POLICY } from '../src/content/lux-e-policy';
import { TICK_RATE } from '../src/content/rules';

function setup() {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
  const target = w.spawn('dummy', 'red', { x: 600, y: 0 });
  target.hp = target.maxHp = 5000;
  w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: target });
  w.step();
  return { w, lux, target };
}
function winNextTick(w: World, kind: 'melee' | 'caster' = 'melee') {
  const finisher = w.spawn(kind, 'blue', { x: -500, y: -500 });
  const nexus = w.spawn('nexus', 'red', { x: -450, y: -500 });
  nexus.hp = 1;
  w.setOrder(finisher, { type: 'attack', target: nexus.id });
  finisher.releaseTick = w.tick + 1;
  finisher.attackTarget = nexus.id;
  w.step();
  expect(w.winner).toBe('blue');
}
function restorableAndFrozen(w: World) {
  const saved = w.snapshot();
  const restored = World.fromSnapshot(saved, w.battlefield);
  expect(restored.snapshot()).toBe(saved);
  for (const world of [w, restored]) world.step(600);
  expect(restored.snapshot()).toBe(saved);
  expect(w.snapshot()).toBe(saved);
}
for (const kind of ['melee', 'caster'] as const) {
  test(`${kind} victory cancels an in-flight E without moving it or applying its queued detonation`, () => {
    const { w, lux, target } = setup();
    w.step(20);
    const zone = w.singularities[0];
    expect(zone.arrivalTick).toBeNull();
    const point = { x: zone.x, y: zone.y };
    const mana = lux.mana;
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: target });
    winNextTick(w, kind);
    expect({ x: zone.x, y: zone.y }).toEqual(point);
    expect(w.singularities).toEqual([]);
    expect(target.hp).toBe(5000);
    expect(target.illumination).toEqual([]);
    expect(target.slows).toEqual([]);
    expect(lux.mana - mana).toBeLessThan(1);
    restorableAndFrozen(w);
  });
  test(`${kind} victory cancels a recast-ready armed E before its damage phase`, () => {
    const { w, lux, target } = setup();
    w.step(44);
    expect(w.singularities[0].arrivalTick).not.toBeNull();
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: target });
    winNextTick(w, kind);
    expect(w.singularities).toEqual([]);
    expect(target.hp).toBe(5000);
    expect(target.illumination).toEqual([]);
    restorableAndFrozen(w);
  });
}
test('victory cancels an E still in windup without refunding the committed cost or cooldown', () => {
  const { w, lux } = setup();
  const state = w.championState(lux.id)!;
  const cooldown = state.cooldowns.e;
  const mana = lux.mana;
  expect(state.pendingCast?.ability).toBe('e');
  winNextTick(w);
  expect(state.pendingCast).toBeNull();
  expect(state.cooldowns.e).toBe(cooldown);
  expect(lux.mana - mana).toBeLessThan(1);
  expect(w.singularities).toEqual([]);
  restorableAndFrozen(w);
});
test('direct terminal damage cancels active E state without advancing the clock', () => {
  const { w, target } = setup();
  w.step(20);
  const tick = w.tick;
  const nexus = w.spawn('nexus', 'red', { x: -450, y: -500 });
  w.damage(w.hero, nexus, 100000, 'true');
  expect(w.tick).toBe(tick);
  expect(w.singularities).toEqual([]);
  expect(target.hp).toBe(5000);
  restorableAndFrozen(w);
});
for (const atExpiry of [false, true]) {
  test(`victory ${atExpiry ? 'retires an expired' : 'retains an unexpired'} already-detonated E burst`, () => {
    const { w, lux, target } = setup();
    w.step(44);
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: target });
    w.step();
    const zone = w.singularities[0];
    expect(zone.detonatedTick).toBe(w.tick);
    const expiry = w.tick + LUX_E_POLICY.presentationSeconds * TICK_RATE;
    w.step(expiry - w.tick - (atExpiry ? 1 : 2));
    const hp = target.hp;
    winNextTick(w);
    expect(w.singularities.map((z) => z.id)).toEqual(atExpiry ? [] : [zone.id]);
    expect(target.hp).toBe(hp);
    restorableAndFrozen(w);
  });
}
test('a fabricated winning checkpoint cannot retain active E gameplay state', () => {
  const { w } = setup();
  w.step(44);
  const active = structuredClone(w.singularities[0]);
  winNextTick(w);
  expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).not.toThrow();
  const saved = JSON.parse(w.snapshot());
  saved.singularities = [active];
  expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow(
    'invalid Lucent Singularity'
  );
});
