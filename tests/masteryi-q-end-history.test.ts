import { expect, test, vi } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { advanceAlphaEnds } from '../src/simulation/masteryi-q-end';
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

test('ordinary units never request Yi reappearance state', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
  for (let i = 0; i < 100; i++) w.spawn('dummy', 'red', { x: 300 + i, y: 0 });
  const spy = vi.spyOn(w, 'championState');
  advanceAlphaEnds(w);
  expect(spy).not.toHaveBeenCalled();
});
test('complete Q creates one reappearance system at its actual return root and restores its exact future', () => {
  const f = fixture();
  f.cast();
  f.w.step(55);
  expect(f.owner.alphaEndVisuals).toEqual([]);
  f.resume(1);
  const r = f.owner.alphaEndVisuals[0];
  expect(r).toMatchObject({
    castTick: 1,
    startTick: 57,
    rank: 1,
    markCount: 4,
    stopReason: 'complete',
    point: f.owner.alphaStrike!.returnPoint,
    detachedTick: null,
  });
  expect(r.point).not.toEqual({ x: 0, y: 0 });
  expect(actorRootKnown(r.frames, 57, 'blue')).toBe(true);
  f.resume(10);
  expect(f.owner.alphaStrike).toBeNull();
  expect(f.owner.alphaEndVisuals).toHaveLength(1);
  f.resume(7);
  expect(f.owner.alphaEndVisuals).toHaveLength(1);
  f.resume(1);
  expect(f.owner.alphaEndVisuals).toEqual([]);
});
test('lost primary returns to origin at the first failed mark without new damage, RNG or IDs', () => {
  const f = fixture();
  f.cast();
  f.target.x = f.target.previous.x = 5000;
  f.w.step(13);
  const next = f.w.nextId,
    rng = f.w.random.state;
  f.w.step();
  expect(f.w.nextId).toBe(next);
  expect(f.w.random.state).toBe(rng);
  expect(f.owner.alphaEndVisuals[0]).toMatchObject({
    castTick: 1,
    startTick: 15,
    markCount: 0,
    stopReason: 'lost',
    point: { x: 0, y: 0 },
  });
  f.resume(18);
});
test('later target loss records the actual failed-mark clock and mark count', () => {
  const f = fixture();
  f.cast();
  f.w.step(14);
  f.target.x = f.target.previous.x = 5000;
  f.w.step(14);
  expect(f.owner.alphaEndVisuals[0]).toMatchObject({
    startTick: 29,
    markCount: 1,
    stopReason: 'lost',
  });
  f.resume(12);
});
test.each(['death', 'victory'] as const)(
  'vanished %s cancellation creates no reappearance system',
  (reason) => {
    const f = fixture();
    f.cast();
    f.w.step(3);
    if (reason === 'death') f.w.damage(f.target, f.yi, 1e6, 'true');
    else {
      const nexus = f.w.spawn('nexus', 'red', { x: 1000, y: 1000 });
      f.w.damage(f.yi, nexus, 1e6, 'true');
    }
    expect(f.owner.alphaStrike).toBeNull();
    expect(f.owner.alphaEndVisuals).toEqual([]);
    f.resume(30);
  }
);
test('post-return movement keeps exact root endpoints after Q recovery clears', () => {
  const f = fixture();
  f.cast();
  f.w.step(56);
  const r = f.owner.alphaEndVisuals[0],
    point = { ...r.point };
  f.w.setOrder(f.yi, { type: 'move', point: { x: 700, y: 300 } });
  f.w.step(13);
  expect(f.owner.alphaStrike).toBeNull();
  expect(r.point).toEqual(point);
  expect(actorRootPose(r.frames, f.w.tick)).toMatchObject({ x: f.yi.x, y: f.yi.y });
  expect(actorRootPose(r.frames, f.w.tick)).not.toMatchObject(point);
  f.resume(4);
});
test('known reappearance freezes on later death and survives its exact saved future', () => {
  const f = fixture();
  f.cast();
  f.w.step(59);
  const r = f.owner.alphaEndVisuals[0],
    point = actorRootPose(r.frames, f.w.tick);
  f.w.damage(f.target, f.yi, 1e6, 'true');
  expect(r.detachedTick).toBe(f.w.tick);
  f.yi.x = 900;
  f.resume(10);
  expect(actorRootPose(r.frames, f.w.tick)).toEqual(point);
});
test('creation visibility remains distinct from visibility acquired later', () => {
  const f = fixture('red');
  f.cast();
  f.w.step(55);
  const visible = f.w.visible.bind(f.w);
  f.w.visible = (u, team = 'blue') =>
    u.id === f.yi.id && team === 'blue' ? false : visible(u, team);
  f.w.step();
  const r = f.owner.alphaEndVisuals[0];
  expect(r.audience).toEqual(['red']);
  f.w.visible = visible;
  f.w.step();
  expect(actorRootKnown(r.frames, f.w.tick, 'blue')).toBe(true);
  expect(r.audience).toEqual(['red']);
  f.resume(10);
});
test('a new Q hides bound reappearance endpoints while its known birth remains retained', () => {
  const f = fixture();
  f.cast();
  f.w.step(66);
  const r = f.owner.alphaEndVisuals[0];
  f.owner.cooldowns.q = f.w.tick;
  f.cast();
  expect(f.owner.alphaStrike?.reappearTick).toBeNull();
  expect(r.audience).toContain('blue');
  expect(actorRootKnown(r.frames, f.w.tick, 'blue')).toBe(false);
  f.resume(5);
});
test('victory retains existing finite return particles without stepping the world', () => {
  const f = fixture();
  f.cast();
  f.w.step(59);
  const nexus = f.w.spawn('nexus', 'red', { x: 1000, y: 1000 });
  f.w.damage(f.yi, nexus, 1e6, 'true');
  const tick = f.w.tick;
  f.resume(100);
  expect(f.w.tick).toBe(tick);
  expect(f.owner.alphaEndVisuals).toHaveLength(1);
});
test.each([
  'missing',
  'duplicate',
  'foreign',
  'future',
  'cast',
  'rank',
  'mark-count',
  'reason',
  'point',
  'audience',
  'frame-gap',
  'endpoint',
  'detached',
  'unknown',
])('decoder rejects %s reappearance history', (kind) => {
  const f = fixture();
  f.cast();
  f.w.step(58);
  const data = JSON.parse(f.w.snapshot()),
    owner = data.otherChampions.find((o: any) => o.id === f.yi.id),
    r = owner.alphaEndVisuals[0];
  switch (kind) {
    case 'missing':
      owner.alphaEndVisuals = [];
      break;
    case 'duplicate':
      owner.alphaEndVisuals.push(structuredClone(r));
      break;
    case 'foreign':
      data.player.alphaEndVisuals = [r];
      break;
    case 'future':
      r.startTick = data.tick + 1;
      break;
    case 'cast':
      r.castTick++;
      break;
    case 'rank':
      r.rank = 5;
      break;
    case 'mark-count':
      r.markCount = 3;
      break;
    case 'reason':
      r.stopReason = 'lost';
      break;
    case 'point':
      r.point.x++;
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

test('decoder retains creation-point consistency after the active Q phase clears', () => {
  const f = fixture();
  f.cast();
  f.w.step(66);
  expect(f.owner.alphaStrike).toBeNull();
  const data = JSON.parse(f.w.snapshot()),
    owner = data.otherChampions.find((o: any) => o.id === f.yi.id);
  owner.alphaEndVisuals[0].point.x++;
  expect(() => World.fromSnapshot(JSON.stringify(data), f.w.battlefield)).toThrow(
    'reappearance history'
  );
});
