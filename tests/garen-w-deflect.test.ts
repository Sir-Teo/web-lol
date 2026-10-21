import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { GAREN_W_DEFLECT_TAIL_TICKS } from '../src/content/garen-w-particle-timing';
import { garenCourageDeflectParticles } from '../src/render/garen-courage-particles';

function setup() {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] }, 'garen');
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = 0;
  w.hero.previous = { x: 0, y: 0 };
  const source = w.spawn('dummy', 'red', { x: 3000, y: 0 });
  w.learnSpell('w');
  const cast = () => {
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: w.hero });
    w.step();
  };
  cast();
  return { w, source, cast };
}

test('Courage reaction is tied to actual positive physical/magic reduction, including fully shielded hits', () => {
  for (const [kind, raw, count] of [
    ['physical', 10, 1],
    ['magic', 10, 1],
    ['true', 10, 0],
    ['physical', 0, 0],
    ['magic', -10, 0],
  ] as const) {
    const { w, source } = setup();
    expect(w.player.garenWDeflects).toEqual([]);
    const hp = w.hero.hp;
    w.damage(source, w.hero, raw, kind);
    expect(w.hero.hp).toBe(hp);
    expect(w.player.garenWDeflects).toHaveLength(count);
    if (count) expect(w.player.garenWDeflects[0]).toEqual({ tick: 1, castTick: 1 });
    expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).not.toThrow();
  }
});

test('Courage coalesces dense same-tick hits and retains a bounded chronological reaction window', () => {
  const { w, source } = setup();
  for (let i = 0; i < 100; i++) w.damage(source, w.hero, 0.01, 'physical');
  expect(w.player.garenWDeflects).toHaveLength(1);
  for (let i = 0; i < 100; i++) {
    w.step();
    w.damage(source, w.hero, 0.01, 'magic');
    expect(w.player.garenWDeflects.length).toBeLessThanOrEqual(GAREN_W_DEFLECT_TAIL_TICKS);
  }
  expect(w.player.garenWDeflects).toHaveLength(GAREN_W_DEFLECT_TAIL_TICKS);
  expect(w.player.garenWDeflects.at(-1)?.tick).toBe(w.tick);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
  w.step(GAREN_W_DEFLECT_TAIL_TICKS);
  expect(w.player.garenWDeflects).toEqual([]);
});

test('Courage reactions continue after shield depletion, stop accepting hits at defense expiry and retain the last tail', () => {
  const { w, source } = setup();
  w.damage(source, w.hero, 70, 'true');
  expect(w.shieldAmount(w.hero)).toBe(0);
  const expiry = w.player.garenW!.defenseUntil;
  w.step(expiry - 1 - w.tick);
  w.damage(source, w.hero, 10, 'physical');
  expect(w.player.garenWDeflects).toEqual([{ tick: expiry - 1, castTick: 1 }]);
  w.step();
  w.damage(source, w.hero, 10, 'magic');
  expect(w.player.garenW).toBeNull();
  expect(w.player.garenWDeflects).toHaveLength(1);
  const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
  expect(saved.snapshot()).toBe(w.snapshot());
  expect(garenCourageDeflectParticles(w.hero.id, w.player.garenWDeflects, w.tick)).toHaveLength(1);
  w.step(GAREN_W_DEFLECT_TAIL_TICKS);
  saved.step(GAREN_W_DEFLECT_TAIL_TICKS);
  expect(w.player.garenWDeflects).toEqual([]);
  expect(saved.snapshot()).toBe(w.snapshot());
});

test('a lethal reduced hit preserves its reaction through death and deterministic restore without replaying damage', () => {
  const { w, source } = setup();
  w.step(20);
  w.damage(source, w.hero, 1e6, 'physical');
  expect(w.hero.deadAt).toBe(w.tick);
  expect(w.player.garenWDeflects).toEqual([{ tick: w.tick, castTick: 1 }]);
  const saved = w.snapshot(),
    restored = World.fromSnapshot(saved, w.battlefield);
  const particles = (x: World) =>
    garenCourageDeflectParticles(x.hero.id, x.player.garenWDeflects, x.tick);
  for (const step of [1, 12, 20, 30]) {
    w.step(step);
    restored.step(step);
    expect(particles(restored)).toEqual(particles(w));
    expect(restored.snapshot()).toBe(w.snapshot());
  }
  expect(w.player.garenWDeflects).toEqual([]);
});

test('practice recasts retain prior damage reactions under stable clocks while new hits belong to the new cast', () => {
  const { w, source, cast } = setup();
  w.damage(source, w.hero, 10, 'physical');
  w.player.cooldowns.w = 0;
  cast();
  w.damage(source, w.hero, 10, 'magic');
  expect(w.player.garenWDeflects).toEqual([
    { tick: 1, castTick: 1 },
    { tick: 2, castTick: 2 },
  ]);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
  w.step();
  const before = w.snapshot();
  expect(garenCourageDeflectParticles(w.hero.id, w.player.garenWDeflects, w.tick)).toHaveLength(2);
  expect(w.snapshot()).toBe(before);
});

test('match end keeps accepted reactions without creating new frozen-clock hits', () => {
  const { w, source } = setup();
  w.damage(source, w.hero, 10, 'physical');
  const nexus = w.spawn('nexus', 'red', { x: 0, y: 0 });
  w.damage(w.hero, nexus, 1e6, 'true');
  expect(w.winner).toBe('blue');
  const saved = w.snapshot();
  w.damage(source, w.hero, 10, 'magic');
  w.step(100);
  expect(w.snapshot()).toBe(saved);
  expect(World.fromSnapshot(saved, w.battlefield).snapshot()).toBe(saved);
});

test('Courage reaction snapshots reject missing, foreign, unordered, future, mismatched and expired histories', () => {
  const { w, source } = setup();
  w.step(10);
  w.damage(source, w.hero, 10, 'physical');
  const base = JSON.parse(w.snapshot());
  for (const mutate of [
    (s: any) => delete s.player.garenWDeflects,
    (s: any) => s.player.garenWDeflects.push(s.player.garenWDeflects[0]),
    (s: any) => s.player.garenWDeflects.push({ tick: 10, castTick: 1 }),
    (s: any) => s.player.garenWDeflects[0].tick++,
    (s: any) => (s.player.garenWDeflects[0].castTick = 12),
    (s: any) => (s.player.garenWDeflects[0].castTick = 0),
    (s: any) => (s.player.garenWDeflects[0].tick = 0),
    (s: any) => (s.player.garenWDeflects[0].extra = true),
    (s: any) => (s.version = 80),
  ]) {
    const s = structuredClone(base);
    mutate(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  }
  w.step(GAREN_W_DEFLECT_TAIL_TICKS);
  const expired = JSON.parse(w.snapshot());
  expired.player.garenWDeflects = base.player.garenWDeflects;
  expect(() => World.fromSnapshot(JSON.stringify(expired), w.battlefield)).toThrow(/deflection/);
  const foreign = new World(false),
    s = JSON.parse(foreign.snapshot());
  s.player.garenWDeflects = [{ tick: 0, castTick: 0 }];
  expect(() => World.fromSnapshot(JSON.stringify(s), foreign.battlefield)).toThrow(/deflection/);
});
