import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { daybreakParticles } from '../src/render/leona-q-particles';
import profiles from '../src/content/leona-q-particles.json';
import {
  LEONA_Q_CAST_TAIL_TICKS,
  LEONA_Q_HIT_HISTORY_TICKS,
  LEONA_Q_PROFILE_SHA256,
} from '../src/content/leona-q-presentation';
import { projectGroundQuad } from '../src/render/ground-quad';
import { maskGroundWalkability } from '../src/render/ground-walkability-mask';

function fixture() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    lineWalkable: () => true,
    findPath: (_a, b) => [{ ...b }],
    reachable: (p) => ({ x: p.x, y: p.y }),
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const u = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona'),
    target = w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
  target.hp = target.maxHp = 100000;
  const s = w.championState(u.id)!;
  w.learnSpell('q', u.id);
  const cast = () => {
    w.enqueue({ type: 'cast', unit: u.id, ability: 'q', point: target });
    w.step();
  };
  const attack = () => w.setOrder(u, { type: 'attack', target: target.id });
  const restore = () => World.fromSnapshot(w.snapshot(), w.battlefield);
  return { w, u, target, s, cast, attack, restore };
}

test('all fifteen profiles and seventeen texture pins rebuild, preserving the two disabled source records', () => {
  execFileSync('python3', ['tools/assets/export-leona-q-particles.py', '--check']);
  expect(
    createHash('sha256').update(readFileSync('src/content/leona-q-particles.json')).digest('hex')
  ).toBe(LEONA_Q_PROFILE_SHA256);
  expect(profiles).toHaveLength(15);
  expect(profiles.filter((p) => p.disabled).map((p) => p.name)).toEqual(['flash', 'nova']);
  const pin = JSON.parse(readFileSync('docs/reference/leona-q-particles-decoded.json', 'utf8'));
  expect(pin.textures).toHaveLength(17);
  for (const t of pin.textures)
    expect(createHash('sha256').update(readFileSync(t.path)).digest('hex')).toBe(t.sha256);
  expect(LEONA_Q_CAST_TAIL_TICKS).toBe(62);
  expect(LEONA_Q_HIT_HISTORY_TICKS).toBe(77);
});

test('all thirteen enabled families emit, delay sparks correctly, keep fixed source draws and filter excluded sigil keywords', () => {
  expect(daybreakParticles('cast', 1, 0)).toEqual([]);
  const cast = daybreakParticles('cast', 1, 1 / 60);
  expect([...new Set(cast.map((p) => p.profileIndex))]).toEqual([0, 1, 2, 3, 4, 5]);
  expect(cast).toHaveLength(7);
  expect(daybreakParticles('cast', 1, 1 / 60)).toEqual(cast);
  const early = daybreakParticles('hit', 1, 1 / 60);
  expect([...new Set(early.map((p) => p.profileIndex))]).toEqual([8, 10, 11, 12, 13]);
  const spark = daybreakParticles('hit', 1, 6 / 60);
  expect(spark.filter((p) => p.profileIndex === 9)).toHaveLength(10);
  expect(spark.filter((p) => p.profileIndex === 9).every((p) => p.bornTick === 6)).toBe(true);
  expect(spark.some((p) => p.profileIndex === 14 && p.bornTick === 5)).toBe(true);
  expect(
    daybreakParticles('hit', 1, 0.1, Infinity, 35, ['BattlebunnyRiven']).some((p) =>
      [12, 13].includes(p.profileIndex)
    )
  ).toBe(false);
  expect(daybreakParticles('hit', 1, LEONA_Q_HIT_HISTORY_TICKS / 60)).toEqual([]);
});

test('cast stops cap type-zero natural lives without extending them and never birth after a stop', () => {
  expect(daybreakParticles('cast', 1, 1 / 60, 0)).toEqual([]);
  const after = daybreakParticles('cast', 1, 0.3, 0.25);
  expect([...new Set(after.map((p) => p.profileIndex))]).toEqual([0, 3]);
  expect(after.every((p) => p.bornTick === 1 && p.life <= p.naturalLife)).toBe(true);
  expect(daybreakParticles('cast', 1, 1.25, 0.25)).toEqual([]);
});

test('accepted activation/contact uses no cosmetic gameplay IDs/RNG and restores identical moving futures', () => {
  const f = fixture(),
    id = f.w.nextId,
    random = f.w.random.state;
  f.cast();
  expect(f.w.nextId - id).toBe(1);
  expect(f.w.random.state).toBe(random);
  expect(f.s.leonaQVisuals[0]).toMatchObject({
    startTick: 1,
    rank: 1,
    stopTick: null,
    impact: null,
  });
  f.attack();
  f.w.step(16);
  const r = f.s.leonaQVisuals[0];
  expect(r.stopTick).toBe(17);
  expect(r.endReason).toBe('consumed');
  expect(r.impact?.tick).toBe(17);
  expect(f.w.random.state).toBe(random);
  f.w.setOrder(f.u, { type: 'move', point: { x: 0, y: 1000 } });
  const copy = f.restore();
  f.w.step(65);
  copy.step(65);
  expect(copy.snapshot()).toBe(f.w.snapshot());
  // Caster poses stop being retained before the longer hit tail ends.
  expect(f.s.leonaQVisuals[0].frames.at(-1)!.tick).toBe(17 + LEONA_Q_CAST_TAIL_TICKS - 1);
  f.w.step(12);
  copy.step(12);
  expect(copy.snapshot()).toBe(f.w.snapshot());
  expect(f.s.leonaQVisuals).toEqual([]);
});

test('expiry retains a committed late Q contact and only the required pose tails', () => {
  const f = fixture();
  f.cast();
  f.w.step(350);
  f.attack();
  f.w.step();
  const copy = f.restore();
  f.w.step(20);
  copy.step(20);
  const r = f.s.leonaQVisuals[0];
  expect(r.endReason).toBe('expired');
  expect(r.stopTick).toBe(361);
  expect(r.impact?.tick).toBe(367);
  expect(copy.snapshot()).toBe(f.w.snapshot());
});

test('recast closes the previous shield system and target loss produces no invented impact', () => {
  const f = fixture();
  f.cast();
  f.w.step(299);
  f.cast();
  expect(f.s.leonaQVisuals.map((r) => [r.startTick, r.stopTick, r.endReason])).toEqual([
    [1, 301, 'recast'],
    [301, null, null],
  ]);
  f.attack();
  f.w.step();
  f.w.damage(f.w.hero, f.target, 1e6, 'true');
  f.w.step(20);
  expect(f.s.leonaQVisuals.every((r) => r.impact === null)).toBe(true);
  expect(() => f.restore()).not.toThrow();
});

test('lethal contacts and caster death freeze posed endpoints and resume through saved futures', () => {
  const f = fixture();
  f.target.hp = 10;
  f.cast();
  f.attack();
  f.w.step(16);
  const hit = f.s.leonaQVisuals[0].impact!;
  expect(hit.detachedTick).toBe(hit.tick);
  f.w.damage(f.target, f.u, 1e6, 'true');
  expect(() => f.restore()).not.toThrow();
  const copy = f.restore();
  f.w.step(20);
  copy.step(20);
  expect(copy.snapshot()).toBe(f.w.snapshot());
  expect(f.s.leonaQVisuals[0].detachedTick).not.toBeNull();
});

test('strict saved presentation rejects missing ownership, changed ranks/clocks, forged targets and detached audience changes', () => {
  const f = fixture();
  f.cast();
  f.attack();
  f.w.step(16);
  const forge = (mutate: (s: any, r: any) => void) => {
    const s = JSON.parse(f.w.snapshot()),
      o = s.otherChampions.find((o: any) => o.id === f.u.id);
    mutate(s, o.leonaQVisuals[0]);
    expect(() => World.fromSnapshot(JSON.stringify(s), f.w.battlefield)).toThrow();
  };
  forge((_s, r) => (r.rank = 5));
  forge((_s, r) => r.startTick++);
  forge((_s, r) => r.impact.tick++);
  forge((_s, r) => (r.impact.targetId = f.u.id));
  forge((_s, r) => (r.frames[0].animationTimeline.primary.clip = 'idle5'));
  forge((_s, r) => r.impact.frames.pop());
  f.w.damage(f.w.hero, f.target, 1e6, 'true');
  f.w.step(3);
  forge((_s, r) => (r.impact.frames.at(-1).audience = []));
  const g = fixture();
  g.cast();
  const s = JSON.parse(g.w.snapshot());
  s.otherChampions.find((o: any) => o.id === g.u.id).leonaQVisuals = [];
  expect(() => World.fromSnapshot(JSON.stringify(s), g.w.battlefield)).toThrow();
});

test('projected ground masks restore masked cells and reject unwalkable vertices/centroids without replacing GPU index capacity', () => {
  const g = new THREE.BufferGeometry(),
    quad = {
      origin: { x: 0, y: 0 },
      target: { x: 0, y: 1 },
      offset: [0, 0, 0],
      halfSize: [100, 100],
      rotation: [-90, 0, 0],
    };
  projectGroundQuad(g, quad, () => 0, 50);
  const index = g.getIndex()!,
    full = g.drawRange.count;
  maskGroundWalkability(g, (p) => p.x <= 0);
  expect(g.drawRange.count).toBeLessThan(full);
  expect(g.drawRange.count).toBeGreaterThan(0);
  projectGroundQuad(g, quad, () => 0, 50);
  maskGroundWalkability(g, () => true);
  expect(g.drawRange.count).toBe(full);
  expect(g.getIndex()).toBe(index);
  maskGroundWalkability(g, () => false);
  expect(g.drawRange.count).toBe(0);
});

test.each(['death', 'match-end', 'recast', 'caster-detachment', 'target-detachment'])(
  'saved Q rejects contradictory %s phases on a living contacted pair',
  (phase) => {
    const f = fixture();
    f.cast();
    f.attack();
    f.w.step(16);
    const s = JSON.parse(f.w.snapshot());
    const r = s.otherChampions.find((o: any) => o.id === f.u.id).leonaQVisuals[0];
    if (phase === 'caster-detachment') r.detachedTick = s.tick;
    else if (phase === 'target-detachment') r.impact.detachedTick = s.tick;
    else r.endReason = phase;
    expect(() => World.fromSnapshot(JSON.stringify(s), f.w.battlefield)).toThrow();
  }
);
