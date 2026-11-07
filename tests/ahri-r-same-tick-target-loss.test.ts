import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { validateSpiritRushes } from '../src/simulation/ahri-spirit-rush-validation';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
const field = {
  ...PRACTICE_FIXTURE,
  initialUnits: [],
  lineOfSight: () => true,
  inBrush: () => false,
  lineWalkable: () => true,
  reachable: (p: { x: number; y: number }) => ({ ...p }),
  findPath: (_a: unknown, b: { x: number; y: number }) => [{ ...b }],
};
function completedTick() {
  const w = new World(false, field);
  w.nextWaveTick = 1e9;
  Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 }, ai: false });
  const ahri = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  w.gainExperience(1e6, ahri.id);
  w.learnSpell('r', ahri.id);
  const lux = w.spawn('champion', 'blue', { x: 600, y: 0 }, 'lux');
  lux.ai = false;
  w.learnSpell('e', lux.id);
  const target = w.spawn('dummy', 'red', { x: 600, y: 0 });
  target.hp = 1;
  target.ai = false;
  w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: { x: 600, y: 0 } });
  for (let i = 0; i < 90 && !w.singularities.some((z) => z.arrivalTick !== null); i++) w.step();
  expect(w.singularities.some((z) => z.arrivalTick !== null)).toBe(true);
  w.enqueue({ type: 'cast', unit: ahri.id, ability: 'r', point: { x: 900, y: 0 } });
  w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: { x: 600, y: 0 } });
  w.step();
  expect(target.hp).toBe(0);
  expect(target.deadAt).toBe(w.tick);
  expect(w.ahriRushes[0].bursts[0].bolts[0].stopTick).toBe(null);
  return { w, ahri, target };
}
test('a completed Lux E kill restores before R records target loss on the next tick', () => {
  const { w } = completedTick();
  const saved = w.snapshot();
  const copy = World.fromSnapshot(saved, field);
  expect(copy.snapshot()).toBe(saved);
  w.step();
  copy.step();
  expect(w.ahriRushes[0].bursts[0].bolts[0].stopReason).toBe('lost-target');
  expect(copy.snapshot()).toBe(w.snapshot());
  w.step(120);
  copy.step(120);
  expect(copy.snapshot()).toBe(w.snapshot());
});
test('pending R target loss still rejects stale deaths, future deaths and missing targets', () => {
  const { w, ahri, target } = completedTick();
  const validate = (units: typeof w.units) =>
    validateSpiritRushes(
      w.ahriRushes,
      units,
      [w.championState(ahri.id)!],
      w.tick,
      w.nextId,
      w.winner,
      [],
      w.ahriEssences
    );
  expect(() => validate(w.units)).not.toThrow();
  for (const deadAt of [w.tick - 1, w.tick + 1]) {
    const units = w.units.map((u) => (u.id === target.id ? { ...u, deadAt } : u));
    expect(() => validate(units)).toThrow('Saved match contains invalid Spirit Rush state.');
  }
  expect(() => validate(w.units.filter((u) => u.id !== target.id))).toThrow(
    'Saved match contains invalid Spirit Rush state.'
  );
});
