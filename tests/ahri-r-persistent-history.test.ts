import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import bindings from '../docs/reference/ahri/r-particle-bindings.json';
import {
  rBuffVisualGroups,
  rBuffVisualKnown,
  rBuffVisualPose,
} from '../src/render/ahri-r-persistent-history';
import type { Team } from '../src/simulation/types';

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
  const world = new World(false, field);
  world.nextWaveTick = 1e9;
  Object.assign(world.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 }, ai: false });
  const source = world.spawn('champion', team, { x: 0, y: 0 }, 'ahri');
  source.ai = false;
  world.gainExperience(1e6, source.id);
  world.learnSpell('r', source.id);
  const target = world.spawn('champion', team === 'blue' ? 'red' : 'blue', { x: 600, y: 0 }, 'lux');
  Object.assign(target, { ai: false, hp: 10000, maxHp: 10000 });
  const cast = () =>
    world.enqueue({
      type: 'cast',
      unit: source.id,
      ability: 'r',
      point: { x: source.x + 300, y: source.y },
    });
  cast();
  world.step();
  return { world, source, target, cast, record: world.ahriRVisuals[0] };
}
test('the explicit skin HasBuff condition maps two eye instances and one layout instance with pure restores', () => {
  const f = fixture();
  f.world.step(20);
  const groups = rBuffVisualGroups(f.record);
  expect(bindings.skinPersistentCondition.OwnerCondition.__type).toBe(
    'HasBuffDynamicMaterialBoolDriver'
  );
  expect(groups.map((g) => ({ effectKey: g.system, boneName: g.bone }))).toEqual(
    bindings.skinPersistentCondition.PersistentVfxs.filter(
      (p) => p.effectKey !== 'Ahri_R_TextureSwaps'
    ).map((p) => ({ effectKey: p.effectKey, boneName: p.boneName }))
  );
  expect(new Set(groups.map((g) => g.key)).size).toBe(3);
  expect(new Set(groups.map((g) => g.seed)).size).toBe(3);
  const saved = f.world.snapshot(),
    random = f.world.random.state;
  const project = (world: World) =>
    rBuffVisualGroups(world.ahriRVisuals[0]).map((g) => ({
      key: g.key,
      seed: g.seed,
      start: g.startTick,
      stop: g.stopTick,
      poses: [g.startTick, g.startTick + 1.5, world.tick].map((t) => rBuffVisualPose(g, t)),
    }));
  expect(project(World.fromSnapshot(saved, field))).toEqual(project(f.world));
  expect(f.world.snapshot()).toBe(saved);
  expect(f.world.random.state).toBe(random);
});
test('zero charges and actual Essence extension do not end the buff producer early', () => {
  const f = fixture();
  for (let i = 0; i < 2; i++) {
    f.world.step(65);
    f.cast();
    f.world.step();
  }
  expect(f.record.remainingCasts).toBe(0);
  expect(f.record.end).toBeNull();
  expect(rBuffVisualGroups(f.record).every((g) => g.stopTick === Infinity)).toBe(true);
  f.world.step(450);
  const victim = f.world.spawn('champion', 'red', { x: f.source.x, y: f.source.y }, 'lux');
  victim.ai = false;
  f.world.damage(f.source, victim, 1e6, 'true');
  f.world.step();
  expect(f.record.windowEndTick).toBeGreaterThan(f.record.initialWindowEndTick);
  expect(f.record.remainingCasts).toBeGreaterThan(0);
  f.world.step(f.record.initialWindowEndTick - f.world.tick + 1);
  expect(f.record.end).toBeNull();
  expect(rBuffVisualGroups(f.record).every((g) => g.stopTick === Infinity)).toBe(true);
});
test('source death stops births and freezes its owned old-body pose independently of a revived unit', () => {
  const f = fixture();
  f.world.step(5);
  f.world.damage(f.target, f.source, 1e6, 'true');
  f.world.step();
  expect(f.record.end?.reason).toBe('death');
  const group = rBuffVisualGroups(f.record)[0],
    end = f.record.sourceEnd!;
  expect(group.stopTick).toBe(end.tick);
  const frozen = rBuffVisualPose(group, end.tick);
  const restored = World.fromSnapshot(f.world.snapshot(), field);
  expect(rBuffVisualPose(rBuffVisualGroups(restored.ahriRVisuals[0])[0], f.world.tick)).toEqual(
    frozen
  );
  // Move a revived unit only after checking its valid dead-state snapshot.
  // The renderer helper must never consult this mutable body.
  Object.assign(f.source, { hp: f.source.maxHp, deadAt: null, x: 9000, y: 5000 });
  f.world.step(30);
  expect(rBuffVisualPose(group, f.world.tick)).toEqual(frozen);
});
test('buff expiry stops its producer while retained particles can still follow the living caster', () => {
  const f = fixture();
  f.world.step(f.record.initialWindowEndTick - f.world.tick);
  expect(f.record.end?.reason).toBe('expired');
  const group = rBuffVisualGroups(f.record)[0];
  expect(group.stopTick).toBe(f.record.end!.tick);
  f.world.setOrder(f.source, { type: 'move', point: { x: f.source.x, y: 500 } });
  f.world.step(30);
  const pose = rBuffVisualPose(group, f.world.tick)!;
  expect(pose.y).toBeGreaterThan(f.record.end!.pose.point.y);
  expect(pose.x).toBe(f.source.x);
  expect(pose.y).toBe(f.source.y);
  expect(f.record.sourceEnd).toBeNull();
});
test('fractional caster visibility requires both owned neighbours and never rewrites hidden birth', () => {
  const f = fixture('red');
  let revealed = false;
  f.world.visible = (unit, team) => unit.team === team || team === 'red' || revealed;
  f.world.step();
  const group = rBuffVisualGroups(f.record)[0],
    hidden = f.world.tick;
  expect(rBuffVisualKnown(group, hidden, 'blue')).toBe(false);
  revealed = true;
  f.world.step();
  expect(rBuffVisualKnown(group, hidden, 'blue')).toBe(false);
  expect(rBuffVisualKnown(group, hidden + 0.5, 'blue')).toBe(false);
  expect(rBuffVisualKnown(group, hidden + 1, 'blue')).toBe(true);
  expect(rBuffVisualKnown(group, hidden + 0.5, 'red')).toBe(true);
});
test('the independent birth anchor survives stopped-window retention without inventing poses across its gap', () => {
  const f = fixture();
  f.world.step(f.record.initialWindowEndTick - f.world.tick + 20);
  const group = rBuffVisualGroups(f.record)[0];
  expect(f.record.sourceFrames[0].tick).toBeGreaterThan(f.record.startTick + 1);
  expect(rBuffVisualPose(group, f.record.startTick)).toMatchObject({
    x: f.record.birthPose.point.x,
    y: f.record.birthPose.point.y,
  });
  expect(rBuffVisualPose(group, f.record.startTick + 1)).toBeNull();
  expect(rBuffVisualKnown(group, f.record.startTick + 1, 'blue')).toBe(false);
  const a = f.record.sourceFrames.at(-2)!,
    b = f.record.sourceFrames.at(-1)!;
  expect(rBuffVisualPose(group, (a.tick + b.tick) / 2)?.x).toBeCloseTo(
    (a.point.x + b.point.x) / 2,
    12
  );
  expect(rBuffVisualPose(group, NaN)).toBeNull();
  expect(rBuffVisualKnown(group, Infinity, 'blue')).toBe(false);
  expect(rBuffVisualPose(group, f.record.startTick - 0.5)).toBeNull();
});

test('genuine extensions retain every source pose through the sixty-second binding window, then release old poses', () => {
  const f = fixture();
  const first = JSON.stringify(f.record.sourceFrames[0]);
  const observed = new Map<number, string>();
  while (f.world.tick < f.record.startTick + 3604) {
    if (f.world.tick === 1000) f.cast();
    if (f.world.tick % 500 === 499) {
      const victim = f.world.spawn('champion', 'red', { x: f.source.x, y: f.source.y }, 'lux');
      victim.ai = false;
      f.world.damage(f.source, victim, 1e6, 'true');
      f.world.setOrder(f.source, {
        type: 'move',
        point: { x: f.source.x + 300, y: f.source.y + 100 },
      });
    }
    f.world.step();
    const last = f.record.sourceFrames.at(-1)!;
    observed.set(last.tick, JSON.stringify(last));
    if ([900, 3599, 3602, 3603].includes(f.world.tick - f.record.startTick)) {
      expect(f.record.end).toBeNull();
      const long = f.world.tick - f.record.startTick <= 3602;
      expect(f.record.sourceFrames.length).toBe(long ? f.world.tick - f.record.startTick + 1 : 721);
      if (long) expect(JSON.stringify(f.record.sourceFrames[0])).toBe(first);
      for (const pose of f.record.sourceFrames.slice(1))
        expect(JSON.stringify(pose)).toBe(observed.get(pose.tick));
      const saved = f.world.snapshot();
      const restored = World.fromSnapshot(saved, field);
      expect(restored.snapshot()).toBe(saved);
      if (long) {
        const invalid = JSON.parse(saved);
        invalid.ahriRVisuals[0].sourceFrames.shift();
        expect(() => World.fromSnapshot(JSON.stringify(invalid), field)).toThrow();
      }
    }
  }
  expect(f.record.sourceFrames).toHaveLength(721);
  expect(rBuffVisualPose(rBuffVisualGroups(f.record)[0], f.record.startTick + 1)).toBeNull();
});

test('source death releases the extended binding path and restores the exact stopped history', () => {
  const f = fixture();
  f.world.step(499);
  const victim = f.world.spawn('champion', 'red', { x: f.source.x, y: f.source.y }, 'lux');
  victim.ai = false;
  f.world.damage(f.source, victim, 1e6, 'true');
  f.world.step(500);
  expect(f.record.end).toBeNull();
  expect(f.record.sourceFrames[0].tick).toBe(f.record.startTick);
  f.world.damage(f.target, f.source, 1e6, 'true');
  f.world.step();
  expect(f.record.end?.reason).toBe('death');
  expect(f.record.sourceFrames).toHaveLength(721);
  expect(f.record.sourceFrames[0].tick).toBe(f.record.sourceEnd!.pose.tick - 720);
  const saved = f.world.snapshot();
  expect(World.fromSnapshot(saved, field).snapshot()).toBe(saved);
});
