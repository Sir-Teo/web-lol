import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { daybreakExpiry } from '../src/simulation/leona-q-visuals';

function fixture() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const u = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona');
  const target = w.spawn('dummy', 'red', { x: 150, y: 0 });
  target.hp = target.maxHp = 100000;
  const state = w.championState(u.id)!;
  w.learnSpell('q', u.id);
  const cast = () => {
    w.enqueue({ type: 'cast', unit: u.id, ability: 'q', point: u });
    w.step();
  };
  const attack = () => {
    w.setOrder(u, { type: 'attack', target: target.id });
    w.step();
  };
  return { w, u, target, state, cast, attack };
}

test('an early Q contact retains caster poses until the longest source cast finishes', () => {
  const f = fixture();
  f.cast();
  f.attack();
  f.w.step(15);
  f.w.setOrder(f.u, { type: 'idle' });
  expect(daybreakExpiry(f.state.leonaQVisuals[0])).toBe(115);
  const copy = World.fromSnapshot(f.w.snapshot(), f.w.battlefield);
  f.w.step(96);
  copy.step(96);
  expect(f.w.tick).toBe(113);
  expect(f.state.leonaQVisuals[0].frames.at(-1)!.tick).toBe(113);
  expect(copy.snapshot()).toBe(f.w.snapshot());
  f.w.step(2);
  copy.step(2);
  expect(f.state.leonaQVisuals).toEqual([]);
  expect(copy.snapshot()).toBe(f.w.snapshot());
});

test('target loss retains a canceled Q attack start separately from the later successful attempt', () => {
  const f = fixture();
  f.cast();
  f.attack();
  const first = f.u.attackCycle!.startTick;
  f.w.damage(f.w.hero, f.target, 1e9, 'true');
  f.w.step();
  expect(f.state.leonaQ).not.toBeNull();
  const next = f.w.spawn('dummy', 'red', { x: 150, y: 0 });
  f.w.setOrder(f.u, { type: 'attack', target: next.id });
  f.w.step();
  const second = f.u.attackCycle!.startTick;
  const record = f.state.leonaQVisuals[0] as any;
  expect(record.attackStarts).toEqual([first, second]);
  const copy = World.fromSnapshot(f.w.snapshot(), f.w.battlefield);
  f.w.step(20);
  copy.step(20);
  expect(record.impact.attackStartTick).toBe(second);
  expect(copy.snapshot()).toBe(f.w.snapshot());
});

test('Q release events carry both the activation and the actual attempt identity', () => {
  const f = fixture();
  f.cast();
  f.attack();
  const start = f.u.attackCycle!.startTick;
  f.w.step(15);
  expect(f.w.events.find((e) => e.type === 'attack' && e.unit === f.u.id)).toMatchObject({
    champion: 'leona',
    leonaQStartTick: 1,
    leonaQAttackStartTick: start,
  });
});

test('strict saves require ordered attack starts and correlate both active windup and actual contact', () => {
  const f = fixture();
  f.cast();
  f.attack();
  const forge = (mutate: (r: any, s: any) => void) => {
    const s = JSON.parse(f.w.snapshot()),
      r = s.otherChampions.find((o: any) => o.id === f.u.id).leonaQVisuals[0];
    mutate(r, s);
    expect(() => World.fromSnapshot(JSON.stringify(s), f.w.battlefield)).toThrow();
  };
  forge((r) => delete r.attackStarts);
  forge((r) => (r.attackStarts = []));
  forge((r) => (r.attackStarts = [2, 2]));
  forge((r) => (r.attackStarts = [0]));
  forge((r, s) => (r.attackStarts = [s.tick + 1]));
  forge((_r, s) => (s.version = 126));
  f.w.step(15);
  forge((r) => (r.attackStarts = []));
  forge((r) => (r.attackStarts = [1]));
  forge((r) => r.attackStarts.push(r.impact.tick));
  expect(() => World.fromSnapshot(f.w.snapshot(), f.w.battlefield)).not.toThrow();
});

test('late committed contact after empowerment expiry retains its attack start and exact saved future', () => {
  const f = fixture();
  f.cast();
  f.w.step(350);
  f.attack();
  const first = f.u.attackCycle!.startTick;
  const copy = World.fromSnapshot(f.w.snapshot(), f.w.battlefield);
  f.w.step(25);
  copy.step(25);
  expect(f.state.leonaQVisuals[0]).toMatchObject({
    endReason: 'expired',
    stopTick: 361,
    attackStarts: [first],
    impact: { attackStartTick: first, tick: first + 15 },
  });
  expect(copy.snapshot()).toBe(f.w.snapshot());
});
