import { expect, test, vi } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { advanceSwordGlows } from '../src/simulation/masteryi-sword-glow';
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
  w.gainExperience(1e6, yi.id);
  for (const a of ['e', 'r', 'q', 'w'] as const) w.learnSpell(a, yi.id);
  const owner = w.championState(yi.id)!;
  const cast = (a: 'e' | 'r' | 'w') => {
    w.enqueue({ type: 'cast', unit: yi.id, ability: a, point: yi });
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
  return { w, yi, owner, cast, resume };
}
test('ordinary units do not request sword state', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
  w.spawn('dummy', 'red', { x: 0, y: 0 });
  const spy = vi.spyOn(w, 'championState');
  advanceSwordGlows(w);
  expect(spy).not.toHaveBeenCalled();
});
test.each([
  ['e', 0],
  ['r', 1],
] as const)(
  '%s admission follows the matching authored condition with bounded exact history',
  (ability, condition) => {
    const f = fixture(),
      rng = f.w.random.state,
      next = f.w.nextId;
    f.cast(ability);
    expect(f.w.random.state).toBe(rng);
    expect(f.w.nextId).toBe(next + 1);
    expect(f.owner.swordGlowVisuals[0]).toMatchObject({ condition, castTick: 1 });
    f.w.step(150);
    const r = f.owner.swordGlowVisuals[0];
    expect(r.frames[0].tick).toBe(f.w.tick - 61);
    expect(r.frames.at(-1)!.endTick).toBe(f.w.tick);
    expect(r.frames).toHaveLength(1);
    f.resume(50);
  }
);
test('R then E in one command batch retains two canonically ordered conditions', () => {
  const f = fixture();
  for (const ability of ['r', 'e'] as const)
    f.w.enqueue({ type: 'cast', unit: f.yi.id, ability, point: f.yi });
  f.w.step();
  expect(f.owner.swordGlowVisuals.map((r) => [r.condition, r.castTick])).toEqual([
    [0, 1],
    [1, 1],
  ]);
  f.resume(80);
});
test('moving roots retain only the exact rolling birth window', () => {
  const f = fixture();
  f.cast('r');
  f.w.setOrder(f.yi, { type: 'move', point: { x: 3000, y: 2000 } });
  f.w.step(100);
  const r = f.owner.swordGlowVisuals[0];
  expect(r.frames).toHaveLength(62);
  expect(r.frames[0].tick).toBe(40);
  expect(r.frames.at(-1)).toMatchObject({
    x: f.yi.x,
    y: f.yi.y,
    facing: f.yi.facing,
    endTick: 101,
  });
  f.resume(30);
  expect(r.frames).toHaveLength(62);
});
test('Q hides births while buff pauses extend the lifecycle', () => {
  const f = fixture();
  f.cast('e');
  f.cast('r');
  const target = f.w.spawn('dummy', 'red', { x: 300, y: 0 });
  target.hp = target.maxHp = 1e6;
  f.w.enqueue({ type: 'cast', unit: f.yi.id, ability: 'q', point: target, targetId: target.id });
  f.w.step();
  expect(f.owner.swordGlowVisuals.every((r) => !actorRootKnown(r.frames, f.w.tick, 'blue'))).toBe(
    true
  );
  f.resume(70);
  expect(f.owner.wujuStyle!.pausedTicks).toBeGreaterThan(0);
  expect(f.owner.highlander!.pausedTicks).toBeGreaterThan(0);
  expect(f.owner.swordGlowVisuals.every((r) => actorRootKnown(r.frames, f.w.tick, 'blue'))).toBe(
    true
  );
});
test('W pause retains both source conditions without recreating admission', () => {
  const f = fixture();
  f.cast('e');
  f.cast('r');
  const keys = f.owner.swordGlowVisuals.map((r) => [r.condition, r.castTick]);
  f.cast('w');
  f.resume(140);
  expect(f.owner.swordGlowVisuals.map((r) => [r.condition, r.castTick])).toEqual(keys);
  expect(f.owner.wujuStyle!.pausedTicks).toBeGreaterThan(0);
});
test('R extension retains its original source admission and bounded window', () => {
  const f = fixture();
  f.cast('r');
  f.w.step(200);
  const victim = f.w.spawn('champion', 'red', { x: 400, y: 0 }, 'lux');
  victim.ai = false;
  f.w.damage(f.yi, victim, 1e9, 'true');
  f.resume(100);
  expect(f.owner.swordGlowVisuals).toHaveLength(1);
  expect(f.owner.swordGlowVisuals[0].castTick).toBe(1);
  expect(f.owner.swordGlowVisuals[0].frames[0].tick).toBe(f.w.tick - 61);
});
test('natural E removal retains exactly the finite 62-tick visibility tail', () => {
  const f = fixture();
  f.cast('e');
  f.w.step(300);
  expect(f.owner.wujuStyle).toBeNull();
  expect(f.owner.swordGlowVisuals).toHaveLength(1);
  f.resume(61);
  expect(f.owner.swordGlowVisuals).toHaveLength(1);
  f.resume(1);
  expect(f.owner.swordGlowVisuals).toEqual([]);
});
test('death retains bone-bound tail history through current corpse poses, then expires', () => {
  const f = fixture();
  f.cast('e');
  f.cast('r');
  const target = f.w.spawn('dummy', 'red', { x: 300, y: 0 });
  f.w.step(5);
  f.w.damage(target, f.yi, 1e9, 'true');
  const death = f.w.tick;
  f.yi.x = 700;
  advanceSwordGlows(f.w);
  f.resume(30);
  expect(f.owner.swordGlowVisuals.every((r) => r.frames.at(-1)!.x === 700)).toBe(true);
  f.resume(death + 62 - f.w.tick);
  expect(f.owner.swordGlowVisuals).toEqual([]);
});
test('victory preserves valid finite tail histories on the frozen world clock', () => {
  const f = fixture();
  f.cast('e');
  f.cast('r');
  const nexus = f.w.spawn('nexus', 'red', { x: 1000, y: 1000 });
  f.w.damage(f.yi, nexus, 1e9, 'true');
  const tick = f.w.tick;
  f.resume(100);
  expect(f.w.tick).toBe(tick);
  expect(f.owner.swordGlowVisuals).toHaveLength(2);
});
test('hidden creation permits later known births without rewriting earlier visibility', () => {
  const f = fixture('red'),
    visible = f.w.visible.bind(f.w);
  f.w.visible = (u, t = 'blue') => (u.id === f.yi.id && t === 'blue' ? false : visible(u, t));
  const observer = f.w.spawn('champion', 'blue', { x: 100, y: 0 }, 'lux');
  observer.ai = false;
  f.cast('e');
  const r = f.owner.swordGlowVisuals[0];
  f.w.step(3);
  expect(actorRootKnown(r.frames, 2, 'blue')).toBe(false);
  f.w.visible = visible;
  f.w.step();
  expect(actorRootKnown(r.frames, 5, 'blue')).toBe(true);
  expect(actorRootKnown(r.frames, 2, 'blue')).toBe(false);
  f.resume(10);
});
test.each([
  'missing',
  'duplicate',
  'foreign',
  'future',
  'condition',
  'frame-gap',
  'old-prefix',
  'endpoint',
  'audience',
  'unknown',
])('decoder rejects %s sword history', (kind) => {
  const f = fixture();
  f.cast('e');
  f.w.step(80);
  const d = JSON.parse(f.w.snapshot()),
    o = d.otherChampions.find((o: any) => o.id === f.yi.id),
    r = o.swordGlowVisuals[0];
  switch (kind) {
    case 'missing':
      o.swordGlowVisuals = [];
      break;
    case 'duplicate':
      o.swordGlowVisuals.push(structuredClone(r));
      break;
    case 'foreign':
      d.player.swordGlowVisuals = [r];
      break;
    case 'future':
      r.castTick = d.tick + 1;
      break;
    case 'condition':
      r.condition = 1;
      break;
    case 'frame-gap':
      r.frames[0].tick++;
      break;
    case 'old-prefix':
      r.frames[0].tick = 1;
      break;
    case 'endpoint':
      r.frames.at(-1).x++;
      break;
    case 'audience':
      r.frames.at(-1).audience = ['red'];
      break;
    case 'unknown':
      r.unexpected = true;
      break;
  }
  expect(() => World.fromSnapshot(JSON.stringify(d), f.w.battlefield)).toThrow();
});
