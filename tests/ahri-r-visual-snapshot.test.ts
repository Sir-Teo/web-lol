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
function fixture(kind: 'lux' | 'dummy' | 'melee' = 'lux', hp = 10000) {
  const w = new World(false, field);
  w.nextWaveTick = 1e9;
  w.random.state = 927;
  Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 }, ai: false });
  const source = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  source.ai = false;
  w.gainExperience(1e6, source.id);
  w.learnSpell('r', source.id);
  const target =
    kind === 'lux'
      ? w.spawn('champion', 'red', { x: 600, y: 0 }, 'lux')
      : w.spawn(kind, 'red', { x: kind === 'melee' ? 300 : 600, y: 0 });
  Object.assign(target, { hp, maxHp: hp, magicResist: 0, ai: false });
  w.setOrder(target, { type: 'idle' });
  const cast = () =>
    w.enqueue({ type: 'cast', unit: source.id, ability: 'r', point: { x: 900, y: 0 } });
  const restore = () => {
    const saved = w.snapshot();
    expect(World.fromSnapshot(saved, field).snapshot()).toBe(saved);
  };
  return { w, source, target, cast, restore };
}
test('schema 181 restores actual R observations through bounded paths and independent retirement', () => {
  const f = fixture();
  f.cast();
  let last = 0;
  for (const tick of [1, 5, 25, 26, 60, 500, 720, 721, 746, 900, 901, 1500, 1621]) {
    f.w.step(tick - last);
    last = tick;
    f.restore();
    expect(f.w.ahriRVisuals.every((r) => r.sourceFrames.length <= 3603)).toBe(true);
  }
  expect(f.w.ahriRVisuals).toEqual([]);
  expect(JSON.parse(f.w.snapshot()).ahriRVisuals).toBeUndefined();
});
test('strict saves reject changed clocks, paths, identities, body facts and missing observation coverage', () => {
  const f = fixture();
  f.cast();
  f.w.step(60);
  f.restore();
  const base = JSON.parse(f.w.snapshot());
  const mutations: Array<(s: any) => void> = [
    (s) => delete s.ahriRVisuals,
    (s) => s.ahriRVisuals.push(structuredClone(s.ahriRVisuals[0])),
    (s) => (s.ahriRVisuals[0].sourceId = s.player.id),
    (s) => (s.ahriRVisuals[0].id = f.target.id),
    (s) => (s.ahriRVisuals[0].team = 'red'),
    (s) => s.ahriRVisuals[0].startTick++,
    (s) => s.ahriRVisuals[0].initialWindowEndTick++,
    (s) => s.ahriRVisuals[0].windowEndTick++,
    (s) => (s.ahriRVisuals[0].remainingCasts = 3),
    (s) => s.ahriRVisuals[0].sourceFrames.at(-1).point.x++,
    (s) => (s.ahriRVisuals[0].sourceFrames.at(-1).animationTimeline.primary.time += 0.1),
    (s) => s.ahriRVisuals[0].birthPose.point.x++,
    (s) => (s.ahriRVisuals[0].changes[0].remainingCasts = 1),
    (s) => (s.ahriRVisuals[0].changes[0].kind = 'essence'),
    (s) => s.ahriRVisuals[0].changes[0].pose.point.x++,
    (s) => (s.ahriRVisuals[0].bursts[0].rank = 3),
    (s) => s.ahriRVisuals[0].bursts[0].origin.x++,
    (s) => s.ahriRVisuals[0].bursts[0].destination.x--,
    (s) => s.ahriRVisuals[0].bursts[0].dashFrames[1].previous.x++,
    (s) => s.ahriRVisuals[0].bursts[0].dashFrames[0].point.x++,
    (s) => s.ahriRVisuals[0].bursts[0].dashFrames.pop(),
    (s) => (s.ahriRVisuals[0].bursts[0].dashEnd.reason = 'match-end'),
    (s) =>
      (s.ahriRVisuals[0].bursts[0].dashEnd.control = {
        rootUntil: 70,
        stunUntil: 0,
        charmUntil: 0,
      }),
    (s) => (s.ahriRVisuals[0].bursts[0].bolts[0].index = 1),
    (s) => (s.ahriRVisuals[0].bursts[0].bolts[0].targetId = f.source.id),
    (s) => s.ahriRVisuals[0].bursts[0].bolts[0].birth.point.x++,
    (s) => s.ahriRVisuals[0].bursts[0].bolts[0].frames[0].previous.x++,
    (s) => s.ahriRVisuals[0].bursts[0].bolts[0].frames[0].point.x++,
    (s) => (s.ahriRVisuals[0].bursts[0].bolts[0].end.reason = 'expired'),
    (s) => s.ahriRVisuals[0].bursts[0].bolts[0].end.point.x++,
    (s) => (s.ahriRVisuals[0].bursts[0].bolts[0].hit.targetRig = 'ahri-base'),
    (s) => s.ahriRVisuals[0].bursts[0].bolts[0].hit.pose.point.x++,
    (s) => s.ahriRVisuals[0].bursts[0].bolts[0].targetFrames.at(-1).point.x++,
    (s) =>
      (s.ahriRVisuals[0].bursts[0].bolts[0].targetFrames.at(-1).animationTimeline.primary.time +=
        0.1),
    (s) => {
      const p = s.ahriRVisuals[0].bursts[0].bolts[0];
      p.targetEnd = { tick: s.tick, reason: 'death', pose: structuredClone(p.targetFrames.at(-1)) };
    },
    (s) => (s.ahriRVisuals[0].unexpectedField = 0),
  ];
  mutations.forEach((change, index) => {
    const state = structuredClone(base);
    change(state);
    expect(() => World.fromSnapshot(JSON.stringify(state), field), 'mutation ' + index).toThrow();
  });
});
test('E and R may retain the same removed minion as a historical unit reference', () => {
  const f = fixture('melee', 100);
  f.w.learnSpell('e', f.source.id);
  f.w.enqueue({ type: 'cast', unit: f.source.id, ability: 'e', point: { x: 900, y: 0 } });
  for (let i = 0; i < 100 && !f.target.charm; i++) f.w.step();
  expect(f.target.charm?.sourceId).toBe(f.source.id);
  expect(f.target.hp).toBeGreaterThan(0);
  f.cast();
  for (let i = 0; i < 300 && f.w.unit(f.target.id); i++) f.w.step();
  expect(f.w.unit(f.target.id)).toBeUndefined();
  expect(f.w.ahriRushes.length).toBe(1);
  expect(f.w.ahriEVisuals[0].targetEnd!.reason).toBe('death');
  expect(f.w.ahriRVisuals[0].bursts[0].bolts[0].targetEnd!.reason).toBe('death');
  f.restore();
});
test('old R contact bodies stay valid across real dummy respawn and a second death', () => {
  const f = fixture('dummy', 1);
  f.cast();
  f.w.step(30);
  f.restore();
  const old = f.w.ahriRVisuals[0].bursts[0].bolts[0];
  expect(old.targetEnd!.reason).toBe('death');
  const end = JSON.stringify(old.targetEnd);
  f.w.step(190);
  expect(f.target.hp).toBeGreaterThan(0);
  f.restore();
  f.w.damage(f.source, f.target, f.target.hp - 1, 'true');
  f.cast();
  f.w.step(10);
  expect(f.target.hp).toBe(0);
  expect(JSON.stringify(old.targetEnd)).toBe(end);
  f.restore();
});
