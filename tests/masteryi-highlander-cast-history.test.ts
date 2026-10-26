import { advanceSwordGlows } from '../src/simulation/masteryi-sword-glow';
import { expect, test, vi } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { advanceHighlanderCasts } from '../src/simulation/masteryi-highlander-cast';
import { actorRootKnown, actorRootPose } from '../src/simulation/actor-root-history';
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
  w.gainExperience(1e6, yi.id);
  w.learnSpell('r', yi.id);
  const target = w.spawn('dummy', team === 'blue' ? 'red' : 'blue', { x: 300, y: 0 });
  target.hp = target.maxHp = 1e6;
  target.armor = 0;
  const cast = () => {
    w.enqueue({ type: 'cast', unit: yi.id, ability: 'r', point: yi });
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

test('ordinary units do not request Highlander cast state', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
  for (let i = 0; i < 100; i++) w.spawn('dummy', 'red', { x: i, y: 0 });
  const spy = vi.spyOn(w, 'championState');
  advanceHighlanderCasts(w);
  expect(spy).not.toHaveBeenCalled();
});
test('accepted R creates a finite source history without extra RNG or identities', () => {
  const f = fixture(),
    rng = f.w.random.state,
    next = f.w.nextId;
  f.cast();
  expect(f.w.random.state).toBe(rng);
  expect(f.w.nextId).toBe(next + 1);
  expect(f.owner.highlanderCastVisuals[0]).toMatchObject({
    startTick: 1,
    rank: 1,
    origin: { x: 0, y: 0 },
    detachedTick: null,
  });
  f.resume(26);
  expect(f.owner.highlanderCastVisuals).toHaveLength(1);
  f.resume(1);
  expect(f.owner.highlanderCastVisuals).toEqual([]);
  expect(f.owner.highlander).not.toBeNull();
});
test('rejected R creates no visual history', () => {
  const f = fixture();
  f.yi.mana = 0;
  f.cast();
  expect(f.owner.highlanderCastVisuals).toEqual([]);
});
test('moving roots keep accepted origin and exact restored motion', () => {
  const f = fixture();
  f.cast();
  f.w.setOrder(f.yi, { type: 'move', point: { x: 300, y: 200 } });
  f.w.step(7);
  const r = f.owner.highlanderCastVisuals[0];
  expect(r.origin).toEqual({ x: 0, y: 0 });
  expect(actorRootPose(r.frames, f.w.tick)).toMatchObject({ x: f.yi.x, y: f.yi.y });
  expect(f.yi.x).toBeGreaterThan(0);
  f.resume(10);
});
test('R then movement in one batch preserves separate admission and endpoint frames', () => {
  const f = fixture();
  f.w.enqueue({ type: 'cast', unit: f.yi.id, ability: 'r', point: f.yi });
  f.w.enqueue({ type: 'order', unit: f.yi.id, order: { type: 'move', point: { x: 300, y: 200 } } });
  f.w.step();
  const r = f.owner.highlanderCastVisuals[0];
  expect(r.origin).toEqual({ x: 0, y: 0 });
  expect(r.frames.at(-1)).toMatchObject({ x: f.yi.x, y: f.yi.y });
  f.resume(10);
});
test('R admitted while Q hides the body keeps its admission audience but no known birth root', () => {
  const f = fixture();
  f.w.learnSpell('q', f.yi.id);
  f.w.enqueue({
    type: 'cast',
    unit: f.yi.id,
    ability: 'q',
    point: f.target,
    targetId: f.target.id,
  });
  f.w.step();
  f.cast();
  const r = f.owner.highlanderCastVisuals[0];
  expect(r.audience).toContain('blue');
  expect(actorRootKnown(r.frames, f.w.tick, 'blue')).toBe(false);
  f.resume(20);
  expect(r.frames.every((frame) => frame.audience.length === 0)).toBe(true);
});
test('a later Q hides bound endpoints without changing known R creation', () => {
  const f = fixture();
  f.cast();
  f.w.step(3);
  f.w.learnSpell('q', f.yi.id);
  f.w.enqueue({
    type: 'cast',
    unit: f.yi.id,
    ability: 'q',
    point: f.target,
    targetId: f.target.id,
  });
  f.w.step();
  const r = f.owner.highlanderCastVisuals[0];
  expect(r.audience).toContain('blue');
  expect(actorRootKnown(r.frames, f.w.tick, 'blue')).toBe(false);
  f.resume(10);
});
test('W pauses the buff while finite R cast time keeps advancing', () => {
  const f = fixture();
  f.cast();
  f.w.learnSpell('w', f.yi.id);
  f.w.enqueue({ type: 'cast', unit: f.yi.id, ability: 'w', point: f.yi });
  f.w.step();
  f.resume(27);
  expect(f.owner.highlander?.pausedTicks).toBeGreaterThan(0);
  expect(f.owner.highlanderCastVisuals).toEqual([]);
});
test('hidden creation remains distinct from visibility acquired later', () => {
  const f = fixture('red'),
    visible = f.w.visible.bind(f.w);
  f.w.visible = (u, team = 'blue') =>
    u.id === f.yi.id && team === 'blue' ? false : visible(u, team);
  f.cast();
  const r = f.owner.highlanderCastVisuals[0];
  expect(r.audience).toEqual(['red']);
  f.w.visible = visible;
  f.w.step();
  expect(actorRootKnown(r.frames, f.w.tick, 'blue')).toBe(true);
  expect(r.audience).toEqual(['red']);
  f.resume(8);
});
test('death freezes an admitted finite cast and preserves saved future', () => {
  const f = fixture();
  f.cast();
  f.w.step(3);
  f.w.damage(f.target, f.yi, 1e6, 'true');
  const r = f.owner.highlanderCastVisuals[0],
    pose = actorRootPose(r.frames, f.w.tick);
  expect(r.detachedTick).toBe(f.w.tick);
  f.yi.x = 900;
  advanceSwordGlows(f.w);
  f.resume(10);
  expect(actorRootPose(r.frames, f.w.tick)).toEqual(pose);
});
test('victory leaves a valid cast tail without advancing the world', () => {
  const f = fixture();
  f.cast();
  f.w.step(3);
  const nexus = f.w.spawn('nexus', 'red', { x: 1000, y: 1000 });
  f.w.damage(f.yi, nexus, 1e6, 'true');
  const tick = f.w.tick;
  f.resume(60);
  expect(f.w.tick).toBe(tick);
  expect(f.owner.highlanderCastVisuals).toHaveLength(1);
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
])('decoder rejects %s Highlander cast history', (kind) => {
  const f = fixture();
  f.cast();
  f.w.step(4);
  const data = JSON.parse(f.w.snapshot()),
    owner = data.otherChampions.find((o: any) => o.id === f.yi.id),
    r = owner.highlanderCastVisuals[0];
  switch (kind) {
    case 'missing':
      owner.highlanderCastVisuals = [];
      break;
    case 'duplicate':
      owner.highlanderCastVisuals.push(structuredClone(r));
      break;
    case 'foreign':
      data.player.highlanderCastVisuals = [r];
      break;
    case 'future':
      r.startTick = data.tick + 1;
      break;
    case 'rank':
      r.rank = 3;
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
