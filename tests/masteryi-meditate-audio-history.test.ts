import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { masterYiWStates } from '../src/audio/masteryi-w-state';
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

const record = (f: ReturnType<typeof fixture>) => f.owner.meditateAudio[0];
const states = (f: ReturnType<typeof fixture>, tick = f.w.tick) =>
  masterYiWStates(
    f.owner.meditateAudio.map((r) => ({
      ...r,
      id: f.yi.id,
      x: f.yi.x,
      y: f.yi.y,
      castVisible: r.castAudience.includes('blue'),
      stopVisible: r.stop?.audience.includes('blue') ?? false,
    })),
    tick
  );
test('accepted W retains a separate finite cast history without extra RNG or IDs', () => {
  const f = fixture(),
    rng = f.w.random.state,
    next = f.w.nextId;
  f.cast();
  expect(f.w.random.state).toBe(rng);
  expect(f.w.nextId).toBe(next + 1);
  expect(record(f)).toMatchObject({
    startTick: f.w.tick,
    endTick: f.w.tick + 240,
    rank: 1,
    origin: { x: 0, y: 0 },
    castAudience: ['blue'],
    stop: null,
  });
  expect(states(f)).toMatchObject([{ profileIndex: 0, offset: 0, playbackRate: 1 }]);
  f.resume();
});
test('rejected W admits no audio', () => {
  const f = fixture();
  f.yi.mana = 39;
  f.cast();
  expect(f.owner.meditateAudio).toEqual([]);
});
test('cast recording ends independently while its channel remains active and restorable', () => {
  const f = fixture();
  f.cast();
  f.w.step(151);
  expect(states(f)).toEqual([]);
  expect(record(f).stop).toBeNull();
  expect(f.owner.meditate?.stopTick).toBeNull();
  f.resume(20);
});
for (const reason of ['order', 'control', 'mana', 'complete'] as const)
  test(`${reason} captures one living ending at the actual stop`, () => {
    const f = fixture();
    f.cast();
    f.w.step(8);
    if (reason === 'order') {
      f.w.setOrder(f.yi, { type: 'move', point: { x: 100, y: 50 } });
    } else if (reason === 'control') {
      f.w.applySilence(f.yi, 20);
    } else if (reason === 'mana') {
      f.yi.mana = 0;
      f.w.step();
    } else f.w.step(232);
    const r = record(f);
    expect(r.stop?.reason).toBe(reason);
    expect(r.stop?.tick).toBe(f.w.tick);
    expect(states(f).some((s) => s.profileIndex === 1 && s.offset === 0)).toBe(true);
    f.w.step();
    expect(record(f).stop).toEqual(r.stop);
    f.resume(40);
  });
test('same-batch movement captures the stop before the actor moves', () => {
  const f = fixture();
  f.w.enqueue({ type: 'cast', unit: f.yi.id, ability: 'w', point: f.yi });
  f.w.enqueue({ type: 'order', unit: f.yi.id, order: { type: 'move', point: { x: 100, y: 0 } } });
  f.w.step();
  expect(record(f).origin).toEqual({ x: 0, y: 0 });
  expect(record(f).stop?.point).toEqual({ x: 0, y: 0 });
  expect(f.yi.x).toBeGreaterThan(0);
  f.resume();
});
test('ending remains audible and exactly restorable after both particle histories expire', () => {
  const f = fixture();
  f.cast();
  f.w.step(240 + 121);
  expect(f.owner.meditate).toBeNull();
  expect(f.owner.meditateCastVisuals).toEqual([]);
  expect(f.owner.meditateBuffVisuals).toEqual([]);
  expect(states(f)).toMatchObject([{ profileIndex: 1, offset: 121 / 60 }]);
  f.resume(33);
  expect(f.owner.meditateAudio).toHaveLength(1);
  f.w.step();
  expect(f.owner.meditateAudio).toEqual([]);
});
test('death preserves the finite cast without inventing an ending callback', () => {
  const f = fixture();
  f.cast();
  f.w.step(30);
  const enemy = f.w.spawn('dummy', 'red', { x: 10, y: 0 });
  f.w.damage(enemy, f.yi, 1e9, 'true');
  expect(record(f).stop?.reason).toBe('death');
  expect(states(f).map((s) => s.profileIndex)).toEqual([0]);
  f.resume(80);
});
test('victory closes history without an ending and restores a frozen world', () => {
  const f = fixture();
  f.cast();
  f.w.step(30);
  const enemy = f.w.spawn('dummy', 'red', { x: 10, y: 0 }),
    nexus = f.w.spawn('nexus', 'blue', { x: 1000, y: 1000 });
  f.w.damage(enemy, nexus, 1e9, 'true');
  expect(record(f).stop?.reason).toBe('victory');
  expect(states(f).map((s) => s.profileIndex)).toEqual([0]);
  expect(states(f, f.w.tick + 160)).toEqual([]);
  f.resume(80);
});
test('ending audience is captured separately from an unseen cast', () => {
  const f = fixture('red'),
    visible = f.w.visible.bind(f.w);
  f.w.visible = (u, t = 'blue') => (u.id === f.yi.id && t === 'blue' ? false : visible(u, t));
  f.cast();
  expect(record(f).castAudience).toEqual(['red']);
  f.w.visible = () => true;
  f.w.step(5);
  f.w.setOrder(f.yi, { type: 'idle' });
  expect(record(f).stop?.audience).toEqual(['blue', 'red']);
  expect(states(f).map((s) => s.profileIndex)).toEqual([1]);
  f.w.visible = visible;
  f.w.step();
  f.resume(40);
});
test('recast retains independent onset/ending roots and exact future', () => {
  const f = fixture();
  f.cast();
  f.w.step(8);
  f.w.setOrder(f.yi, { type: 'idle' });
  f.w.step();
  f.owner.cooldowns.w = f.w.tick;
  f.yi.mana = f.yi.maxMana;
  f.cast();
  expect(f.owner.meditateAudio).toHaveLength(2);
  expect(record(f).stop?.reason).toBe('order');
  expect(f.owner.meditateAudio[1].stop).toBeNull();
  f.resume(80);
});
for (const corruption of [
  'missing',
  'duplicate',
  'future',
  'rank',
  'end',
  'completeEarly',
  'stopFuture',
  'audience',
  'visualAudience',
] as const)
  test(`saved W audio ${corruption} rejects`, () => {
    const f = fixture();
    f.cast();
    f.w.step(4);
    const saved = JSON.parse(f.w.snapshot()),
      owner = saved.otherChampions.find((r: any) => r.id === f.yi.id),
      r = owner.meditateAudio[0];
    switch (corruption) {
      case 'missing':
        owner.meditateAudio = [];
        break;
      case 'duplicate':
        owner.meditateAudio.push(structuredClone(r));
        break;
      case 'future':
        r.startTick = saved.tick + 1;
        break;
      case 'rank':
        r.rank = 2;
        break;
      case 'end':
        r.endTick++;
        break;
      case 'completeEarly':
        r.stop = {
          tick: saved.tick,
          reason: 'complete',
          point: r.origin,
          audience: r.castAudience,
        };
        break;
      case 'stopFuture':
        r.stop = {
          tick: saved.tick + 1,
          reason: 'order',
          point: r.origin,
          audience: r.castAudience,
        };
        break;
      case 'audience':
        r.castAudience = [];
        break;
      case 'visualAudience':
        r.castAudience = ['blue', 'red'];
        break;
    }
    expect(() => World.fromSnapshot(JSON.stringify(saved), f.w.battlefield)).toThrow();
  });
