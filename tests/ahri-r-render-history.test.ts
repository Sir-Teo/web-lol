import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import type { Team } from '../src/simulation/types';
import {
  rVisualGroups,
  rVisualPose,
  rVisualKnown,
  rVisualDistance,
  rVisualAnimation,
} from '../src/render/ahri-r-history';
const field = {
  ...PRACTICE_FIXTURE,
  initialUnits: [],
  lineOfSight: () => true,
  inBrush: () => false,
  lineWalkable: () => true,
  reachable: (p: { x: number; y: number }) => ({ ...p }),
  findPath: (_a: unknown, b: { x: number; y: number }) => [{ ...b }],
};
function fixture(team: Team = 'blue') {
  const w = new World(false, field);
  w.nextWaveTick = 1e9;
  Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 }, ai: false });
  const source = w.spawn('champion', team, { x: 0, y: 0 }, 'ahri');
  source.ai = false;
  w.gainExperience(1e6, source.id);
  w.learnSpell('r', source.id);
  const target = w.spawn('champion', team === 'blue' ? 'red' : 'blue', { x: 600, y: 0 }, 'lux');
  Object.assign(target, { ai: false, hp: 10000, maxHp: 10000, magicResist: 0 });
  const cast = () =>
    w.enqueue({ type: 'cast', unit: source.id, ability: 'r', point: { x: 900, y: 0 } });
  return { w, source, target, cast };
}
test('real multi-target R dispatch has stable distinct flight/contact groups and pure restore seeks', () => {
  const f = fixture();
  for (const y of [-40, 40]) {
    const u = f.w.spawn('dummy', 'red', { x: 580, y });
    Object.assign(u, { hp: 10000, maxHp: 10000 });
  }
  f.cast();
  f.w.step(60);
  const record = f.w.ahriRVisuals[0],
    groups = rVisualGroups(record);
  expect(groups).toHaveLength(6);
  expect(new Set(groups.map((g) => g.key)).size).toBe(6);
  expect(new Set(groups.map((g) => g.seed)).size).toBe(6);
  expect(new Set(groups.map((g) => g.system))).toEqual(new Set(['Ahri_R_mis_02', 'Ahri_R_Tar']));
  const saved = f.w.snapshot(),
    random = f.w.random.state;
  const restored = World.fromSnapshot(saved, field);
  const sample = (world: World) =>
    rVisualGroups(world.ahriRVisuals[0]).map((g) => ({
      key: g.key,
      seed: g.seed,
      startTick: g.startTick,
      stopTick: g.stopTick,
      poses: [0, 0.5, 5, 25, 60, 120].map((age) => ({
        pose: rVisualPose(g, g.startTick + age),
        known: rVisualKnown(g, g.startTick + age),
        distance: rVisualDistance(g, g.startTick + age),
        animation: rVisualAnimation(g, g.startTick + age),
      })),
    }));
  expect(sample(restored)).toEqual(sample(f.w));
  expect(f.w.snapshot()).toBe(saved);
  expect(f.w.random.state).toBe(random);
  for (const group of groups) {
    expect(group.startTick).toBe(
      group.role === 'flight' ? group.bolt.birth.tick : group.bolt.hit!.pose.tick
    );
    expect(group.stopTick).toBe(group.role === 'flight' ? group.bolt.end!.tick : Infinity);
  }
});
test('moving-target flight seeks follow the recorded curve and interpolate its travelled distance', () => {
  const f = fixture();
  f.w.setOrder(f.target, { type: 'move', point: { x: 600, y: 1000 } });
  f.cast();
  f.w.step(10);
  const g = rVisualGroups(f.w.ahriRVisuals[0])[0],
    frames = g.bolt.frames;
  expect(frames.length).toBeGreaterThan(5);
  expect(frames.at(-1)!.point.y).toBeGreaterThan(frames[0].point.y);
  const a = frames[3],
    b = frames[4],
    at = (a.tick + b.tick) / 2;
  const pose = rVisualPose(g, at)!;
  expect(pose.x).toBeCloseTo((a.point.x + b.point.x) / 2, 12);
  expect(pose.y).toBeCloseTo((a.point.y + b.point.y) / 2, 12);
  expect(pose.facing).toBeCloseTo(Math.atan2(b.point.x - a.point.x, b.point.y - a.point.y), 12);
  expect(rVisualDistance(g, at) - rVisualDistance(g, a.tick)).toBeCloseTo(
    Math.hypot(b.point.x - a.point.x, b.point.y - a.point.y) / 2,
    12
  );
  expect(rVisualPose(g, NaN)).toBe(null);
  expect(rVisualKnown(g, Infinity)).toBe(false);
  expect(rVisualDistance(g, -Infinity)).toBe(0);
});
test('lethal contact keeps its pre-damage animation and freezes the old body through respawn', () => {
  const f = fixture();
  f.target.hp = 1;
  f.cast();
  for (let i = 0; i < 100 && !f.w.ahriRVisuals[0]?.bursts[0].bolts[0].hit; i++) f.w.step();
  const g = rVisualGroups(f.w.ahriRVisuals[0]).find((g) => g.role === 'hit')!;
  expect(g).toBeDefined();
  expect(f.target.hp).toBe(0);
  const birth = g.bolt.hit!.pose,
    ending = g.bolt.targetEnd!.pose;
  expect(rVisualAnimation(g, g.startTick)!.timeline).toBe(birth.animationTimeline);
  expect(birth.animationTimeline!.primary.clip).not.toBe('death');
  expect(g.bolt.targetEnd!.reason).toBe('death');
  expect(g.bolt.targetEnd!.tick).toBe(g.startTick);
  const frozen = rVisualPose(g, g.startTick + 1)!;
  for (let i = 0; i < 1800 && f.target.hp <= 0; i++) f.w.step();
  expect(f.target.hp).toBeGreaterThan(0);
  expect({ x: f.target.x, y: f.target.y }).not.toEqual(ending.point);
  expect(rVisualPose(g, f.w.tick)).toEqual(frozen);
  expect(rVisualAnimation(g, f.w.tick)!.timeline).toEqual(ending.animationTimeline);
});
test('hidden birth and interpolated sight use saved audiences, independently of target ownership', () => {
  const f = fixture('red');
  let revealed = false;
  f.w.visible = (u, team) => u.team === team || team === 'red' || revealed;
  f.w.pointVisible = (_point, team) => team === 'red' || revealed;
  f.cast();
  f.w.step();
  const g = rVisualGroups(f.w.ahriRVisuals[0])[0];
  expect(rVisualKnown(g, g.startTick)).toBe(false);
  revealed = true;
  f.w.step();
  expect(rVisualKnown(g, g.startTick)).toBe(false);
  expect(rVisualKnown(g, f.w.tick - 0.5)).toBe(false);
  expect(rVisualKnown(g, f.w.tick)).toBe(true);
  f.w.step(60);
  const hit = rVisualGroups(f.w.ahriRVisuals[0]).find((g) => g.role === 'hit')!;
  expect(hit.bolt.hit!.targetTeam).toBe('blue');
  expect(rVisualKnown(hit, hit.startTick)).toBe(true);
});
test('actual victory before the first bolt update has a stationary terminal root without a fabricated path', () => {
  const f = fixture(),
    w = f.w;
  w.hero.damage = 1e6;
  const nexus = w.spawn('nexus', 'red', { x: w.hero.x, y: w.hero.y });
  w.setOrder(w.hero, { type: 'attack', target: nexus.id });
  for (let i = 0; i < 60 && w.hero.releaseTick === null; i++) w.step();
  while (w.tick < w.hero.releaseTick! - 1) w.step();
  f.cast();
  w.step();
  expect(w.winner).toBe('blue');
  const g = rVisualGroups(w.ahriRVisuals[0])[0];
  expect(g.bolt.frames).toEqual([]);
  expect(g.bolt.end!.reason).toBe('match-end');
  const saved = w.snapshot();
  for (const at of [g.startTick - 1, g.startTick, g.startTick + 300]) {
    expect(rVisualPose(g, at)).toMatchObject({ x: g.bolt.birth.point.x, y: g.bolt.birth.point.y });
    expect(rVisualDistance(g, at)).toBe(0);
  }
  expect(w.snapshot()).toBe(saved);
});
