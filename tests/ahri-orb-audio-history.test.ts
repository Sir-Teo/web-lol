import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { AHRI_Q_POLICY } from '../src/content/ahri-q-policy';
import { orbAudioExpiry } from '../src/simulation/ahri-orb-audio';

function setup(hit = true, aim = { x: 900, y: 0 }) {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
  });
  w.nextWaveTick = 1e9;
  Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 }, ai: false });
  const ahri = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  w.learnSpell('q', ahri.id);
  const target = w.spawn('champion', 'red', { x: 500, y: hit ? 0 : 500 }, 'lux');
  Object.assign(target, { ai: false, hp: 10000, maxHp: 10000, magicResist: 0 });
  w.enqueue({ type: 'cast', unit: ahri.id, ability: 'q', point: aim });
  w.step();
  return { w, ahri, target };
}
function restore(w: World) {
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, w.battlefield);
  expect(copy.snapshot()).toBe(saved);
  return copy;
}

test('windup, every live motion tick, per-leg contacts and catch restore byte exactly', () => {
  const { w, target } = setup();
  const r = w.ahriOrbAudio[0];
  expect(r).toMatchObject({ castTick: 1, launch: null, turn: null, end: null, hits: [] });
  restore(w);
  while (!r.end) {
    w.step();
    restore(w);
  }
  expect(r.launch?.tick).toBe(16);
  expect(r.turn?.point).toEqual({ x: 1000, y: 0 });
  expect(r.end).toMatchObject({ reason: 'caught', point: { x: 0, y: 0 } });
  expect(r.hits.map((h) => [h.leg, h.targetId, h.point.y])).toEqual([
    ['outward', target.id, 0],
    ['return', target.id, 0],
  ]);
  expect(r.hits[0].point.x).toBeLessThan(target.x);
  expect(r.hits[1].point.x).toBeGreaterThan(target.x);
  const expiry = orbAudioExpiry(r);
  w.step(expiry - w.tick - 1);
  expect(w.ahriOrbAudio).toHaveLength(1);
  restore(w);
  w.step();
  expect(w.ahriOrbAudio).toEqual([]);
  expect(JSON.parse(w.snapshot())).not.toHaveProperty('ahriOrbAudio');
  restore(w);
});

test('future restoration preserves all history, gameplay IDs and RNG through return and catch', () => {
  const { w } = setup();
  w.step(19);
  const copy = restore(w);
  w.step(180);
  copy.step(180);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('an actual post-launch Flash changes the return endpoint while retaining the outward origin', () => {
  const { w, ahri } = setup(false);
  w.step(15);
  w.enqueue({
    type: 'cast',
    unit: ahri.id,
    ability: w.summonerSlot('flash', ahri.id)!,
    point: { x: -100, y: 0 },
  });
  w.step();
  expect(ahri.x).toBe(-100);
  const r = w.ahriOrbAudio[0];
  expect(r.launch!.origin).toEqual({ x: 0, y: 0 });
  restore(w);
  while (!r.end) w.step();
  expect(r.turn!.point).toEqual({ x: 1000, y: 0 });
  expect(r.end!.point).toEqual({ x: -100, y: 0 });
  restore(w);
});

test('death before release retains only the cast, while a launched orb returns to the retained corpse', () => {
  for (const released of [false, true]) {
    const { w, ahri, target } = setup(false);
    if (released) w.step(15);
    const r = w.ahriOrbAudio[0];
    w.damage(target, ahri, 1e6, 'true');
    restore(w);
    if (!released) {
      expect(r.cancelTick).toBe(w.tick);
      expect(r.launch).toBeNull();
      expect(r.end).toBeNull();
    } else {
      while (!r.end) w.step();
      expect(r.cancelTick).toBeNull();
      expect(r.end!.reason).toBe('caught');
      restore(w);
    }
  }
});

test('victory settles accepted windup, outward flight and returning flight without a fabricated catch', () => {
  for (const stage of ['windup', 'outward', 'return']) {
    const { w, ahri } = setup(false);
    const r = w.ahriOrbAudio[0];
    if (stage !== 'windup') w.step(15);
    if (stage === 'return') while (!r.turn) w.step();
    const nexus = w.spawn('nexus', 'red', { x: 5000, y: 5000 });
    w.damage(ahri, nexus, 1e9, 'true');
    expect(w.winner).toBe('blue');
    expect(w.ahriOrbs).toEqual([]);
    if (stage === 'windup') {
      expect(r.cancelTick).toBe(w.tick);
      expect(r.end).toBeNull();
    } else expect(r.end!.reason).toBe('match-end');
    restore(w);
  }
});

test('an uncatchable fixture flight retains its history until the eight-second deadline, then expires without a catch', () => {
  const { w, ahri } = setup(false);
  w.step(15);
  const r = w.ahriOrbAudio[0];
  while (w.tick < r.launch!.tick + AHRI_Q_POLICY.maximumFlightTicks) {
    // Controlled fixture displacement outruns the maximum return speed.
    ahri.x += 100;
    w.step();
    if (w.ahriOrbs.length) expect(w.ahriOrbAudio).toHaveLength(1);
  }
  expect(r.end!.reason).toBe('expired');
  expect(w.ahriOrbs).toEqual([]);
  expect(w.ahriOrbAudio).toEqual([]);
  restore(w);
});

test('birth audiences remain fixed when visibility changes later', () => {
  const { w, ahri } = setup(false);
  const r = w.ahriOrbAudio[0];
  w.pointVisible = () => false;
  w.step(15);
  expect(r.launch!.audience).toEqual(['blue']);
  w.pointVisible = () => true;
  while (!r.turn) w.step();
  expect(r.launch!.audience).toEqual(['blue']);
  expect(r.turn!.audience).toEqual(['blue', 'red']);
  restore(w);
  expect(ahri.hp).toBeGreaterThan(0);
});

test('strict saves reject detached clocks, points, IDs, audiences, invented phases and missing live history', () => {
  const { w } = setup();
  w.step(19);
  const raw = JSON.parse(w.snapshot());
  const mutations = [
    (s: typeof raw) => s.ahriOrbAudio.push(structuredClone(s.ahriOrbAudio[0])),
    (s: typeof raw) => s.ahriOrbAudio[0].launch.id++,
    (s: typeof raw) => s.ahriOrbAudio[0].launch.tick++,
    (s: typeof raw) => s.ahriOrbAudio[0].launch.currentPoint.x++,
    (s: typeof raw) => (s.ahriOrbAudio[0].launch.direction.x = -1),
    (s: typeof raw) => (s.ahriOrbAudio[0].castAudience = ['blue', 'blue']),
    (s: typeof raw) => (s.ahriOrbAudio[0].cancelTick = 1),
    (s: typeof raw) =>
      (s.ahriOrbAudio[0].end = {
        tick: w.tick,
        point: s.ahriOrbAudio[0].launch.currentPoint,
        reason: 'caught',
        audience: ['blue'],
      }),
    (s: typeof raw) => delete s.ahriOrbAudio,
    (s: typeof raw) => (s.ahriOrbAudio = []),
  ];
  for (const mutate of mutations) {
    const bad = structuredClone(raw);
    mutate(bad);
    expect(() => World.fromSnapshot(JSON.stringify(bad), w.battlefield)).toThrow();
  }
});

test('per-leg contact ledgers reject duplicate, friendly, dropped and forged return contacts', () => {
  const { w } = setup();
  const r = w.ahriOrbAudio[0];
  while (!r.hits.length) w.step();
  const raw = JSON.parse(w.snapshot());
  for (const mutate of [
    (s: typeof raw) => s.ahriOrbAudio[0].hits.push(structuredClone(s.ahriOrbAudio[0].hits[0])),
    (s: typeof raw) => (s.ahriOrbAudio[0].hits[0].targetId = w.hero.id),
    (s: typeof raw) => (s.ahriOrbAudio[0].hits = []),
    (s: typeof raw) => (s.ahriOrbAudio[0].hits[0].leg = 'return'),
    (s: typeof raw) => (s.ahriOrbAudio[0].hits[0].point.y += 1),
    (s: typeof raw) => (s.ahriOrbAudio[0].hits[0].point.x = -1),
  ]) {
    const bad = structuredClone(raw);
    mutate(bad);
    expect(() => World.fromSnapshot(JSON.stringify(bad), w.battlefield)).toThrow();
  }
});

test('nine contacts on each leg retain their ordered ledger across every live tick', () => {
  const { w, target } = setup();
  const ids = [target.id];
  for (let i = 0; i < 8; i++) {
    const unit = w.spawn('melee', 'red', { x: 100 + i * 95, y: 0 });
    Object.assign(unit, { ai: false, hp: 10000, maxHp: 10000 });
    ids.push(unit.id);
  }
  const r = w.ahriOrbAudio[0];
  while (!r.end) {
    w.step();
    restore(w);
  }
  for (const leg of ['outward', 'return'])
    expect(
      r.hits
        .filter((h) => h.leg === leg)
        .map((h) => h.targetId)
        .sort((a, b) => a - b)
    ).toEqual([...ids].sort((a, b) => a - b));
});

test('a killed and pruned minion remains a valid contact during a long returning flight', () => {
  const { w, ahri } = setup(false);
  const minion = w.spawn('melee', 'red', { x: 250, y: 0 });
  Object.assign(minion, { ai: false, hp: 1 });
  const r = w.ahriOrbAudio[0];
  w.step(15);
  // Keep the return active beyond the existing four-second corpse lifetime.
  while (w.tick < 300) {
    ahri.x += 100;
    w.step();
  }
  expect(r.end).toBeNull();
  expect(w.unit(minion.id)).toBeUndefined();
  expect(r.hits.some((h) => h.targetId === minion.id)).toBe(true);
  restore(w);
});

test('diagonal swept contacts and turn geometry remain valid through every saved frame', () => {
  const { w, target } = setup(true, { x: 900, y: 900 });
  Object.assign(target, { x: 500, y: 500 });
  const r = w.ahriOrbAudio[0];
  while (!r.end) {
    w.step();
    restore(w);
  }
  expect(r.hits.map((h) => h.leg)).toEqual(['outward', 'return']);
  expect(r.turn!.point.x).toBeCloseTo(1000 / Math.sqrt(2), 9);
  expect(r.turn!.point.y).toBeCloseTo(1000 / Math.sqrt(2), 9);
});
