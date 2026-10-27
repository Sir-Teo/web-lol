import { expect, test, vi } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { MEDITATE_BUFF_TAIL_TICKS } from '../src/content/masteryi-w-buff-timing';
import { advanceMeditateBuffs } from '../src/simulation/masteryi-meditate-buff';

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
  advanceMeditateBuffs(w);
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
  expect(f.owner.meditateBuffVisuals).toHaveLength(1);
  expect(f.owner.meditateBuffVisuals[0]).toMatchObject({
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
  expect(f.owner.meditateBuffVisuals).toEqual([]);
});

test('movement cancellation preserves finite cast frames and exact restored future', () => {
  const f = fixture();
  f.cast();
  f.w.step(4);
  f.w.setOrder(f.yi, { type: 'move', point: { x: 140, y: 90 } });
  f.w.step(12);
  expect(f.owner.meditate?.stopReason).toBe('order');
  const r = f.owner.meditateBuffVisuals[0];
  expect(r.frames.at(-1)!.endTick).toBe(f.w.tick);
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
  expect(f.owner.meditateBuffVisuals[0].frames[0].x).toBe(f.yi.x);
  f.resume();
});

test('creation audience remains separate from later acquired vision', () => {
  const f = fixture('red'),
    visible = f.w.visible.bind(f.w);
  f.w.visible = (unit, team = 'blue') =>
    unit.id === f.yi.id && team === 'blue' ? false : visible(unit, team);
  f.cast();
  expect(f.owner.meditateBuffVisuals[0].audience).toEqual(['red']);
  f.w.visible = () => true;
  f.w.step(3);
  expect(f.owner.meditateBuffVisuals[0].audience).toEqual(['red']);
  expect(f.owner.meditateBuffVisuals[0].frames.at(-1)!.audience).toEqual(['blue', 'red']);
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
  const r = f.owner.meditateBuffVisuals[0],
    frame = structuredClone(r.frames.at(-1)!);
  expect(r.detachedTick).toBe(f.w.tick);
  expect(f.owner.meditate).toBeNull();
  f.yi.x += 10;
  f.yi.facing += 1;
  f.w.step(3);
  expect(r.frames.at(-1)).toEqual({ ...frame, endTick: f.w.tick });
  f.resume();
});

test('stationary channel stores one exact root run through natural completion and tail expiry', () => {
  const f = fixture();
  f.cast();
  f.w.step(135);
  const r = f.owner.meditateBuffVisuals[0];
  expect(r.frames).toHaveLength(1);
  expect(r.frames[0].endTick).toBe(f.w.tick);
  f.resume(105);
  expect(r.stopReason).toBe('complete');
  expect(r.stopTick).toBe(r.endTick);
  f.w.step(MEDITATE_BUFF_TAIL_TICKS - 1);
  expect(f.owner.meditateBuffVisuals).toHaveLength(1);
  f.w.step();
  expect(f.owner.meditateBuffVisuals).toEqual([]);
  f.resume();
});

test.each(['mana', 'control'] as const)(
  '%s cancellation caps emission and restores its finite tail',
  (reason) => {
    const f = fixture();
    f.cast();
    f.w.step(12);
    if (reason === 'mana') f.yi.mana = 0;
    else f.yi.stunUntil = f.w.tick + 20;
    f.w.step();
    const r = f.owner.meditateBuffVisuals[0];
    expect(r.stopReason).toBe(reason);
    expect(r.stopTick).toBe(f.w.tick);
    f.resume(20);
    f.w.step(MEDITATE_BUFF_TAIL_TICKS - 20);
    expect(f.owner.meditateBuffVisuals).toEqual([]);
  }
);

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
      record = owner.meditateBuffVisuals[0];
    switch (corruption) {
      case 'future':
        record.startTick = data.tick + 1;
        break;
      case 'rank':
        record.rank = 2;
        break;
      case 'missing':
        owner.meditateBuffVisuals = [];
        break;
      case 'duplicate':
        owner.meditateBuffVisuals.push(structuredClone(record));
        break;
      case 'frameGap':
        record.frames[0].endTick--;
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

test('a second accepted W keeps the previous finite tail with independent clocks', () => {
  const f = fixture();
  f.cast();
  f.w.step(10);
  f.w.setOrder(f.yi, { type: 'move', point: { x: 90, y: 0 } });
  f.w.step(5);
  const first = f.owner.meditateBuffVisuals[0];
  f.owner.cooldowns.w = f.w.tick;
  f.yi.mana = f.yi.maxMana;
  f.cast();
  const second = f.owner.meditateBuffVisuals[1];
  expect(first.stopReason).toBe('order');
  expect(second.stopTick).toBeNull();
  expect(second.startTick).toBeGreaterThan(first.startTick);
  f.resume(40);
});
test('victory closes active emission and preserves an exact frozen checkpoint', () => {
  const f = fixture();
  f.cast();
  f.w.step(80);
  const enemy = f.w.spawn('dummy', 'red', { x: 10, y: 0 }),
    nexus = f.w.spawn('nexus', 'blue', { x: 1000, y: 1000 });
  f.w.damage(enemy, nexus, 1e9, 'true');
  const r = f.owner.meditateBuffVisuals[0];
  expect(r.stopReason).toBe('victory');
  expect(r.stopTick).toBe(f.w.tick);
  expect(f.owner.meditate).toBeNull();
  f.resume(40);
});
for (const corruption of [
  'stopPair',
  'stopFuture',
  'completeEarly',
  'end',
  'canonical',
  'coverage',
] as const)
  test(`saved buff ${corruption} rejects`, () => {
    const f = fixture();
    f.cast();
    f.w.step(5);
    const saved = JSON.parse(f.w.snapshot()),
      owner = saved.otherChampions.find((s: any) => s.id === f.yi.id),
      record = owner.meditateBuffVisuals[0];
    switch (corruption) {
      case 'stopPair':
        record.stopReason = 'order';
        break;
      case 'stopFuture':
        record.stopReason = 'order';
        record.stopTick = saved.tick + 1;
        break;
      case 'completeEarly':
        record.stopReason = 'complete';
        record.stopTick = saved.tick;
        break;
      case 'end':
        record.endTick++;
        break;
      case 'canonical': {
        const run = record.frames[0];
        run.endTick--;
        record.frames.push({ ...run, tick: saved.tick, endTick: saved.tick });
        break;
      }
      case 'coverage':
        record.frames[0].tick++;
        break;
    }
    expect(() => World.fromSnapshot(JSON.stringify(saved), f.w.battlefield)).toThrow();
  });
