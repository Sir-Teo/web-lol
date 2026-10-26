import { expect, test, vi } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { advanceHighlanderKills } from '../src/simulation/masteryi-highlander-kill';
import { actorRootKnown, actorRootPose } from '../src/simulation/actor-root-history';
function fixture() {
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
  const yi = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'masteryi');
  yi.ai = false;
  w.gainExperience(1e6, yi.id);
  w.learnSpell('r', yi.id);
  const owner = w.championState(yi.id)!;
  const victim = () => {
    const u = w.spawn('champion', 'red', { x: 400, y: 0 }, 'lux');
    u.ai = false;
    return u;
  };
  const cast = () => {
    w.enqueue({ type: 'cast', unit: yi.id, ability: 'r', point: yi });
    w.step();
  };
  const kill = () => {
    const v = victim();
    w.damage(yi, v, 1e6, 'true');
    return v;
  };
  const resume = (ticks: number) => {
    const saved = w.snapshot(),
      copy = World.fromSnapshot(saved, w.battlefield);
    expect(copy.snapshot()).toBe(saved);
    w.step(ticks);
    copy.step(ticks);
    expect(copy.snapshot()).toBe(w.snapshot());
  };
  return { w, yi, owner, victim, cast, kill, resume };
}
test('ordinary units do not request Highlander kill state', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
  w.spawn('dummy', 'red', { x: 0, y: 0 });
  const spy = vi.spyOn(w, 'championState');
  advanceHighlanderKills(w);
  expect(spy).not.toHaveBeenCalled();
});
test('a live active-R kill records its awarded extension, preserves RNG, and expires independently', () => {
  const f = fixture();
  f.cast();
  const rng = f.w.random.state,
    v = f.kill();
  expect(f.w.random.state).toBe(rng);
  expect(f.owner.highlanderKillVisuals[0]).toMatchObject({
    castTick: 1,
    tick: 1,
    rank: 1,
    extensionIndex: 1,
    victimId: v.id,
    victimTeam: 'red',
    audience: ['blue'],
    detachedTick: null,
  });
  f.resume(87);
  expect(f.owner.highlanderKillVisuals).toHaveLength(1);
  f.resume(1);
  expect(f.owner.highlanderKillVisuals).toEqual([]);
  expect(f.owner.highlander?.extensionCount).toBe(1);
});
test('three same-tick takedowns retain distinct victims and contiguous extension identities', () => {
  const f = fixture();
  f.cast();
  const victims = [f.kill(), f.kill(), f.kill()];
  expect(f.owner.highlanderKillVisuals.map((r) => [r.extensionIndex, r.victimId, r.tick])).toEqual(
    victims.map((v, i) => [i + 1, v.id, 1])
  );
  f.resume(50);
});
test('passive cooldown refunds without an active R create no effect', () => {
  const f = fixture();
  f.w.learnSpell('q', f.yi.id);
  f.owner.cooldowns.q = f.w.tick + 100;
  f.kill();
  expect(f.owner.cooldowns.q - f.w.tick).toBe(31);
  expect(f.owner.highlanderKillVisuals).toEqual([]);
  f.resume(10);
});
test('posthumous passive refunds create no extension or effect', () => {
  const f = fixture();
  f.cast();
  const v = f.victim();
  f.w.damage(v, f.yi, 1e6, 'true');
  f.w.learnSpell('q', f.yi.id);
  f.owner.cooldowns.q = f.w.tick + 100;
  f.w.damage(f.yi, v, 1e6, 'true');
  expect(f.owner.cooldowns.q - f.w.tick).toBe(31);
  expect(f.owner.highlanderKillVisuals).toEqual([]);
  f.resume(10);
});
test('expired R cannot create a takedown effect', () => {
  const f = fixture();
  f.cast();
  f.w.step(420);
  expect(f.owner.highlander).toBeNull();
  f.kill();
  expect(f.owner.highlanderKillVisuals).toEqual([]);
  f.resume(5);
});
test('moving roots and death freeze preserve the saved future', () => {
  const f = fixture();
  f.cast();
  f.kill();
  f.w.setOrder(f.yi, { type: 'move', point: { x: 300, y: 200 } });
  f.w.step(7);
  const r = f.owner.highlanderKillVisuals[0];
  expect(actorRootPose(r.frames, f.w.tick)).toMatchObject({ x: f.yi.x, y: f.yi.y });
  const enemy = f.victim();
  f.w.damage(enemy, f.yi, 1e6, 'true');
  const pose = actorRootPose(r.frames, f.w.tick);
  expect(r.detachedTick).toBe(f.w.tick);
  f.yi.x = 900;
  f.resume(30);
  expect(actorRootPose(r.frames, f.w.tick)).toEqual(pose);
});
test('victory preserves a valid finite tail on the frozen simulation clock', () => {
  const f = fixture();
  f.cast();
  f.kill();
  const nexus = f.w.spawn('nexus', 'red', { x: 1000, y: 1000 });
  f.w.damage(f.yi, nexus, 1e6, 'true');
  const tick = f.w.tick;
  f.resume(100);
  expect(f.w.tick).toBe(tick);
  expect(f.owner.highlanderKillVisuals).toHaveLength(1);
});
test('a pruned prefix permits a later active-R extension', () => {
  const f = fixture();
  f.cast();
  f.kill();
  f.w.step(90);
  f.kill();
  expect(f.owner.highlanderKillVisuals.map((r) => r.extensionIndex)).toEqual([2]);
  f.resume(20);
});
test('an assist admitted during Q hides early births while retaining later known roots', () => {
  const f = fixture();
  f.cast();
  f.w.learnSpell('q', f.yi.id);
  const dummy = f.w.spawn('dummy', 'red', { x: 300, y: 0 });
  dummy.hp = dummy.maxHp = 1e6;
  const v = f.victim(),
    ally = f.w.spawn('champion', 'blue', { x: 450, y: 0 }, 'lux');
  ally.ai = false;
  f.w.damage(f.yi, v, 1, 'true');
  f.w.enqueue({ type: 'cast', unit: f.yi.id, ability: 'q', point: dummy, targetId: dummy.id });
  f.w.step();
  f.w.step(31 - f.w.tick);
  f.w.damage(ally, v, 1e6, 'true');
  const r = f.owner.highlanderKillVisuals[0];
  expect(f.owner.assists).toBe(1);
  expect(r.tick).toBe(31);
  expect(r.audience).toContain('blue');
  expect(actorRootKnown(r.frames, 31, 'blue')).toBe(false);
  f.resume(9);
  f.w.step(21);
  expect(actorRootKnown(r.frames, 32, 'blue')).toBe(false);
  expect(actorRootKnown(r.frames, 61, 'blue')).toBe(true);
  f.resume(10);
});
test.each([
  'missing',
  'duplicate',
  'foreign',
  'future',
  'cast',
  'rank',
  'sequence',
  'victim',
  'team',
  'deadAt',
  'frame-gap',
  'endpoint',
  'detached',
  'unknown',
  'missing-first',
])('decoder rejects %s takedown history', (kind) => {
  const f = fixture();
  f.cast();
  f.kill();
  f.kill();
  f.w.step(4);
  const data = JSON.parse(f.w.snapshot()),
    o = data.otherChampions.find((o: any) => o.id === f.yi.id),
    r = o.highlanderKillVisuals[0];
  switch (kind) {
    case 'missing':
      o.highlanderKillVisuals = [];
      break;
    case 'duplicate':
      o.highlanderKillVisuals.push(structuredClone(r));
      break;
    case 'foreign':
      data.player.highlanderKillVisuals = [r];
      break;
    case 'future':
      r.tick = data.tick + 1;
      break;
    case 'cast':
      r.castTick++;
      break;
    case 'rank':
      r.rank = 3;
      break;
    case 'sequence':
      r.extensionIndex++;
      break;
    case 'victim':
      r.victimId = f.yi.id;
      break;
    case 'team':
      r.victimTeam = 'blue';
      break;
    case 'deadAt':
      data.units.find((u: any) => u.id === r.victimId).deadAt++;
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
      r.unexpected = true;
      break;
    case 'missing-first':
      o.highlanderKillVisuals.shift();
      break;
  }
  expect(() => World.fromSnapshot(JSON.stringify(data), f.w.battlefield)).toThrow();
});
