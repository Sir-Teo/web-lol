import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { eclipseVisualExpiry } from '../src/simulation/leona-w-visuals';

function fixture() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    lineWalkable: () => true,
    findPath: (_a, b) => [{ ...b }],
    reachable: (p) => ({ ...p }),
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const u = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona'),
    target = w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
  target.hp = target.maxHp = 100000;
  for (const v of w.units) v.ai = false;
  w.learnSpell('w', u.id);
  const s = w.championState(u.id)!;
  const cast = () => {
    w.enqueue({ type: 'cast', unit: u.id, ability: 'w', point: u });
    w.step();
  };
  const restore = () => World.fromSnapshot(w.snapshot(), w.battlefield);
  return { w, u, target, s, cast, restore };
}
test('Eclipse activation and contact own no extra gameplay IDs/RNG and armed saves restore exact futures', () => {
  const f = fixture(),
    id = f.w.nextId,
    random = f.w.random.state;
  f.cast();
  expect(f.w.nextId - id).toBe(1);
  expect(f.w.random.state).toBe(random);
  expect(f.s.leonaWVisuals[0]).toMatchObject({
    startTick: 1,
    rank: 1,
    stopTick: null,
    detonation: null,
  });
  f.w.step(179);
  const copy = f.restore();
  f.w.step(10);
  copy.step(10);
  expect(copy.snapshot()).toBe(f.w.snapshot());
  expect(f.w.random.state).toBe(random);
  expect(f.s.leonaWVisuals[0].detonation).toMatchObject({
    tick: 181,
    result: 'hit',
    contacts: [{ targetId: f.target.id, targetKind: 'champion' }],
  });
});
test('a moving detonation preserves its pre-movement point separately from end-of-tick posed placement', () => {
  const f = fixture();
  f.cast();
  f.w.step(179);
  const before = { x: f.u.x, y: f.u.y };
  f.w.setOrder(f.u, { type: 'move', point: { x: 1000, y: 0 } });
  f.w.step();
  expect(f.s.leonaWVisuals[0].detonation?.point).toEqual(before);
  expect(f.u.x).not.toBe(before.x);
  expect(() => f.restore()).not.toThrow();
});
test('a successful Eclipse retires at six seconds and its saved finite tails expire identically', () => {
  const f = fixture();
  f.cast();
  f.w.step(359);
  const copy = f.restore();
  f.w.step();
  copy.step();
  expect(f.s.leonaW).toBeNull();
  const r = f.s.leonaWVisuals[0];
  expect(r).toMatchObject({ stopTick: 361, endReason: 'expired' });
  expect(copy.snapshot()).toBe(f.w.snapshot());
  const remaining = eclipseVisualExpiry(r) - f.w.tick;
  f.w.step(remaining);
  copy.step(remaining);
  expect(f.s.leonaWVisuals).toEqual([]);
  expect(copy.snapshot()).toBe(f.w.snapshot());
});
test('a missed Eclipse records its actual empty detonation and never starts extension', () => {
  const f = fixture();
  f.target.x = 2000;
  f.cast();
  f.w.step(180);
  expect(f.s.leonaW).toBeNull();
  expect(f.s.leonaWVisuals[0]).toMatchObject({
    stopTick: 181,
    endReason: 'miss',
    detonation: { result: 'miss', contacts: [] },
  });
  const copy = f.restore();
  f.w.step(100);
  copy.step(100);
  expect(copy.snapshot()).toBe(f.w.snapshot());
});
test('death before detonation closes the buff without inventing a burst and freezes the posed endpoint', () => {
  const f = fixture();
  f.cast();
  f.w.step(30);
  f.w.damage(f.target, f.u, 1e9, 'true');
  expect(f.s.leonaWVisuals[0]).toMatchObject({
    stopTick: 31,
    endReason: 'death',
    detachedTick: 31,
    detonation: null,
  });
  const copy = f.restore();
  f.w.step(40);
  copy.step(40);
  expect(copy.snapshot()).toBe(f.w.snapshot());
});
test('lethal detonation and later source death retain both contact and caster endpoints', () => {
  const f = fixture();
  f.target.hp = 1;
  f.cast();
  f.w.step(180);
  const r = f.s.leonaWVisuals[0];
  expect(r.detonation?.contacts[0].detachedTick).toBe(181);
  f.w.damage(f.target, f.u, 1e9, 'true');
  expect(r.detachedTick).toBe(181);
  const copy = f.restore();
  f.w.step(40);
  copy.step(40);
  expect(copy.snapshot()).toBe(f.w.snapshot());
});
test.each([30, 190])(
  'recast at age %i closes only the active buff and preserves prior contact history',
  (age) => {
    const f = fixture();
    f.cast();
    f.w.step(age);
    f.s.cooldowns.w = f.w.tick;
    f.u.mana = f.u.maxMana;
    f.cast();
    expect(f.s.leonaWVisuals).toHaveLength(2);
    const old = f.s.leonaWVisuals[0],
      next = f.s.leonaWVisuals[1];
    expect(old.endReason).toBe('recast');
    expect(old.stopTick).toBe(next.startTick);
    expect(!!old.detonation).toBe(age >= 180);
    const copy = f.restore();
    f.w.step(20);
    copy.step(20);
    expect(copy.snapshot()).toBe(f.w.snapshot());
  }
);
test('actual victory stops buff ownership and keeps the winning snapshot frozen', () => {
  const f = fixture();
  f.cast();
  f.w.step(180);
  const nexus = f.w.spawn('nexus', 'red', { x: 1000, y: 1000 });
  nexus.hp = 1;
  f.w.damage(f.w.hero, nexus, 1e9, 'true');
  expect(f.w.winner).toBe('blue');
  expect(f.s.leonaWVisuals[0]).toMatchObject({ stopTick: 181, endReason: 'match-end' });
  expect(() => f.restore()).not.toThrow();
  const saved = f.w.snapshot();
  f.w.step(20);
  expect(f.w.snapshot()).toBe(saved);
});
test.each([
  'ownership',
  'rank',
  'release',
  'empty-hit',
  'source-detach',
  'target-detach',
  'death',
  'match-end',
  'recast',
  'ward',
  'structure-rig',
  'history',
  'duplicate-contact',
])('strict Eclipse saves reject contradictory %s records', (mode) => {
  const f = fixture();
  f.cast();
  f.w.step(180);
  const saved = JSON.parse(f.w.snapshot()),
    owner = saved.otherChampions.find((o: any) => o.id === f.u.id),
    r = owner.leonaWVisuals[0],
    d = r.detonation;
  if (mode === 'ownership') owner.leonaWVisuals = [];
  else if (mode === 'rank') r.rank = 5;
  else if (mode === 'release') d.tick--;
  else if (mode === 'empty-hit') d.contacts = [];
  else if (mode === 'source-detach') r.detachedTick = saved.tick;
  else if (mode === 'target-detach') d.contacts[0].detachedTick = saved.tick;
  else if (['death', 'match-end', 'recast'].includes(mode)) {
    r.stopTick = saved.tick;
    r.endReason = mode;
  } else if (mode === 'ward') d.contacts[0].targetKind = 'ward';
  else if (mode === 'structure-rig') d.contacts[0].targetRig = 'order-nexus';
  else if (mode === 'history') r.frames.pop();
  else d.contacts.push(structuredClone(d.contacts[0]));
  expect(() => World.fromSnapshot(JSON.stringify(saved), f.w.battlefield)).toThrow();
});
test('a missed record cannot be relabeled as a later real source death', () => {
  const f = fixture();
  f.target.x = 2000;
  f.cast();
  f.w.step(200);
  f.w.damage(f.target, f.u, 1e9, 'true');
  const saved = JSON.parse(f.w.snapshot()),
    r = saved.otherChampions.find((o: any) => o.id === f.u.id).leonaWVisuals[0];
  r.stopTick = saved.tick;
  r.endReason = 'death';
  expect(() => World.fromSnapshot(JSON.stringify(saved), f.w.battlefield)).toThrow();
});
test('detached contact audiences cannot change after their frozen endpoint', () => {
  const f = fixture();
  f.target.hp = 1;
  f.cast();
  f.w.step(184);
  const saved = JSON.parse(f.w.snapshot()),
    r = saved.otherChampions.find((o: any) => o.id === f.u.id).leonaWVisuals[0];
  const last = r.detonation.contacts[0].frames.at(-1);
  last.audience = last.audience.length ? [] : ['blue'];
  expect(() => World.fromSnapshot(JSON.stringify(saved), f.w.battlefield)).toThrow();
});
