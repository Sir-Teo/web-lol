import { expect, it } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { castAnimationDuration } from '../src/content/cast-animation';
function setup() {
  const w = new World(
    false,
    { ...PRACTICE_FIXTURE, initialUnits: [], findPath: (_a, b) => [b] },
    'lux'
  );
  w.units = [w.hero];
  w.nextWaveTick = Infinity;
  return w;
}
it('preserves idle seconds through saves and restarts only after a movement interruption', () => {
  const w = setup(),
    u = w.hero;
  w.step(20);
  expect(u.idleClock!.current).toBeCloseTo(20 / 60, 12);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(15);
  restored.step(15);
  expect(restored.snapshot()).toBe(w.snapshot());
  w.setOrder(u, { type: 'move', point: { x: u.x + 1000, y: u.y } });
  w.step();
  expect(u.idleClock).toBeNull();
  w.setOrder(u, { type: 'idle' });
  w.step();
  expect(u.idleClock).toEqual({ startTick: w.tick, previous: 0, current: 1 / 60 });
});
it('excludes active cast and recall poses, resumes after the exact source cast duration, and clears on death', () => {
  const w = setup(),
    u = w.hero;
  w.step(10);
  const start = w.tick;
  w.player.castAnimation = { ability: 'q', startTick: start };
  const duration = castAnimationDuration('lux', 'q');
  w.step(Math.ceil(duration * 60) - 1);
  expect(u.idleClock).toBeNull();
  w.step();
  expect(u.idleClock!.startTick).toBe(w.tick);
  expect((w.tick - start) / 60).toBeGreaterThanOrEqual(duration);
  w.setOrder(u, { type: 'idle' });
  w.enqueue({ type: 'recall', unit: u.id });
  w.step();
  expect(u.idleClock).toBeNull();
  w.setOrder(u, { type: 'idle' });
  w.step();
  expect(u.idleClock!.previous).toBe(0);
  const s = JSON.parse(w.snapshot());
  s.units[0].idleClock.startTick = s.tick + 1;
  expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  u.hp = 0;
  w.step();
  expect(u.idleClock).toBeNull();
});
