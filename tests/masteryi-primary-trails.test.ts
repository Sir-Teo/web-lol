import { expect, test, vi } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import {
  primaryTrailMarkerTick,
  primaryTrailExpiry,
  advancePrimaryTrailRoots,
} from '../src/simulation/masteryi-primary-trails';
import { PRIMARY_TRAIL_MARKERS } from '../src/content/masteryi-primary-trail-timing';
import { actorRootKnown } from '../src/simulation/actor-root-history';
import { primaryTrailParticles } from '../src/render/masteryi-primary-trail-particles';
import data from '../src/content/masteryi-primary-trail-particles.json';
function fixture(critical = false) {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
  });
  w.nextWaveTick = Infinity;
  const yi = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'masteryi'),
    target = w.spawn('dummy', 'red', { x: 150, y: 0 });
  yi.ai = target.ai = false;
  target.hp = target.maxHp = 1e6;
  const spy = critical ? vi.spyOn(w, 'criticalChance').mockReturnValue(1) : undefined;
  w.setOrder(yi, { type: 'attack', target: target.id });
  w.step();
  spy?.mockRestore();
  const owner = w.championState(yi.id)!,
    record = owner.masterYiAAAudio[0];
  return { w, yi, target, owner, record };
}
function resume(w: World, ticks = 40) {
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, w.battlefield);
  expect(copy.snapshot()).toBe(saved);
  w.step(ticks);
  copy.step(ticks);
  expect(copy.snapshot()).toBe(w.snapshot());
}
test.each(['attack1', 'attack2', 'crit'] as const)(
  '%s marker is the exact first current-pose clock crossing',
  (kind) => {
    for (const duration of [3, 4, 7, 17, 54, 55, 56, 89, 100, 1000, 1000000]) {
      const marker = PRIMARY_TRAIL_MARKERS[kind],
        startTick = 73,
        tick = primaryTrailMarkerTick({ startTick, endTick: startTick + duration, kind });
      const rate = marker.renderedDuration / (duration / 60),
        offset = tick - startTick;
      expect((offset / 60) * rate).toBeGreaterThanOrEqual(marker.renderedSeconds);
      expect(((offset - 1) / 60) * rate).toBeLessThan(marker.renderedSeconds);
    }
  }
);
test.each([0, -1, NaN, Infinity])('invalid cycle length %s rejects', (duration) =>
  expect(() =>
    primaryTrailMarkerTick({ startTick: 1, endTick: 1 + duration, kind: 'attack1' })
  ).toThrow('Invalid primary trail cycle')
);
test.each([false, true])(
  'real %s-critical admission retains roots and exact future',
  (critical) => {
    const f = fixture(critical);
    expect(f.record.kind).toBe(critical ? 'crit' : 'attack1');
    expect(f.record.trailFrames).toHaveLength(1);
    expect(f.record.trailFrames[0]).toMatchObject({
      tick: f.record.startTick,
      endTick: f.w.tick,
      x: f.yi.x,
    });
    f.w.step(primaryTrailMarkerTick(f.record) + 2 - f.w.tick);
    expect(f.record.trailFrames.at(-1)!.endTick).toBe(f.w.tick);
    resume(f.w);
  }
);
test('cancellation preserves existing audio admission and exact root history', () => {
  const f = fixture();
  f.w.setOrder(f.yi, { type: 'idle' });
  expect(f.record.cancelTick).toBe(f.w.tick);
  f.w.step(3);
  resume(f.w, 20);
});
test('rolling roots clear at the exact finite bound while original audio stays retained', () => {
  const f = fixture(),
    expiry = primaryTrailExpiry(f.record);
  f.w.setOrder(f.yi, { type: 'idle' });
  f.w.step(expiry - 1 - f.w.tick);
  expect(f.record.trailFrames[0].tick).toBe(f.w.tick - 19);
  expect(f.record.trailFrames.at(-1)!.endTick).toBe(f.w.tick);
  f.w.step();
  expect(f.record.trailFrames).toEqual([]);
  expect(f.owner.masterYiAAAudio).toContain(f.record);
  resume(f.w, 1);
});
test('source root updates consume no game RNG or IDs', () => {
  const f = fixture(),
    rng = f.w.random.state,
    id = f.w.nextId,
    saved = f.w.snapshot();
  advancePrimaryTrailRoots(f.w);
  expect(f.w.random.state).toBe(rng);
  expect(f.w.nextId).toBe(id);
  expect(f.w.snapshot()).toBe(saved);
});
test('actual moving endpoints remain bounded and losslessly saved', () => {
  const f = fixture();
  f.w.setOrder(f.yi, { type: 'move', point: { x: 500, y: 200 } });
  f.w.step(15);
  expect(f.record.trailFrames.length).toBeGreaterThan(1);
  expect(f.record.trailFrames.at(-1)).toMatchObject({ x: f.yi.x, y: f.yi.y });
  resume(f.w, 15);
});
test('Q body hiding preserves its exact caster visibility and saved future', () => {
  const f = fixture();
  f.w.gainExperience(1e6, f.yi.id);
  f.w.learnSpell('q', f.yi.id);
  f.w.step(primaryTrailMarkerTick(f.record) + 2 - f.w.tick);
  f.w.enqueue({
    type: 'cast',
    unit: f.yi.id,
    ability: 'q',
    point: f.target,
    targetId: f.target.id,
  });
  f.w.step();
  expect(actorRootKnown(f.record.trailFrames, f.w.tick, 'blue')).toBe(false);
  resume(f.w, 25);
});
test('death updates the current corpse endpoint before saving', () => {
  const f = fixture();
  f.w.step(primaryTrailMarkerTick(f.record) + 2 - f.w.tick);
  f.w.damage(f.target, f.yi, 1e9, 'true');
  expect(f.yi.deadAt).toBe(f.w.tick);
  expect(f.record.trailFrames.at(-1)).toMatchObject({ x: f.yi.x, y: f.yi.y, endTick: f.w.tick });
  resume(f.w, 25);
});
for (const mutation of [
  'missing',
  'endpoint',
  'coverage',
  'audience',
  'noncanonical',
  'expired',
] as const)
  test('decoder rejects ' + mutation + ' primary trail roots', () => {
    const f = fixture();
    f.w.setOrder(f.yi, { type: 'idle' });
    f.w.step(mutation === 'expired' ? primaryTrailExpiry(f.record) - f.w.tick : 3);
    const saved = JSON.parse(f.w.snapshot()),
      owner = saved.otherChampions.find((s: any) => s.id === f.yi.id),
      r = owner.masterYiAAAudio[0];
    if (mutation === 'missing') r.trailFrames = [];
    if (mutation === 'endpoint') r.trailFrames.at(-1).x++;
    if (mutation === 'coverage') r.trailFrames[0].tick++;
    if (mutation === 'audience') r.trailFrames.at(-1).audience = [];
    if (mutation === 'noncanonical') {
      const first = r.trailFrames[0];
      r.trailFrames = [
        { ...first, endTick: first.tick },
        { ...first, tick: first.tick + 1 },
      ];
    }
    if (mutation === 'expired')
      r.trailFrames = [
        {
          tick: saved.tick,
          endTick: saved.tick,
          x: f.yi.x,
          y: f.yi.y,
          facing: f.yi.facing,
          audience: ['blue'],
        },
      ];
    expect(() => World.fromSnapshot(JSON.stringify(saved), f.w.battlefield)).toThrow();
  });
test('all three complete finite source families retain native texture/mesh metadata', () => {
  expect(data.profiles).toHaveLength(3);
  expect(data.textures).toHaveLength(4);
  expect(data.textures.reduce((n, t) => n + t.rectangles.length, 0)).toBe(34);
  expect(data.mesh.exportedCorners).toBe(1500);
  expect(data.profiles.map((p) => p.rawFlags.blendMode)).toEqual([null, 4, null]);
  expect(data.markers.map((m) => m.glbNode)).toEqual([85, 85, 85]);
  for (let profile = 0; profile < 3; profile++) {
    expect(primaryTrailParticles(17, 0, profile)).toEqual([]);
    const p = primaryTrailParticles(17, 1 / 60, profile);
    expect(p).toHaveLength(1);
    expect(p[0].profileIndex).toBe(profile);
    expect(p[0].bind).toBe(1);
    expect(p[0].age).toBe(0);
    expect(primaryTrailParticles(17, 1, profile)).toEqual([]);
    expect(primaryTrailParticles(17, 1e6, profile)).toEqual([]);
  }
});
test('source UV scroll, scale and critical rotation stay literal', () => {
  const normal = primaryTrailParticles(0, 0.1, 0)[0],
    critical = primaryTrailParticles(0, 0.1, 2)[0];
  expect(normal.rotation).toEqual([0, 0, 0]);
  expect(normal.size).toEqual([0.699999988079071, 0.699999988079071, 0.699999988079071]);
  expect(critical.rotation).toEqual([0, 0, 100]);
  expect(critical.size).toEqual([0.699999988079071, 1, 0.699999988079071]);
  expect(normal.uv.offset[0]).toBeCloseTo(
    (((data.profiles[0].uv.birthScroll.values[0][0] * normal.age) % 1) + 1) % 1,
    12
  );
  expect(critical.uv.offset[0]).toBeCloseTo(
    (((data.profiles[2].uv.birthScroll.values[0][0] * critical.age) % 1) + 1) % 1,
    12
  );
});
test.each([-1, NaN, Infinity, -Infinity])('invalid particle time %s has no particles', (time) =>
  expect(primaryTrailParticles(1, time)).toEqual([])
);

test('a late Yi spawn begins collecting roots after ordinary world steps', () => {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
  });
  w.nextWaveTick = Infinity;
  w.step(10);
  const yi = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'masteryi');
  const target = w.spawn('dummy', 'red', { x: 150, y: 0 });
  yi.ai = target.ai = false;
  w.setOrder(yi, { type: 'attack', target: target.id });
  w.step(3);
  const record = w.championState(yi.id)!.masterYiAAAudio[0];
  expect(record.trailFrames[0].tick).toBe(record.startTick);
  expect(record.trailFrames.at(-1)!.endTick).toBe(w.tick);
  resume(w);
});

test('Attack2 retains its authored additive offset, omitted-scale adapter and positive UV scroll', () => {
  const particle = primaryTrailParticles(17, 0.1, 1)[0];
  expect(particle.offset).toEqual([0, -40, -20]);
  expect(particle.size).toEqual([1, 1, 1]);
  expect(particle.naturalLife).toBe(0.2199999988079071);
  expect(particle.uv.offset[0]).toBeCloseTo((((1.399999976158142 * particle.age) % 1) + 1) % 1, 12);
  expect(data.profiles[1].rawFlags).toEqual({
    blendMode: 4,
    isLocalOrientation: null,
    particleIsLocalOrientation: null,
  });
});
