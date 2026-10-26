import { expect, test, vi } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { MEDITATE_CAST_HISTORY_TICKS } from '../src/content/masteryi-w-cast-timing';
import { advanceMeditateCasts } from '../src/simulation/masteryi-meditate-cast';

function fixture(team: 'blue' | 'red' = 'blue') {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
  });
  w.nextWaveTick = Infinity;
  const yi = w.spawn('champion', team, { x: 0, y: 0 }, 'masteryi');
  yi.ai = false;
  const owner = w.championState(yi.id)!;
  w.learnSpell('w', yi.id);
  const cast = () => {
    w.enqueue({ type: 'cast', unit: yi.id, ability: 'w', point: yi });
    w.step();
  };
  const resume = (ticks = 80) => {
    const saved = w.snapshot(),
      copy = World.fromSnapshot(saved, w.battlefield);
    expect(copy.snapshot()).toBe(saved);
    w.step(ticks);
    copy.step(ticks);
    expect(copy.snapshot()).toBe(w.snapshot());
  };
  return { w, yi, owner, cast, resume };
}

test('ordinary units never request Yi presentation state', () => {
  const w = new World(false),
    lookup = vi.spyOn(w, 'championState');
  for (let i = 0; i < 100; i++) w.spawn('melee', 'red', { x: 100 + i, y: 100 });
  lookup.mockClear();
  advanceMeditateCasts(w);
  expect(lookup).not.toHaveBeenCalled();
  lookup.mockRestore();
});

test('accepted cast retains its first frame without additional RNG or entity/event IDs', () => {
  const f = fixture(),
    random = f.w.random.state,
    next = f.w.nextId;
  f.cast();
  expect(f.w.random.state).toBe(random);
  expect(f.w.nextId).toBe(next + 1);
  expect(f.owner.meditateCastVisuals).toHaveLength(1);
  expect(f.owner.meditateCastVisuals[0]).toMatchObject({
    startTick: f.w.tick,
    rank: 1,
    audience: ['blue'],
    detachedTick: null,
    frames: [{ tick: f.w.tick, x: 0, y: 0, facing: f.yi.facing }],
  });
  f.resume();
});

test('rejected cast creates no source system', () => {
  const f = fixture();
  f.yi.mana = 39;
  f.cast();
  expect(f.owner.meditateCastVisuals).toEqual([]);
});

test('movement cancellation preserves finite cast frames and exact restored future', () => {
  const f = fixture();
  f.cast();
  f.w.step(4);
  f.w.setOrder(f.yi, { type: 'move', point: { x: 140, y: 90 } });
  f.w.step(12);
  expect(f.owner.meditate?.stopReason).toBe('order');
  const r = f.owner.meditateCastVisuals[0];
  expect(r.frames).toHaveLength(f.w.tick - r.startTick + 1);
  expect(r.frames.at(-1)).toMatchObject({ x: f.yi.x, y: f.yi.y, facing: f.yi.facing });
  expect(r.frames.at(-1)!.x).toBeGreaterThan(r.frames[0].x);
  f.resume();
});

test('cast then movement in the same command batch keeps the endpoint frame and restores', () => {
  const f = fixture();
  f.w.enqueue({ type: 'cast', unit: f.yi.id, ability: 'w', point: f.yi });
  f.w.enqueue({ type: 'order', unit: f.yi.id, order: { type: 'move', point: { x: 200, y: 0 } } });
  f.w.step();
  expect(f.owner.meditate?.stopReason).toBe('order');
  expect(f.owner.meditateCastVisuals[0].frames[0].x).toBe(f.yi.x);
  f.resume();
});

test('creation audience remains separate from later acquired vision', () => {
  const f = fixture('red'),
    visible = f.w.visible.bind(f.w);
  f.w.visible = (unit, team = 'blue') =>
    unit.id === f.yi.id && team === 'blue' ? false : visible(unit, team);
  f.cast();
  expect(f.owner.meditateCastVisuals[0].audience).toEqual(['red']);
  f.w.visible = () => true;
  f.w.step(3);
  expect(f.owner.meditateCastVisuals[0].audience).toEqual(['red']);
  expect(f.owner.meditateCastVisuals[0].frames.at(-1)!.audience).toEqual(['blue', 'red']);
  f.w.visible = visible;
  f.w.step();
  f.resume();
});

test('death detaches once and keeps the saved root/facing frozen until finite cleanup', () => {
  const f = fixture();
  f.cast();
  f.w.step(3);
  const enemy = f.w.spawn('dummy', 'red', { x: 10, y: 0 });
  f.w.damage(enemy, f.yi, 1e9, 'true');
  const r = f.owner.meditateCastVisuals[0],
    frame = structuredClone(r.frames.at(-1)!);
  expect(r.detachedTick).toBe(f.w.tick);
  expect(f.owner.meditate).toBeNull();
  f.yi.x += 10;
  f.yi.facing += 1;
  f.w.step(3);
  expect(r.frames.at(-1)).toEqual({ ...frame, tick: f.w.tick });
  f.resume();
});

test('history expires at its complete source bound while the four-second channel continues', () => {
  const f = fixture();
  f.cast();
  expect(MEDITATE_CAST_HISTORY_TICKS).toBe(55);
  f.w.step(54);
  expect(f.owner.meditateCastVisuals).toHaveLength(1);
  f.w.step();
  expect(f.owner.meditateCastVisuals).toEqual([]);
  expect(f.owner.meditate?.stopTick).toBeNull();
  f.resume();
});

for (const corruption of [
  'future',
  'rank',
  'missing',
  'duplicate',
  'frameGap',
  'endpoint',
  'detach',
  'frozen',
] as const)
  test(`saved ${corruption} presentation history rejects`, () => {
    const f = fixture();
    f.cast();
    f.w.step(4);
    const data = JSON.parse(f.w.snapshot()),
      owner = data.otherChampions.find((s: any) => s.id === f.yi.id),
      record = owner.meditateCastVisuals[0];
    switch (corruption) {
      case 'future':
        record.startTick = data.tick + 1;
        break;
      case 'rank':
        record.rank = 2;
        break;
      case 'missing':
        owner.meditateCastVisuals = [];
        break;
      case 'duplicate':
        owner.meditateCastVisuals.push(structuredClone(record));
        break;
      case 'frameGap':
        record.frames[1].tick++;
        break;
      case 'endpoint':
        record.frames.at(-1).x++;
        break;
      case 'detach':
        record.detachedTick = data.tick;
        break;
      case 'frozen':
        record.frames = [];
        break;
    }
    expect(() => World.fromSnapshot(JSON.stringify(data), f.w.battlefield)).toThrow();
  });
