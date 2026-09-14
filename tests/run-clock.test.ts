import { expect, it } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
function setup() {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], findPath: (_a, b) => [b] });
  w.nextWaveTick = Infinity;
  w.units = [w.hero];
  w.hero.x = 500;
  w.hero.y = 500;
  return w;
}
it('integrates changing gameplay speed and preserves run phase through restoration', () => {
  const w = setup(),
    u = w.hero;
  u.speed = 325;
  w.setOrder(u, { type: 'move', point: { x: 2000, y: 500 } });
  w.step(10);
  expect(u.runClock!.current).toBeCloseTo(10 / 60, 12);
  u.speed = 650;
  w.step(5);
  expect(u.runClock!.current).toBeCloseTo(20 / 60, 12);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(12);
  restored.step(12);
  expect(restored.snapshot()).toBe(w.snapshot());
});
it('ends a clock on stopping and starts the next segment fresh, rejecting invalid saved clocks', () => {
  const w = setup(),
    u = w.hero;
  w.setOrder(u, { type: 'move', point: { x: 2000, y: 500 } });
  w.step(10);
  const text = w.snapshot();
  for (const mutation of [
    (s: any) => (s.units[0].runClock.startTick = s.tick + 1),
    (s: any) => (s.units[0].runClock.previous = 1000),
  ]) {
    const s = JSON.parse(text);
    mutation(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  }
  w.setOrder(u, { type: 'idle' });
  w.step();
  expect(u.runClock).toBeNull();
  w.setOrder(u, { type: 'move', point: { x: 2000, y: 500 } });
  w.step();
  expect(u.runClock!.startTick).toBe(w.tick);
  expect(u.runClock!.previous).toBe(0);
  u.hp = 0;
  w.step();
  expect(u.runClock).toBeNull();
});
