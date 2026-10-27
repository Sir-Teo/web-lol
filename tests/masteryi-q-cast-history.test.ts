import { expect, test, vi } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { advanceAlphaCasts } from '../src/simulation/masteryi-q-cast';
import { actorRootKnown } from '../src/simulation/actor-root-history';
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
  w.learnSpell('q', yi.id);
  const target = w.spawn('dummy', team === 'blue' ? 'red' : 'blue', { x: 300, y: 0 });
  target.hp = target.maxHp = 1e6;
  target.armor = 0;
  const cast = () => {
    w.enqueue({ type: 'cast', unit: yi.id, ability: 'q', point: target, targetId: target.id });
    w.step();
  };
  const resume = (ticks: number) => {
    const saved = w.snapshot(),
      copy = World.fromSnapshot(saved, w.battlefield);
    expect(copy.snapshot()).toBe(saved);
    w.step(ticks);
    copy.step(ticks);
    expect(copy.snapshot()).toBe(w.snapshot());
  };
  return { w, yi, owner, target, cast, resume };
}

test('ordinary units never request Yi cast presentation state', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
  for (let i = 0; i < 100; i++) w.spawn('dummy', 'red', { x: 300 + i, y: 0 });
  const spy = vi.spyOn(w, 'championState');
  advanceAlphaCasts(w);
  expect(spy).not.toHaveBeenCalled();
});
test('accepted Q keeps cast visibility while body is vanished, without additional RNG or IDs', () => {
  const f = fixture(),
    rng = f.w.random.state,
    next = f.w.nextId;
  f.cast();
  expect(f.owner.alphaStrike?.reappearTick).toBeNull();
  expect(f.w.random.state).toBe(rng);
  expect(f.w.nextId).toBe(next + 1);
  const r = f.owner.alphaCastVisuals[0];
  expect(r).toMatchObject({ startTick: 1, rank: 1, origin: { x: 0, y: 0 }, detachedTick: null });
  expect(actorRootKnown(r.frames, 1, 'blue')).toBe(true);
  f.resume(7);
  expect(r.frames.at(-1)!.endTick).toBe(f.w.tick);
  f.resume(7);
  expect(f.owner.alphaCastVisuals).toHaveLength(1);
  f.resume(1);
  expect(f.owner.alphaCastVisuals).toEqual([]);
});
test('rejected Q creates no cast system', () => {
  const f = fixture();
  f.yi.mana = 0;
  f.cast();
  expect(f.owner.alphaCastVisuals).toEqual([]);
});
test('creation audience remains distinct from later vision', () => {
  const f = fixture('red'),
    visible = f.w.visible.bind(f.w);
  f.w.visible = (u, team = 'blue') =>
    u.id === f.yi.id && team === 'blue' ? false : visible(u, team);
  f.cast();
  const r = f.owner.alphaCastVisuals[0];
  expect(r.audience).toEqual(['red']);
  f.w.visible = visible;
  f.w.step();
  expect(r.audience).toEqual(['red']);
  expect(actorRootKnown(r.frames, f.w.tick, 'blue')).toBe(true);
  f.resume(8);
});
test('caster death freezes finite root history and preserves an exact restored future', () => {
  const f = fixture();
  f.cast();
  f.w.step(3);
  f.w.damage(f.target, f.yi, 1e6, 'true');
  const r = f.owner.alphaCastVisuals[0];
  expect(r.detachedTick).toBe(f.w.tick);
  f.yi.x = 900;
  f.resume(8);
  expect(r.frames.every((p) => p.x === 0)).toBe(true);
});
test('victory freezes a valid cast history without advancing the simulation', () => {
  const f = fixture();
  f.cast();
  f.w.step(3);
  const nexus = f.w.spawn('nexus', 'red', { x: 1000, y: 1000 });
  f.w.damage(f.yi, nexus, 1e6, 'true');
  const tick = f.w.tick;
  f.resume(40);
  expect(f.w.tick).toBe(tick);
  expect(f.owner.alphaCastVisuals).toHaveLength(1);
});
test.each([
  'missing',
  'duplicate',
  'foreign',
  'future',
  'rank',
  'origin',
  'audience',
  'frame-gap',
  'endpoint',
  'detached',
  'unknown',
])('decoder rejects %s cast history', (kind) => {
  const f = fixture();
  f.cast();
  f.w.step(3);
  const data = JSON.parse(f.w.snapshot()),
    owner = data.otherChampions.find((o: any) => o.id === f.yi.id),
    r = owner.alphaCastVisuals[0];
  switch (kind) {
    case 'missing':
      owner.alphaCastVisuals = [];
      break;
    case 'duplicate':
      owner.alphaCastVisuals.push(structuredClone(r));
      break;
    case 'foreign':
      data.player.alphaCastVisuals = [r];
      break;
    case 'future':
      r.startTick = data.tick + 1;
      break;
    case 'rank':
      r.rank = 5;
      break;
    case 'origin':
      r.origin.x++;
      break;
    case 'audience':
      r.audience = ['red'];
      break;
    case 'frame-gap':
      r.frames[0].tick++;
      break;
    case 'endpoint':
      r.frames.at(-1).x++;
      break;
    case 'detached':
      r.detachedTick = data.tick;
      break;
    case 'unknown':
      r.nativeCertified = true;
      break;
  }
  expect(() => World.fromSnapshot(JSON.stringify(data), f.w.battlefield)).toThrow();
});
