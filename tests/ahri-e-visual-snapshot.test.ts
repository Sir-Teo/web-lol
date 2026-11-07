import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { eVisualGameplaySamples, type EVisualGameplayCase } from './helpers/ahri-e-visual-gameplay';

function field() {
  return {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (p: { x: number; y: number }) => ({ ...p }),
    findPath: (_a: unknown, b: { x: number; y: number }) => [{ ...b }],
  };
}
for (const order of ['charm-first', 'arrow-first'] as const)
  test('mid-projectile victory preserves actual moved samples: ' + order, () => {
    const w = new World(false, field());
    w.nextWaveTick = 1e9;
    Object.assign(w.hero, { x: 0, y: 400, previous: { x: 0, y: 400 }, ai: false });
    const caster = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
    caster.ai = false;
    w.learnSpell('e', caster.id);
    const nexus = w.spawn('nexus', 'red', { x: 650, y: 400 });
    nexus.hp = 1;
    w.setOrder(w.hero, { type: 'attack', target: nexus.id });
    if (order === 'arrow-first') w.step(20);
    w.enqueue({ type: 'cast', unit: caster.id, ability: 'e', point: { x: 900, y: 0 } });
    while (!w.winner && w.tick < 100) w.step();
    expect(w.winner).toBe('blue');
    const r = w.ahriEVisuals.find((r) => r.sourceId === caster.id)!;
    expect(r.launch).not.toBeNull();
    expect(r.stop?.reason).toBe('match-end');
    const last = r.flightFrames.at(-1)!;
    expect(last.tick).toBe(r.stop!.tick - (order === 'arrow-first' ? 1 : 0));
    const saved = w.snapshot();
    expect(World.fromSnapshot(saved, w.battlefield).snapshot()).toBe(saved);
    w.step(60);
    expect(w.snapshot()).toBe(saved);
  });

function checkpoint(scenario: EVisualGameplayCase, tick: number) {
  const sample = eVisualGameplaySamples(World, PRACTICE_FIXTURE, scenario).find(
    (s) => s.tick === tick
  )!;
  return JSON.parse(sample.snapshot);
}
function restore(state: unknown) {
  return World.fromSnapshot(JSON.stringify(state), field());
}

test('strict Charm save admission rejects broken phase, control, pose, audio and identity links', () => {
  const state = checkpoint('hit', 45);
  expect(state.version).toBe(179);
  expect(restore(state).snapshot()).toBe(JSON.stringify(state));
  const mutations: ((s: any) => void)[] = [
    (s) => {
      delete s.ahriEVisuals;
    },
    (s) => s.ahriEVisuals.push(structuredClone(s.ahriEVisuals[0])),
    (s) => {
      s.ahriEVisuals[0].sourceId = s.ahriEVisuals[0].hit.targetId;
    },
    (s) => {
      s.ahriEVisuals[0].team = 'red';
    },
    (s) => s.ahriEVisuals[0].rank++,
    (s) => s.ahriEVisuals[0].castTick--,
    (s) => s.ahriEVisuals[0].aim.y++,
    (s) => {
      s.ahriEVisuals[0].launch.projectileId = s.nextId;
    },
    (s) => s.ahriEVisuals[0].sourceFrames.pop(),
    (s) => s.ahriEVisuals[0].sourceFrames.at(-1).point.x++,
    (s) => s.ahriEVisuals[0].targetFrames.at(-1).point.x++,
    (s) => s.ahriEVisuals[0].targetFrames.at(-1).facing++,
    (s) => s.ahriEVisuals[0].flightFrames.at(-1).point.x++,
    (s) => s.ahriEVisuals[0].launch.direction.y++,
    (s) => s.ahriEVisuals[0].launch.range++,
    (s) => {
      s.ahriEVisuals[0].hit.targetId = s.ahriEVisuals[0].sourceId;
    },
    (s) => {
      s.ahriEVisuals[0].hit.targetTeam = 'blue';
    },
    (s) => s.ahriEVisuals[0].hit.targetPoint.x++,
    (s) => s.ahriEVisuals[0].hit.targetRadius++,
    (s) => s.ahriEVisuals[0].buff.control.sourceId++,
    (s) => s.ahriEVisuals[0].buff.control.endTick++,
    (s) => {
      s.ahriEVisuals[0].buff.control.tenacityApplied = true;
    },
    (s) => {
      s.ahriEVisuals[0].buff.stop = { tick: 45, reason: 'control-ended' };
    },
    (s) => {
      s.units.find((u: any) => u.id === s.ahriEVisuals[0].hit.targetId).charm = null;
    },
    (s) => s.ahriCharmAudio[0].launch.currentPoint.x++,
    (s) => s.ahriCharmAudio[0].hit.point.y++,
    (s) => s.ahriEVisuals[0].buff.audience.reverse(),
    (s) => {
      s.ahriEVisuals[0].inventedDefault = 0;
    },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const changed = structuredClone(state);
    mutate(changed);
    expect(() => restore(changed), 'mutation ' + index).toThrow();
  }
});

test('lethal hits preserve target ending data and cannot invent a persistent buff', () => {
  const lethal = checkpoint('lethal-hit', 45),
    live = checkpoint('hit', 45);
  expect(lethal.ahriEVisuals[0].buff).toBeNull();
  expect(lethal.ahriEVisuals[0].targetEnd.reason).toBe('death');
  expect(restore(lethal).snapshot()).toBe(JSON.stringify(lethal));
  for (const mutate of [
    (s: any) => {
      s.ahriEVisuals[0].targetEnd = null;
    },
    (s: any) => s.ahriEVisuals[0].targetEnd.pose.point.x++,
    (s: any) => s.ahriEVisuals[0].targetEnd.tick++,
    (s: any) => {
      s.ahriEVisuals[0].buff = live.ahriEVisuals[0].buff;
    },
  ]) {
    const changed = structuredClone(lethal);
    mutate(changed);
    expect(() => restore(changed)).toThrow();
  }
});

test('ended projectile identities remain reserved while their source history drains', () => {
  const state = checkpoint('hit', 45),
    id = state.ahriEVisuals[0].launch.projectileId;
  expect(state.projectiles.some((p: any) => p.id === id)).toBe(false);
  const hero = state.units.find((u: any) => u.id === state.player.id);
  hero.id = id;
  state.player.id = id;
  expect(() => restore(state)).toThrow('entity identities');
});

test('actual dummy respawn cannot resume the old body path or prolong visual retention', () => {
  const w = new World(false, field());
  w.nextWaveTick = 1e9;
  Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 }, ai: false });
  const caster = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  caster.ai = false;
  const target = w.spawn('dummy', 'red', { x: 500, y: 0 });
  Object.assign(target, { ai: false, hp: 10000, maxHp: 10000, magicResist: 0 });
  w.learnSpell('e', caster.id);
  w.enqueue({ type: 'cast', unit: caster.id, ability: 'e', point: { x: 900, y: 0 } });
  w.step(50);
  expect(target.charm).not.toBeNull();
  w.damage(caster, target, 1e6, 'true');
  expect(w.ahriEVisuals[0].targetEnd?.tick).toBe(50);
  w.step(180);
  expect(target.hp).toBeGreaterThan(0);
  expect(target.deadAt).toBeNull();
  expect(w.ahriEVisuals[0].targetFrames.at(-1)!.tick).toBe(50);
  const saved = w.snapshot();
  expect(World.fromSnapshot(saved, w.battlefield).snapshot()).toBe(saved);
  w.step(120);
  expect(w.ahriEVisuals).toEqual([]);
  expect(JSON.parse(w.snapshot()).ahriEVisuals).toBeUndefined();
});

test('live windups and projectiles require their matching open observer phases', () => {
  const windup = checkpoint('hit', 1),
    flight = checkpoint('hit', 20);
  for (const state of [windup, flight]) {
    expect(restore(state).snapshot()).toBe(JSON.stringify(state));
    const missing = structuredClone(state);
    delete missing.ahriEVisuals;
    expect(() => restore(missing)).toThrow('E visual');
  }
  const canceled = structuredClone(windup);
  canceled.ahriEVisuals[0].cancel = { tick: 1, reason: 'death' };
  expect(() => restore(canceled)).toThrow('E visual');
  const closed = structuredClone(flight),
    r = closed.ahriEVisuals[0];
  r.stop = {
    tick: 20,
    point: { ...r.flightFrames.at(-1).point },
    reason: 'removed',
    audience: ['blue', 'red'],
  };
  expect(() => restore(closed)).toThrow('E visual');
});

test('removed target identities cannot be rewritten into a retained projectile identity', () => {
  const w = new World(false, field());
  w.nextWaveTick = 1e9;
  Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 }, ai: false });
  const caster = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  caster.ai = false;
  const target = w.spawn('caster', 'red', { x: 300, y: 0 });
  Object.assign(target, { ai: false, hp: 1, magicResist: 0 });
  w.learnSpell('e', caster.id);
  w.enqueue({ type: 'cast', unit: caster.id, ability: 'e', point: { x: 900, y: 0 } });
  w.step(280);
  expect(w.unit(target.id)).toBeUndefined();
  expect(w.ahriCharmAudio).toEqual([]);
  const saved = w.snapshot();
  expect(World.fromSnapshot(saved, w.battlefield).snapshot()).toBe(saved);
  const changed = JSON.parse(saved),
    r = changed.ahriEVisuals[0];
  expect(r.hit.targetId).toBe(target.id);
  r.hit.targetId = r.launch.projectileId;
  expect(() => restore(changed)).toThrow('entity identities');
});
