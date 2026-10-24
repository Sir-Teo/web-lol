import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { zenithExpiry } from '../src/simulation/leona-e-visuals';
import timing from '../src/content/leona-e-history-bounds.json';
import type { Team } from '../src/simulation/types';

function fixture(x = 300, team: Team = 'blue') {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    lineWalkable: () => true,
    findPath: (_a, b) => [{ ...b }],
    reachable: (p) => ({ x: p.x, y: p.y }),
  });
  w.nextWaveTick = Infinity;
  Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 } });
  const u = w.spawn('champion', team, { x: 0, y: 0 }, 'leona'),
    target = w.spawn('champion', team === 'blue' ? 'red' : 'blue', { x, y: 0 }, 'lux'),
    state = w.championState(u.id)!;
  target.hp = target.maxHp = 100000;
  for (const unit of w.units) unit.ai = false;
  w.learnSpell('e', u.id);
  const cast = () => {
    w.enqueue({ type: 'cast', unit: u.id, ability: 'e', point: { x: u.x + 900, y: u.y } });
    w.step();
  };
  const r = () => state.leonaEVisuals.at(-1)!;
  const copy = () => {
    const saved = w.snapshot(),
      other = World.fromSnapshot(saved, w.battlefield);
    expect(other.snapshot()).toBe(saved);
    return other;
  };
  const victory = () => {
    const inhibitor = w.spawn('inhibitor', 'red', { x: 1800, y: 1000 });
    w.damage(w.hero, inhibitor, 1e9, 'true');
    const nexus = w.spawn('nexus', 'red', { x: 2000, y: 1000 });
    w.damage(w.hero, nexus, 1e9, 'true');
  };
  cast();
  return { w, u, target, state, cast, r, copy, victory };
}
test('Zenith history bounds retain all enabled source lifetimes with explicit local defaults and settlement', () => {
  expect(timing.sourcePinSha256).toBe(
    createHash('sha256').update(readFileSync('docs/reference/leona-e-particles.json')).digest('hex')
  );
  expect(timing.records).toHaveLength(20);
  expect(timing.localOmittedParticleLifetimeSeconds).toBe(1);
  expect(timing.bounds).toEqual({
    sound: 722,
    contact: 132,
    arrival: 209,
    dash: 39,
    weapon: 770,
    history: 770,
    sourceWindow: 771,
  });
  expect(timing.records.find((r) => r.name === 'Bokeh')!.particleLifeUpper).toBeCloseTo(
    1.600000023841858
  );
});
test('cast and launch retain separate pre-Flash origins, original audiences and the exact first moving frame', () => {
  const f = fixture();
  const start = f.w.tick;
  expect(f.r().castFrame).toMatchObject({ tick: start, x: 0, y: 0 });
  f.w.enqueue({ type: 'cast', unit: f.u.id, ability: 'd', point: { x: 200, y: 0 } });
  f.w.step();
  expect(f.r().frames.at(-1)!.x).toBe(200);
  expect(f.r().castFrame.x).toBe(0);
  f.copy();
  f.w.step(start + 15 - f.w.tick);
  expect(f.r().flight).toMatchObject({ startTick: start + 15, origin: { x: 200, y: 0 } });
  expect(f.r().flight!.frames).toHaveLength(1);
  expect(f.r().flight!.frames[0].x).toBeCloseTo(200 + 2000 / 60);
  expect(f.r().flight!.frames[0].remaining).toBeCloseTo(900 - 2000 / 60);
  f.copy();
});
test('ordered swept contacts preserve lethal poses and select the actual last champion without allocating presentation IDs or random samples', () => {
  const f = fixture();
  const minion = f.w.spawn('caster', 'red', { x: 100, y: 0 });
  minion.ai = false;
  minion.hp = 1;
  const second = f.w.spawn('champion', 'red', { x: 300, y: 0 }, 'lux');
  second.ai = false;
  second.hp = second.maxHp = 100000;
  const id = f.w.nextId,
    events = f.w.events.length,
    random = f.w.random.state;
  f.w.step(41);
  expect(f.r().flight!.contacts.map((c) => c.targetId)).toEqual([
    minion.id,
    f.target.id,
    second.id,
  ]);
  expect(f.r().flight!.contacts[0].detachedTick).toBe(f.r().flight!.contacts[0].tick);
  expect(f.r().dash!.targetId).toBe(second.id);
  // These 41 updates cannot retire a 150-tick event. Only the real missile
  // and the observed combat events may consume shared identities.
  expect(f.w.nextId).toBe(id + 1 + f.w.events.length - events);
  expect(f.w.random.state).toBe(random);
  f.copy();
});
test('windup, flight, contacts, dash, arrival and completed-tail checkpoints reproduce exact following states', () => {
  const f = fixture(),
    start = f.w.tick;
  for (const age of [0, 7, 14, 15, 20, 30, 40, 41, 45, 55, 100, 220, 280]) {
    if (f.w.tick < start + age) f.w.step(start + age - f.w.tick);
    const other = f.copy();
    f.w.step(2);
    other.step(2);
    expect(other.snapshot()).toBe(f.w.snapshot());
  }
  expect(f.r().dash!.endReason).toBe('arrived');
  expect(f.r().arrival!.frames).toHaveLength(timing.bounds.arrival);
});
test('miss histories retain the endpoint until the exact generated retirement boundary', () => {
  const f = fixture(1500);
  f.w.step(41);
  expect(f.r().endReason).toBe('range');
  expect(f.r().dash).toBeNull();
  expect(f.r().arrival).toBeNull();
  expect(f.r().flight!.contacts).toEqual([]);
  expect(f.r().flight!.frames).toHaveLength(27);
  const expiry = zenithExpiry(f.r());
  f.w.step(expiry - f.w.tick - 1);
  expect(f.state.leonaEVisuals).toHaveLength(1);
  f.copy();
  f.w.step();
  expect(f.state.leonaEVisuals).toEqual([]);
  f.copy();
});
test.each(['rootUntil', 'stunUntil'] as const)(
  'a %s interruption keeps its stop cause and does not invent an arrival',
  (key) => {
    const f = fixture();
    f.w.step(41);
    f.u[key] = f.w.tick + 6;
    f.w.step();
    expect(f.r().dash!.endReason).toBe('control');
    expect(f.r().dash!.stopCause![key]).toBeGreaterThan(f.w.tick);
    expect(f.r().arrival).toBeNull();
    f.copy();
  }
);
test('target death ends pursuit without an arrival, while Flash retains the pre-blink dash endpoint', () => {
  const lost = fixture();
  lost.w.step(41);
  lost.w.damage(lost.u, lost.target, 1e9, 'true');
  expect(lost.r().dash!.endReason).toBe('target-lost');
  expect(lost.r().dash!.stopCause!.targetAlive).toBe(false);
  expect(lost.r().arrival).toBeNull();
  lost.copy();
  const blink = fixture();
  blink.w.step(41);
  const point = { x: blink.u.x, y: blink.u.y };
  blink.w.enqueue({ type: 'cast', unit: blink.u.id, ability: 'd', point: { x: -400, y: 0 } });
  blink.w.step();
  expect(blink.r().dash!.endReason).toBe('flash');
  expect(blink.r().dash!.stopFrame).toMatchObject(point);
  expect(blink.r().frames.at(-1)!.x).toBe(-400);
  expect(blink.r().arrival).toBeNull();
  blink.copy();
});
test.each(['windup', 'flight', 'dash'] as const)(
  'owner death during %s freezes its life and preserves only a launched flight',
  (phase) => {
    const f = fixture();
    f.w.step(phase === 'windup' ? 5 : phase === 'flight' ? 17 : 41);
    f.w.damage(f.target, f.u, 1e9, 'true');
    const dead = f.r().death!;
    expect(dead.tick).toBe(f.u.deadAt);
    expect(dead.respawnTick).toBe(f.u.respawnTick);
    f.copy();
    f.w.step(45);
    expect(f.r().endReason).toBe(phase === 'flight' ? 'range' : 'death');
    expect(f.r().flight !== null).toBe(phase !== 'windup');
    expect(f.r().arrival).toBeNull();
    f.copy();
  }
);
test('an old completed cast stays on its original death endpoint through respawn and a subsequent cast', () => {
  const f = fixture();
  f.w.step(60);
  const old = f.r();
  expect(old.arrival).not.toBeNull();
  f.w.damage(f.target, f.u, 1e9, 'true');
  const death = structuredClone(old.death!);
  f.w.step(death.respawnTick - f.w.tick);
  expect(f.u.deadAt).toBeNull();
  expect(old.frames.at(-1)).toMatchObject({
    x: death.frame.x,
    y: death.frame.y,
    facing: death.frame.facing,
  });
  expect(f.u.x).not.toBe(death.frame.x);
  f.copy();
  f.state.cooldowns.e = 0;
  f.u.mana = f.u.maxMana;
  f.cast();
  expect(f.state.leonaEVisuals).toHaveLength(2);
  expect(old.death).toEqual(death);
  expect(old.frames.at(-1)!.x).toBe(death.frame.x);
  expect(f.r().castFrame.x).toBe(f.u.x);
  f.copy();
});
test.each(['windup', 'flight', 'dash', 'arrival'] as const)(
  'victory during %s closes live phases and keeps the winning checkpoint frozen',
  (phase) => {
    const f = fixture();
    f.w.step({ windup: 5, flight: 17, dash: 41, arrival: 60 }[phase]);
    f.victory();
    expect(f.w.winner).toBe('blue');
    const before = f.w.snapshot();
    expect(f.r().endReason).toBe(phase === 'arrival' ? 'arrived' : 'match-end');
    expect(f.r().flight?.stopTick ?? f.r().endTick).not.toBeNull();
    f.copy();
    f.w.step(100);
    expect(f.w.snapshot()).toBe(before);
  }
);
test('a hidden cast and early flight stay historically hidden while later flight and contact frames can gain sight', () => {
  const f = fixture(3000, 'red');
  expect(f.r().castFrame.audience).toEqual(['red']);
  f.w.step(15);
  expect(f.r().flight!.audience).toEqual(['red']);
  expect(f.r().flight!.frames[0].audience).toEqual(['red']);
  Object.assign(f.w.hero, { x: 700, y: 0, previous: { x: 700, y: 0 } });
  f.w.step(26);
  expect(f.r().flight!.audience).toEqual(['red']);
  expect(f.r().flight!.frames[0].audience).toEqual(['red']);
  expect(f.r().flight!.frames.at(-1)!.audience).toContain('blue');
  expect(f.r().flight!.contacts.find((c) => c.targetId === f.w.hero.id)!.audience).toContain(
    'blue'
  );
  f.copy();
});
test('a scripted long homing dash has a bounded rolling history while retaining original event anchors', () => {
  const f = fixture();
  f.w.step(41);
  const first = structuredClone(f.r().castFrame),
    dash = structuredClone(f.r().dash!.startFrame);
  for (let i = 0; i < 1200; i++) {
    f.target.x = i % 2 ? -900 : 900;
    f.w.step();
  }
  expect(f.state.leonaDash).not.toBeNull();
  expect(f.r().frames).toHaveLength(timing.bounds.sourceWindow);
  expect(f.r().frames[0].tick).toBe(f.w.tick - timing.bounds.sourceWindow + 1);
  expect(f.r().castFrame).toEqual(first);
  expect(f.r().dash!.startFrame).toEqual(dash);
  f.copy();
  f.u.rootUntil = f.w.tick + 5;
  f.w.step();
  expect(f.r().endReason).toBe('control');
  f.copy();
});

const mutations: [string, (r: any, s: any, owner: any) => void][] = [
  ['missing', (_r, _s, o) => delete o.leonaEVisuals],
  ['empty', (_r, _s, o) => (o.leonaEVisuals = [])],
  ['duplicate', (r, _s, o) => o.leonaEVisuals.push(structuredClone(r))],
  ['cast-clock', (r) => r.startTick++],
  ['cast-anchor', (r) => r.castFrame.tick++],
  ['direction', (r) => (r.direction.x = 0.5)],
  ['rank', (r) => r.rank++],
  ['radius', (r) => r.radius++],
  ['root-gap', (r) => r.frames.pop()],
  ['root-clock', (r) => r.frames[0].tick++],
  ['root-point', (r) => r.frames.at(-1).x++],
  ['absent-flight', (r) => (r.flight = null)],
  ['flight-id', (r) => r.flight.id++],
  ['launch-clock', (r) => r.flight.startTick++],
  ['launch-origin', (r) => r.flight.origin.x++],
  ['flight-path', (r) => r.flight.frames[0].x++],
  ['remaining-range', (r) => r.flight.frames.at(-1).remaining--],
  ['duplicate-audience', (r) => (r.flight.audience = ['blue', 'blue'])],
  ['contact-id', (r, _s, o) => (r.flight.contacts[0].targetId = o.id)],
  ['sweep-fraction', (r) => (r.flight.contacts[0].fraction = 1)],
  ['contact-point', (r) => r.flight.contacts[0].point.x++],
  ['contact-team', (r) => (r.flight.contacts[0].targetTeam = 'blue')],
  ['contact-rig', (r) => (r.flight.contacts[0].targetRig = 'leona-base')],
  ['false-detachment', (r, s) => (r.flight.contacts[0].detachedTick = s.tick)],
  ['duplicate-contact', (r) => r.flight.contacts.push(structuredClone(r.flight.contacts[0]))],
  [
    'premature-ending',
    (r, s) => {
      r.endTick = s.tick;
      r.endReason = 'range';
    },
  ],
];
test.each(mutations)(
  'strict import rejects %s in a real active-flight history',
  (_name, mutate) => {
    const f = fixture();
    f.w.step(25);
    const s = JSON.parse(f.w.snapshot()),
      owner = s.otherChampions.find((o: any) => o.id === f.u.id);
    mutate(owner.leonaEVisuals[0], s, owner);
    expect(() => World.fromSnapshot(JSON.stringify(s), f.w.battlefield)).toThrow();
  }
);
test('strict import rejects forged arrival causes and contradictory owner respawn clocks', () => {
  const f = fixture();
  f.w.step(60);
  const saved = JSON.parse(f.w.snapshot()),
    owner = saved.otherChampions.find((o: any) => o.id === f.u.id);
  owner.leonaEVisuals[0].dash.stopCause.attemptPoint.x = -3000;
  expect(() => World.fromSnapshot(JSON.stringify(saved), f.w.battlefield)).toThrow();
  f.w.damage(f.target, f.u, 1e9, 'true');
  const s = JSON.parse(f.w.snapshot()),
    dead = s.otherChampions.find((o: any) => o.id === f.u.id);
  dead.leonaEVisuals[0].death.respawnTick++;
  expect(() => World.fromSnapshot(JSON.stringify(s), f.w.battlefield)).toThrow();
});
