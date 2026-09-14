import { expect, test } from 'vitest';
import { LuxIlluminationVariants } from '../src/audio/lux-illumination-variants';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

test('passive variant selection excludes the previous two and is repeatable without sim RNG', () => {
  const a = new LuxIlluminationVariants(),
    b = new LuxIlluminationVariants();
  const ids = Array.from({ length: 30 }, (_, i) => i * 13 + 7),
    selected = ids.map((id) => a.next(id));
  expect(ids.map((id) => b.next(id))).toEqual(selected);
  for (let i = 2; i < selected.length; i++)
    expect(new Set(selected.slice(i - 2, i + 1)).size).toBe(3);
});
test('consumption audio is emitted once and never replayed by saved visual history', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
  const target = w.spawn('dummy', 'red', { x: 200, y: 0 });
  target.hp = target.maxHp = 5000;
  w.releaseLightBinding(lux, { x: 1300, y: 0 }, 80);
  w.step(5);
  expect(w.events.filter((e) => e.type === 'illumination')).toEqual([]);
  w.setOrder(lux, { type: 'attack', target: target.id });
  w.step(30);
  const events = w.events.filter((e) => e.type === 'illumination');
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    unit: target.id,
    team: 'blue',
    champion: 'lux',
    x: 200,
    y: 0,
    audience: ['blue', 'red'],
  });
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  restored.step();
  expect(restored.luxIlluminationVisuals).toHaveLength(1);
  expect(restored.events.filter((e) => e.type === 'illumination')).toEqual([]);
  w.step(60);
  expect(w.events.filter((e) => e.type === 'illumination')).toHaveLength(1);
});
