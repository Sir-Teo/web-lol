import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
const field = {
  ...PRACTICE_FIXTURE,
  initialUnits: [],
  lineOfSight: () => true,
  inBrush: () => false,
  lineWalkable: () => true,
  reachable: (p: { x: number; y: number }) => ({ ...p }),
  findPath: (_a: unknown, b: { x: number; y: number }) => [{ ...b }],
};
function fixture() {
  const w = new World(false, field);
  w.nextWaveTick = 1e9;
  Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 }, ai: false });
  const source = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  source.ai = false;
  w.gainExperience(1e6, source.id);
  w.learnSpell('r', source.id);
  const target = w.spawn('champion', 'red', { x: 600, y: 0 }, 'lux');
  Object.assign(target, { ai: false, hp: 10000, maxHp: 10000, magicResist: 0 });
  const cast = (point = { x: 900, y: 0 }) =>
    w.enqueue({ type: 'cast', unit: source.id, ability: 'r', point });
  const restore = () => {
    const saved = w.snapshot();
    const copy = World.fromSnapshot(saved, field);
    expect(copy.snapshot()).toBe(saved);
    return copy;
  };
  return { w, source, target, cast, restore };
}
test('real R hooks restore every frame across launch, dash, contact and body transitions', () => {
  const f = fixture();
  f.cast();
  for (let i = 0; i < 75; i++) {
    f.w.step();
    f.restore();
  }
  const r = f.w.ahriRVisuals[0],
    b = r.bursts[0],
    p = b.bolts[0];
  expect(r.birthPose.point).toEqual({ x: 0, y: 0 });
  expect(b.dashFrames[0].point.x).toBe(20);
  expect(p.birth.point).toEqual({ x: 0, y: 0 });
  expect(p.frames[0].previous).toEqual({ x: 0, y: 0 });
  expect(b.dashEnd!.reason).toBe('arrived');
  expect(p.end!.reason).toBe('hit');
  const old = r.sourceFrames.find((p) => p.animationTimeline?.primary.clip === 'spell4')!;
  expect(old).toBeDefined();
  expect(f.source.animationTimeline!.primary.clip).not.toBe('spell4');
  expect(old.animationTimeline).not.toBe(f.source.animationTimeline);
});
test('zero remaining casts retain the actual live window and charge epochs', () => {
  const f = fixture();
  f.cast();
  f.w.step(60);
  f.cast({ x: 500, y: 900 });
  f.w.step(60);
  f.cast({ x: 0, y: 0 });
  f.w.step();
  const r = f.w.ahriRVisuals[0];
  expect(r.remainingCasts).toBe(0);
  expect(r.end).toBe(null);
  expect(r.changes.map((c) => c.remainingCasts)).toEqual([2, 1, 0]);
  expect(r.changes.map((c) => c.kind)).toEqual(['cast', 'cast', 'cast']);
  f.restore();
  f.w.step(700);
  expect(r.end).toBe(null);
  expect(r.bursts.length).toBeLessThan(3);
  f.restore();
});
test('a late accepted dash continues after expiry while the ending pose stays at its actual earlier phase', () => {
  const f = fixture();
  f.cast();
  f.w.step(899);
  f.cast({ x: 500, y: 900 });
  f.w.step();
  const r = f.w.ahriRVisuals[0],
    burst = r.bursts.at(-1)!;
  expect(burst.startTick).toBe(900);
  const before = { x: f.source.x, y: f.source.y };
  f.w.step();
  expect(r.end!.reason).toBe('expired');
  expect(r.end!.tick).toBe(901);
  expect(r.end!.pose.point).toEqual(before);
  expect(r.sourceFrames.at(-1)!.point).not.toEqual(before);
  expect(burst.dashEnd).toBe(null);
  f.restore();
  f.w.step(30);
  expect(burst.dashEnd!.reason).toBe('arrived');
  expect(burst.dashEnd!.tick).toBeGreaterThan(r.end!.tick);
  f.restore();
});
test('a natural attack victory before bolt advance retains zero flight frames', () => {
  const f = fixture(),
    w = f.w;
  w.hero.damage = 1e6;
  const nexus = w.spawn('nexus', 'red', { x: w.hero.x, y: w.hero.y });
  w.setOrder(w.hero, { type: 'attack', target: nexus.id });
  for (let i = 0; i < 60 && w.hero.releaseTick === null; i++) w.step();
  expect(w.hero.releaseTick).not.toBe(null);
  while (w.tick < w.hero.releaseTick! - 1) w.step();
  f.cast();
  w.step();
  expect(w.winner).toBe('blue');
  const r = w.ahriRVisuals[0],
    p = r.bursts[0].bolts[0];
  expect(p.frames).toEqual([]);
  expect(p.end!.reason).toBe('match-end');
  expect(p.end!.point).toEqual(p.birth.point);
  const copy = f.restore(),
    saved = copy.snapshot();
  copy.step(120);
  expect(copy.snapshot()).toBe(saved);
});

test('short accepted dashes and rejected sub-threshold aims retain exact saved clocks', () => {
  for (const distance of [0.00011, 0.25, 19.999, 20, 20.001]) {
    const f = fixture();
    f.cast({ x: distance, y: 0 });
    f.w.step();
    f.restore();
    f.w.step();
    f.restore();
    expect(f.w.ahriRVisuals[0].bursts[0].dashEnd!.reason).toBe('arrived');
  }
  for (const distance of [0, 0.00001]) {
    const f = fixture();
    f.cast({ x: distance, y: 0 });
    f.w.step();
    expect(f.w.ahriRushes).toEqual([]);
    expect(f.w.ahriRVisuals).toEqual([]);
    f.restore();
  }
});
