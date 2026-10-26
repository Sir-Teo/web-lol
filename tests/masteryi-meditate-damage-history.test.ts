import { expect, test, vi } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { advanceMeditateDamage } from '../src/simulation/masteryi-meditate-damage';
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
  w.learnSpell('w', yi.id);
  const owner = w.championState(yi.id)!,
    enemy = w.spawn('dummy', team === 'blue' ? 'red' : 'blue', { x: 100, y: 0 });
  const cast = () => {
    w.enqueue({ type: 'cast', unit: yi.id, ability: 'w', point: yi });
    w.step();
  };
  const hit = (raw = 100, kind: 'physical' | 'magic' | 'true' = 'physical') =>
    w.damage(enemy, yi, raw, kind);
  const resume = (ticks: number) => {
    const saved = w.snapshot(),
      copy = World.fromSnapshot(saved, w.battlefield);
    expect(copy.snapshot()).toBe(saved);
    w.step(ticks);
    copy.step(ticks);
    expect(copy.snapshot()).toBe(w.snapshot());
  };
  return { w, yi, owner, enemy, cast, hit, resume };
}
test('ordinary units do not request Meditate damage state', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
  w.spawn('dummy', 'red', { x: 0, y: 0 });
  const spy = vi.spyOn(w, 'championState');
  advanceMeditateDamage(w);
  expect(spy).not.toHaveBeenCalled();
});
test.each(['physical', 'magic'] as const)(
  '%s damage actually reduced by W admits a finite saved reaction',
  (kind) => {
    const f = fixture();
    f.cast();
    const rng = f.w.random.state;
    f.hit(100, kind);
    expect(f.w.random.state).toBe(rng);
    expect(f.owner.meditateDamageVisuals[0]).toMatchObject({
      castTick: 1,
      tick: 1,
      rank: 1,
      audience: ['blue', 'red'],
      detachedTick: null,
    });
    f.resume(14);
    expect(f.owner.meditateDamageVisuals).toHaveLength(1);
    f.resume(1);
    expect(f.owner.meditateDamageVisuals).toEqual([]);
    expect(f.owner.meditate?.stopTick).toBeNull();
  }
);
test('same-tick positive hits coalesce while later ticks retain independent reactions', () => {
  const f = fixture();
  f.cast();
  f.hit();
  f.hit(30, 'magic');
  expect(f.owner.meditateDamageVisuals).toHaveLength(1);
  f.w.step();
  f.hit();
  expect(f.owner.meditateDamageVisuals.map((r) => r.tick)).toEqual([1, 2]);
  f.resume(10);
});
test.each(['true', 'zero', 'no-W'] as const)('%s damage creates no reaction', (kind) => {
  const f = fixture();
  if (kind !== 'no-W') f.cast();
  f.hit(kind === 'zero' ? 0 : 100, kind === 'true' ? 'true' : 'physical');
  expect(f.owner.meditateDamageVisuals).toEqual([]);
  f.resume(5);
});
test('fully shielded reduced damage still admits one reaction', () => {
  const f = fixture();
  f.cast();
  f.yi.shields.push({ amount: 1000, endTick: f.w.tick + 100, sourceId: f.yi.id });
  const hp = f.yi.hp;
  f.hit();
  expect(f.yi.hp).toBe(hp);
  expect(f.owner.meditateDamageVisuals).toHaveLength(1);
  f.resume(5);
});
test('turret damage uses its existing W reduction and admits the same source system', () => {
  const f = fixture();
  f.cast();
  const turret = f.w.spawn('turret', 'red', { x: 1000, y: 0 });
  f.w.damage(turret, f.yi, 100, 'physical');
  expect(f.owner.meditateDamageVisuals).toHaveLength(1);
  f.resume(5);
});
test('post-interruption linger admits reduced hits and stops exactly at its boundary', () => {
  const f = fixture();
  f.cast();
  f.w.step(30);
  f.w.setOrder(f.yi, { type: 'move', point: { x: 200, y: 0 } });
  f.w.step();
  const stop = f.owner.meditate!.stopTick!;
  f.w.step(stop + 29 - f.w.tick);
  f.hit();
  expect(f.owner.meditateDamageVisuals.at(-1)?.tick).toBe(stop + 29);
  f.resume(1);
  f.hit();
  expect(f.owner.meditate).toBeNull();
  expect(f.owner.meditateDamageVisuals).toHaveLength(1);
  f.resume(14);
  expect(f.owner.meditateDamageVisuals).toEqual([]);
});
test('moving roots after interruption keep exact saved poses', () => {
  const f = fixture();
  f.cast();
  f.w.setOrder(f.yi, { type: 'move', point: { x: 300, y: 200 } });
  f.w.step();
  f.hit();
  f.w.step(4);
  const r = f.owner.meditateDamageVisuals[0];
  expect(actorRootPose(r.frames, f.w.tick)).toMatchObject({ x: f.yi.x, y: f.yi.y });
  expect(f.yi.x).toBeGreaterThan(0);
  f.resume(7);
});
test('lethal reduced damage freezes its newly admitted root and restores', () => {
  const f = fixture();
  f.cast();
  f.hit(1e9);
  expect(f.yi.hp).toBe(0);
  const r = f.owner.meditateDamageVisuals[0],
    pose = actorRootPose(r.frames, f.w.tick);
  expect(r.detachedTick).toBe(f.w.tick);
  f.yi.x = 900;
  f.resume(10);
  expect(actorRootPose(r.frames, f.w.tick)).toEqual(pose);
});
test('victory preserves a valid finite tail without stepping the world', () => {
  const f = fixture();
  f.cast();
  f.hit();
  f.w.step(2);
  const nexus = f.w.spawn('nexus', 'red', { x: 1000, y: 1000 });
  f.w.damage(f.yi, nexus, 1e9, 'true');
  const tick = f.w.tick;
  f.resume(50);
  expect(f.w.tick).toBe(tick);
  expect(f.owner.meditateDamageVisuals).toHaveLength(1);
});
test('hidden admission stays separate from subsequently acquired root visibility', () => {
  const f = fixture('red'),
    visible = f.w.visible.bind(f.w);
  f.w.visible = (u, t = 'blue') => (u.id === f.yi.id && t === 'blue' ? false : visible(u, t));
  f.cast();
  f.hit();
  const r = f.owner.meditateDamageVisuals[0];
  expect(r.audience).toEqual(['red']);
  f.w.visible = visible;
  f.w.step();
  expect(actorRootKnown(r.frames, f.w.tick, 'blue')).toBe(true);
  expect(r.audience).toEqual(['red']);
  f.resume(5);
});
test('Q accepted after a linger hit hides subsequent birth frames without discarding admission', () => {
  const f = fixture();
  f.w.gainExperience(1e6, f.yi.id);
  f.w.learnSpell('q', f.yi.id);
  f.cast();
  f.w.setOrder(f.yi, { type: 'move', point: { x: 30, y: 0 } });
  f.w.step();
  f.hit();
  f.enemy.hp = f.enemy.maxHp = 1e6;
  f.w.enqueue({ type: 'cast', unit: f.yi.id, ability: 'q', point: f.enemy, targetId: f.enemy.id });
  f.w.step();
  const r = f.owner.meditateDamageVisuals[0];
  expect(r.audience).toContain('blue');
  expect(actorRootKnown(r.frames, f.w.tick, 'blue')).toBe(false);
  f.resume(10);
});
test.each([
  'duplicate',
  'foreign',
  'future',
  'cast',
  'rank',
  'audience',
  'frame-gap',
  'endpoint',
  'detach',
  'unknown',
  'expired',
])('decoder rejects %s damage history', (kind) => {
  const f = fixture();
  f.cast();
  f.hit();
  f.w.step(4);
  const data = JSON.parse(f.w.snapshot()),
    o = data.otherChampions.find((o: any) => o.id === f.yi.id),
    r = o.meditateDamageVisuals[0];
  switch (kind) {
    case 'duplicate':
      o.meditateDamageVisuals.push(structuredClone(r));
      break;
    case 'foreign':
      data.player.meditateDamageVisuals = [r];
      break;
    case 'future':
      r.tick = data.tick + 1;
      break;
    case 'cast':
      r.castTick++;
      break;
    case 'rank':
      r.rank = 5;
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
    case 'detach':
      r.detachedTick = data.tick;
      break;
    case 'unknown':
      r.unexpected = true;
      break;
    case 'expired':
      r.tick = 0;
      r.castTick = 0;
      data.tick = 15;
      break;
  }
  expect(() => World.fromSnapshot(JSON.stringify(data), f.w.battlefield)).toThrow();
});
