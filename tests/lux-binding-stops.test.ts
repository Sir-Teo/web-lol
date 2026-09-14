import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { LUX_BINDING } from '../src/content/lux-binding';
import { LUX_BINDING_STOP_HISTORY_TICKS } from '../src/content/lux-binding-presentation';

function setup() {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
  return { w, lux };
}

test('second swept contact records its intersection rather than the tick endpoint', () => {
  const { w, lux } = setup();
  const targets = [300, 603, 900].map((x) => w.spawn('dummy', 'red', { x, y: 0 }));
  w.releaseLightBinding(lux, { x: 1300, y: 0 }, 80);
  const id = w.projectiles[0].id;
  for (let i = 0; i < 70 && !w.bindingStops.length; i++) w.step();
  expect(w.projectiles).toHaveLength(0);
  expect(w.bindingStops).toHaveLength(1);
  const stop = w.bindingStops[0];
  expect(stop).toMatchObject({
    id,
    sourceId: lux.id,
    team: 'blue',
    reason: 'hit-limit',
    launchTick: 0,
  });
  expect(stop.point.x).toBeCloseTo(targets[1].x - targets[1].radius - LUX_BINDING.radius, 8);
  expect(stop.point.y).toBe(0);
  expect(targets[2].hp).toBe(targets[2].maxHp);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
  w.step(2);
  expect(w.bindingStops).toHaveLength(1);
});

test('range stop survives reload and expires exactly at the source fade deadline', () => {
  const { w, lux } = setup();
  w.enqueue({ type: 'cast', unit: lux.id, ability: 'q', point: { x: 1300, y: 0 } });
  for (let i = 0; i < 100 && !w.bindingStops.length; i++) w.step();
  expect(w.bindingStops[0]).toMatchObject({ reason: 'range', point: { x: 1300, y: 0 } });
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(LUX_BINDING_STOP_HISTORY_TICKS - 1);
  restored.step(LUX_BINDING_STOP_HISTORY_TICKS - 1);
  expect(restored.snapshot()).toBe(w.snapshot());
  expect(w.bindingStops).toHaveLength(1);
  w.step();
  restored.step();
  expect(w.bindingStops).toHaveLength(0);
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('a saved live flight can finish after caster death with the same stop record', () => {
  const { w, lux } = setup();
  const killer = w.spawn('dummy', 'red', { x: -200, y: 0 });
  w.releaseLightBinding(lux, { x: 1300, y: 0 }, 80);
  w.step(5);
  w.damage(killer, lux, 10000, 'true');
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(60);
  restored.step(60);
  expect(w.bindingStops).toHaveLength(1);
  expect(restored.bindingStops).toEqual(w.bindingStops);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});

test('malformed stop identities, ownership, lifetime and geometry are rejected', () => {
  const { w, lux } = setup();
  w.releaseLightBinding(lux, { x: 1300, y: 0 }, 80);
  w.step(65);
  const saved = w.snapshot();
  const mutations = [
    (s: any) => s.bindingStops.push({ ...s.bindingStops[0] }),
    (s: any) => (s.bindingStops[0].id = lux.id),
    (s: any) => (s.bindingStops[0].sourceId = s.nextId),
    (s: any) => (s.bindingStops[0].team = 'red'),
    (s: any) => (s.bindingStops[0].launchTick = s.tick + 1),
    (s: any) => (s.bindingStops[0].stopTick = s.tick + 1),
    (s: any) => (s.tick += LUX_BINDING_STOP_HISTORY_TICKS),
    (s: any) => (s.bindingStops[0].point.x += 10),
    (s: any) => (s.bindingStops[0].point.x -= 10),
    (s: any) => {
      s.bindingStops[0].reason = 'hit-limit';
      s.bindingStops[0].launchTick = s.tick;
    },
  ];
  for (const mutate of mutations) {
    const state = JSON.parse(saved);
    mutate(state);
    expect(() => World.fromSnapshot(JSON.stringify(state), w.battlefield)).toThrow();
  }
});
