import { expect, test, vi } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { requestOracle } from '../src/simulation/oracle-lens';
import { swapTrinket } from '../src/simulation/trinkets';
import { SCUTTLER_POLICY } from '../src/content/scuttler-policy';

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

test('repeated visible and hidden unit reads share each team result only inside the scope', () => {
  const w = fixture(),
    enemy = w.units.find((u) => u.team === 'red')!,
    near = w.spawn('champion', 'red', { x: 100, y: 0 }),
    pointVisible = vi.spyOn(w, 'pointVisible');
  w.withVisionSnapshot(() => {
    for (let i = 0; i < 100; i++) {
      expect(w.visible(enemy)).toBe(false);
      expect(w.visible(near)).toBe(true);
      expect(w.visible(enemy, 'red')).toBe(true);
      expect(w.visible(enemy, 'neutral')).toBe(false);
      expect(w.knownStructureDestroyed(enemy)).toBeNull();
    }
    expect(pointVisible).toHaveBeenCalledTimes(2);
    w.withVisionSnapshot(() => {
      expect(w.visible(enemy)).toBe(false);
      expect(w.visible(near)).toBe(true);
    });
    expect(pointVisible).toHaveBeenCalledTimes(2);
  });
  w.visible(enemy);
  w.visible(enemy);
  expect(pointVisible).toHaveBeenCalledTimes(4);
  w.withVisionSnapshot(() => w.visible(enemy));
  expect(pointVisible).toHaveBeenCalledTimes(5);
});

test('cache keys use unit identity, including detached records with a reused ID', () => {
  const w = fixture(),
    enemy = w.units.find((u) => u.team === 'red')!,
    detached = { ...enemy, x: 100 };
  expect(detached.id).toBe(enemy.id);
  w.withVisionSnapshot(() => {
    expect(w.visible(enemy)).toBe(false);
    expect(w.visible(detached)).toBe(true);
    expect(w.visible(enemy)).toBe(false);
  });
});

test('exceptions release unit results and same-tick reveals remain fresh between scopes', () => {
  const w = fixture(),
    enemy = w.units.find((u) => u.team === 'red')!,
    read = () => w.withVisionSnapshot(() => w.visible(enemy));
  expect(() =>
    w.withVisionSnapshot(() => {
      expect(w.visible(enemy)).toBe(false);
      expect(() =>
        w.withVisionSnapshot(() => {
          throw Error('nested');
        })
      ).toThrow('nested');
      expect(w.visible(enemy)).toBe(false);
      throw Error('outer');
    })
  ).toThrow('outer');
  w.reveal = { point: { x: enemy.x, y: enemy.y }, endTick: w.tick + 1 };
  expect(w.visible(enemy)).toBe(true);
  expect(read()).toBe(true);
  w.reveal = null;
  expect(read()).toBe(false);
  enemy.x = 100;
  expect(read()).toBe(true);
  enemy.x = 5000;
  expect(w.visible(enemy)).toBe(false);
});

test('ward detection and Garen target reveal keep their distinct visibility rules across scopes', () => {
  const w = fixture(),
    owner = w.units.find((u) => u.team === 'red')!,
    ward = w.spawnWard({
      origin: owner,
      ownerId: owner.id,
      team: 'red',
      point: { x: 100, y: 0 },
      startTick: w.tick,
      readyTick: w.tick,
      lifeTicks: 600,
    });
  ward.ward!.revealUntil = w.tick;
  const read = () => w.withVisionSnapshot(() => [w.visible(ward), w.visible(ward, 'red')]);
  expect(w.pointVisible(ward)).toBe(true);
  expect(read()).toEqual([false, true]);
  Object.assign(w.hero, w.battlefield.spawns.blue);
  expect(swapTrinket(w, 'oracle')).toBeNull();
  Object.assign(w.hero, { x: 0, y: 0 });
  expect(requestOracle(w, w.hero)).toBeNull();
  expect(read()).toEqual([true, true]);
  w.player.trinket.scan = null;
  expect(read()).toEqual([false, true]);
  const garen = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'garen'),
    state = w.championState(garen.id)!;
  state.garenRReveal = { targetId: owner.id, startTick: w.tick, endTick: w.tick + 1 };
  expect(w.pointVisible(owner)).toBe(false);
  expect(w.withVisionSnapshot(() => w.visible(owner))).toBe(true);
  state.garenRReveal = null;
  expect(w.withVisionSnapshot(() => w.visible(owner))).toBe(false);
});

test('Scuttler hidden emergence and its exact deadline are fresh in successive frames', () => {
  const w = fixture(),
    crab = w.spawnMonster({ x: 100, y: 0 }, { startTick: w.tick, readyTick: 600 }, 'scuttler');
  const read = () => w.withVisionSnapshot(() => [w.visible(crab), w.visible(crab, 'red')]);
  expect(read()).toEqual([false, false]);
  w.tick = SCUTTLER_POLICY.hiddenTicks - 1;
  expect(read()).toEqual([false, false]);
  w.tick++;
  expect(read()).toEqual([true, false]);
});
