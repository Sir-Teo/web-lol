import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { charmAudioExpiry } from '../src/simulation/ahri-charm-audio';

function setup(hit = true) {
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
  Object.assign(w.hero, { x: -3000, y: -3000, ai: false });
  const ahri = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  w.learnSpell('e', ahri.id);
  const target = w.spawn('champion', 'red', { x: 500, y: hit ? 0 : 500 }, 'lux');
  Object.assign(target, { ai: false, hp: 10000, maxHp: 10000, magicResist: 0 });
  w.enqueue({ type: 'cast', unit: ahri.id, ability: 'e', point: { x: 900, y: 0 } });
  w.step();
  return { w, ahri, target };
}
function restore(w: World) {
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, w.battlefield);
  expect(copy.snapshot()).toBe(saved);
  return copy;
}

test('accepted windup, live flight, swept contact and retained tail restore exactly', () => {
  const { w, ahri, target } = setup();
  expect(w.ahriCharmAudio[0]).toMatchObject({
    sourceId: ahri.id,
    castTick: 1,
    launch: null,
    cancelTick: null,
    castAudience: ['blue', 'red'],
  });
  restore(w);
  w.step(15);
  const r = w.ahriCharmAudio[0];
  expect(r.launch).toMatchObject({
    tick: 16,
    id: w.projectiles[0].id,
    point: { x: 0, y: 0 },
    currentPoint: { x: 1550 / 60, y: 0 },
  });
  const copy = restore(w);
  while (!r.hit) w.step();
  copy.step(w.tick - copy.tick);
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(r.hit).toMatchObject({ targetId: target.id, point: { x: 405, y: 0 } });
  expect(r.stop).toEqual({ tick: r.hit!.tick, reason: 'hit', point: { x: 405, y: 0 } });
  restore(w);
  const expiry = charmAudioExpiry(r);
  w.step(expiry - w.tick - 1);
  expect(w.ahriCharmAudio).toHaveLength(1);
  restore(w);
  w.step();
  expect(w.ahriCharmAudio).toEqual([]);
});

test('range stop retains the endpoint and expires after the finite flight master', () => {
  const { w } = setup(false);
  w.step(54);
  const r = w.ahriCharmAudio[0];
  expect(r.hit).toBeNull();
  expect(r.stop?.reason).toBe('range');
  expect(r.stop!.point.x).toBeCloseTo(1000, 9);
  expect(charmAudioExpiry(r)).toBe(r.launch!.tick + 122);
  restore(w);
});

test('death cancels an unreleased windup without inventing a flight or hit', () => {
  const { w, ahri, target } = setup();
  w.damage(target, ahri, 1e6, 'true');
  expect(w.ahriCharmAudio[0]).toMatchObject({ cancelTick: 1, launch: null, hit: null });
  restore(w);
  w.step(79);
  expect(w.ahriCharmAudio).toHaveLength(1);
  w.step();
  expect(w.ahriCharmAudio).toEqual([]);
});

test('released flight and contact remain audible records after caster death', () => {
  const { w, ahri, target } = setup();
  w.step(15);
  w.damage(target, ahri, 1e6, 'true');
  restore(w);
  w.step(20);
  expect(w.ahriCharmAudio[0].hit?.targetId).toBe(target.id);
  expect(w.ahriCharmAudio[0].cancelTick).toBeNull();
  restore(w);
});

test('saved history rejects detached IDs, clocks, points, audiences and invented contacts', () => {
  const { w } = setup();
  w.step(15);
  const raw = JSON.parse(w.snapshot());
  const mutations = [
    (s: typeof raw) => s.ahriCharmAudio.push(structuredClone(s.ahriCharmAudio[0])),
    (s: typeof raw) => s.ahriCharmAudio[0].launch.id++,
    (s: typeof raw) => s.ahriCharmAudio[0].launch.tick++,
    (s: typeof raw) => s.ahriCharmAudio[0].launch.currentPoint.x++,
    (s: typeof raw) => (s.ahriCharmAudio[0].castAudience = ['blue', 'blue']),
    (s: typeof raw) => (s.ahriCharmAudio[0].cancelTick = 1),
    (s: typeof raw) =>
      (s.ahriCharmAudio[0].hit = {
        tick: w.tick,
        point: { x: 0, y: 0 },
        targetId: 1,
        audience: ['blue'],
      }),
    (s: typeof raw) => (s.ahriCharmAudio = []),
  ];
  for (const mutate of mutations) {
    const bad = structuredClone(raw);
    mutate(bad);
    expect(() => World.fromSnapshot(JSON.stringify(bad), w.battlefield)).toThrow();
  }
});

test('victory cancels windup or stops flight immediately and preserves frozen points', () => {
  for (const released of [false, true]) {
    const { w, ahri } = setup(false);
    if (released) w.step(15);
    const nexus = w.spawn('nexus', 'red', { x: 5000, y: 5000 });
    const flightPoint = w.projectiles[0] && { x: w.projectiles[0].x, y: w.projectiles[0].y };
    w.damage(ahri, nexus, 1e9, 'true');
    expect(w.winner).toBe('blue');
    const r = w.ahriCharmAudio[0];
    if (released) expect(r.stop).toEqual({ tick: w.tick, point: flightPoint, reason: 'match-end' });
    else expect(r.cancelTick).toBe(w.tick);
    expect(r.hit).toBeNull();
    restore(w);
  }
});

test('a reveal after birth does not rewrite the saved cast audience', () => {
  const { w, ahri } = setup(false);
  // Start a second accepted cast while the remote team cannot see the caster.
  w.step(81);
  w.championState(ahri.id)!.cooldowns.e = 0;
  w.pointVisible = () => false;
  w.enqueue({ type: 'cast', unit: ahri.id, ability: 'e', point: { x: 900, y: 0 } });
  w.step();
  const r = w.ahriCharmAudio.at(-1)!;
  expect(r.castAudience).toEqual(['blue']);
  w.pointVisible = () => true;
  w.step(15);
  expect(r.castAudience).toEqual(['blue']);
  expect(r.launch?.audience).toEqual(['blue', 'red']);
  restore(w);
});
