import { expect, test, vi } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function fixture() {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = 1e9;
  Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
  w.spawn('champion', 'red', { x: 5000, y: 0 });
  w.visionAreas.push(
    { x: 3000, y: 0, radius: 500, kind: 'attack', team: 'blue', endTick: 300 },
    { x: 3500, y: 0, radius: 500, kind: 'scout', team: 'red', endTick: 300, unobstructed: true }
  );
  return w;
}

test('all team/flag combinations retain the exact fresh lists during one read scope', () => {
  const w = fixture();
  const queries = (['blue', 'red', 'neutral'] as const).flatMap((team) =>
    [false, true].flatMap((attacks) =>
      [false, true].map((hawks) => ({
        team,
        attacks,
        hawks,
        sources: w.visionSources(team, attacks, hawks),
      }))
    )
  );
  const before = w.snapshot();
  w.withVisionSnapshot(() => {
    for (const q of queries) {
      const first = w.visionSources(q.team, q.attacks, q.hawks);
      expect(first).toEqual(q.sources);
      if (q.team !== 'neutral') expect(w.visionSources(q.team, q.attacks, q.hawks)).toBe(first);
    }
    expect(w.visionSources('blue', false, true)).not.toBe(w.visionSources('blue', true, true));
    expect(w.visionSources('red', true, false)).not.toBe(w.visionSources('blue', true, false));
  });
  expect(w.snapshot()).toBe(before);
});

test('many visibility queries build their source list only once within a frame', () => {
  const w = fixture();
  const alive = vi.spyOn(w, 'alive');
  w.withVisionSnapshot(() => {
    const first = w.visionSources();
    const calls = alive.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    for (let i = 0; i < 100; i++) {
      expect(w.visionSources()).toBe(first);
      w.pointVisible({ x: i * 50, y: i });
    }
    expect(alive.mock.calls.length).toBe(calls);
  });
  const calls = alive.mock.calls.length;
  w.pointVisible({ x: 0, y: 0 });
  expect(alive.mock.calls.length).toBeGreaterThan(calls);
});

test('nested reads share lists, and an exception never leaks the cache', () => {
  const w = fixture();
  let first: ReturnType<World['visionSources']> | undefined;
  expect(() =>
    w.withVisionSnapshot(() => {
      first = w.visionSources();
      try {
        w.withVisionSnapshot(() => {
          expect(w.visionSources()).toBe(first);
          throw Error('nested');
        });
      } catch {
        /* outer read continues */
      }
      expect(w.visionSources()).toBe(first);
      throw Error('outer');
    })
  ).toThrow('outer');
  expect(w.visionSources()).not.toBe(first);
  expect(w.withVisionSnapshot(() => w.visionSources())).not.toBe(first);
});

test('movement, death, spawns and reveal changes in the same tick remain fresh between scopes', () => {
  const w = fixture();
  const read = (x: number) => w.withVisionSnapshot(() => w.pointVisible({ x, y: 0 }));
  const tick = w.tick;
  expect(read(100)).toBe(true);
  const ally = w.units.find((u) => u.team === 'blue')!;
  ally.x = -4000;
  expect(read(100)).toBe(false);
  const added = w.spawn('champion', 'blue', { x: 0, y: 0 });
  expect(read(100)).toBe(true);
  added.hp = 0;
  expect(read(100)).toBe(false);
  w.reveal = { point: { x: 100, y: 0 }, endTick: tick + 1 };
  expect(read(100)).toBe(true);
  w.reveal = null;
  expect(read(100)).toBe(false);
  expect(w.tick).toBe(tick);
});

test('read-only presentation queries preserve saved state and the following simulation', () => {
  const w = fixture();
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (let i = 0; i < 120; i++) {
    const before = w.snapshot();
    w.withVisionSnapshot(() => {
      for (const u of w.units) {
        w.visible(u);
        w.visible(u, 'red');
        w.pointVisible(u);
        w.knownStructureDestroyed(u);
        w.knownStructureDeathTick(u);
      }
    });
    expect(w.snapshot()).toBe(before);
    w.step();
    copy.step();
    expect(w.snapshot()).toBe(copy.snapshot());
  }
});
