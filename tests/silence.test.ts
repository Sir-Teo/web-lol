import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { GAREN_Q } from '../src/content/garen-q';
function setup() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
  });
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
  const state = w.championState(lux.id)!;
  const cast = (ability: 'q' | 'w' | 'e' | 'r' | 'd' | 'f') => {
    w.enqueue({ type: 'cast', unit: lux.id, ability, point: { x: 600, y: 0 } });
    w.step();
  };
  return { w, lux, state, cast };
}
test('silenced bots keep tactical movement and the effect clears on respawn', () => {
  const { w, lux } = setup();
  w.hero.x = w.hero.y = -3000;
  w.spawn('champion', 'red', { x: 450, y: -100 });
  w.spawn('champion', 'red', { x: 450, y: 100 });
  lux.ai = true;
  w.applySilence(lux, 90);
  w.step();
  expect(lux.order.type).toBe('move');
  expect(lux.x).toBeLessThan(0);
  expect(w.championState(lux.id)!.pendingCast).toBeNull();
  lux.hp = 0;
  lux.deadAt = w.tick;
  lux.respawnTick = w.tick + 1;
  expect(w.applySilence(lux, 90)).toBe(false);
  w.step();
  expect(lux.silenceUntil).toBe(0);
});
test('silence blocks champion spells and Flash without spending resources, while Heal remains available', () => {
  const { w, lux, state, cast } = setup();
  expect(w.applySilence(lux, GAREN_Q.silenceSeconds * 60)).toBe(true);
  for (const ability of ['q', 'w', 'e', 'r', 'd'] as const) cast(ability);
  expect(state.cooldowns).toMatchObject({ q: 0, w: 0, e: 0, r: 0, d: 0 });
  expect(lux.mana).toBe(lux.maxMana);
  expect(state.pendingCast).toBeNull();
  lux.hp = 100;
  cast('f');
  expect(lux.hp).toBeGreaterThan(100);
  expect(state.cooldowns.f).toBeGreaterThan(w.tick);
  w.step(lux.silenceUntil - w.tick - 1);
  cast('q');
  expect(state.pendingCast?.ability).toBe('q');
});
test('silence permits movement and committed basic attacks and does not shorten an existing silence', () => {
  const { w, lux } = setup();
  const target = w.spawn('champion', 'red', { x: 300, y: 0 });
  w.setOrder(lux, { type: 'attack', target: target.id });
  w.step();
  const release = lux.releaseTick!;
  w.applySilence(lux, 90);
  const end = lux.silenceUntil;
  w.applySilence(lux, 10);
  expect(lux.silenceUntil).toBe(end);
  expect(lux.releaseTick).toBe(release);
  w.step(release - w.tick);
  expect(w.projectiles.some((p) => p.source === lux.id && p.type === 'attack')).toBe(true);
  w.enqueue({ type: 'order', unit: lux.id, order: { type: 'move', point: { x: -200, y: 0 } } });
  w.step();
  expect(lux.x).toBeLessThan(0);
});
test('silence blocks both early and active Lux E recasts but preserves the original non-channel cast', () => {
  const { w, lux, state, cast } = setup();
  cast('e');
  w.applySilence(lux, 90);
  cast('e');
  expect(state.pendingCast?.detonateRequested).toBe(false);
  w.step(50);
  expect(w.singularities[0].arrivalTick).not.toBeNull();
  cast('e');
  expect(w.singularities[0].detonateRequested).toBe(false);
  w.step(lux.silenceUntil - w.tick);
  cast('e');
  expect(w.singularities[0].detonatedTick).not.toBeNull();
});
test('silence interrupts recall, rejects invalid targets/durations, and validates snapshot state', () => {
  const { w, lux, state } = setup();
  w.enqueue({ type: 'recall', unit: lux.id });
  w.step();
  expect(state.recallEnd).not.toBeNull();
  w.applySilence(lux, 90);
  expect(state.recallEnd).toBeNull();
  w.enqueue({ type: 'recall', unit: lux.id });
  w.step();
  expect(state.recallEnd).toBeNull();
  for (const duration of [-1, 0, NaN, Infinity, 1.5])
    expect(w.applySilence(lux, duration)).toBe(false);
  expect(w.applySilence(w.spawn('turret', 'red', { x: 1000, y: 0 }), 90)).toBe(false);
  const saved = w.snapshot(),
    restored = World.fromSnapshot(saved, w.battlefield);
  w.step(120);
  restored.step(120);
  expect(restored.snapshot()).toBe(w.snapshot());
  for (const value of [-1, 1.5, null]) {
    const bad = JSON.parse(saved);
    bad.units.find((u: { id: number }) => u.id === lux.id).silenceUntil = value;
    expect(() => World.fromSnapshot(JSON.stringify(bad), w.battlefield)).toThrow();
  }
});
