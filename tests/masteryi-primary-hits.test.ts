import { expect, test, vi } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { PRIMARY_HIT_HISTORY_TICKS } from '../src/content/masteryi-primary-hit-timing';
import { primaryHitParticles } from '../src/render/masteryi-primary-hit-particles';
import { spatialDragTravel } from '../src/render/particle-spatial-drag';
import data from '../src/content/masteryi-primary-hit-particles.json';
function fixture(critical = false, champion?: 'ahri' | 'leona') {
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
    target = champion
      ? w.spawn('champion', 'red', { x: 150, y: 0 }, champion)
      : w.spawn('dummy', 'red', { x: 150, y: 0 });
  yi.ai = target.ai = false;
  target.hp = target.maxHp = 1e6;
  const chance = critical ? vi.spyOn(w, 'criticalChance').mockReturnValue(1) : undefined;
  w.setOrder(yi, { type: 'attack', target: target.id });
  w.step();
  chance?.mockRestore();
  const state = w.championState(yi.id)!,
    record = state.masterYiAAAudio[0];
  return { w, yi, target, state, record };
}
function contact(f: ReturnType<typeof fixture>) {
  f.w.step(f.record.releaseTick - f.w.tick);
  f.w.setOrder(f.yi, { type: 'idle' });
  return f.record.impact!;
}
function resume(w: World, ticks: number) {
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, w.battlefield);
  expect(copy.snapshot()).toBe(saved);
  w.step(ticks);
  copy.step(ticks);
  expect(copy.snapshot()).toBe(w.snapshot());
}
test.each(['attack1', 'attack2', 'crit'] as const)(
  '%s includes every source emitter at first update and expires finitely',
  (kind) => {
    expect(primaryHitParticles(91, 0, kind, 30)).toEqual([]);
    const particles = primaryHitParticles(91, 1 / 60, kind, 30);
    const expected = data.profiles.flatMap((p, i) => (p.role === kind ? [i] : []));
    expect([...new Set(particles.map((p) => p.profileIndex))]).toEqual(expected);
    expect(particles.every((p) => p.age === 0 && p.offset.every(Number.isFinite))).toBe(true);
    expect(primaryHitParticles(91, PRIMARY_HIT_HISTORY_TICKS / 60, kind, 30)).toEqual([]);
    expect(primaryHitParticles(91, 1 / 60, kind, 30)).toEqual(particles);
  }
);
test('unblended fluid, random atlas omission and last blood atlas cell stay literal', () => {
  const particles = primaryHitParticles(91, 1 / 60, 'attack1', 30),
    fluid = particles.find((p) => p.profileIndex === 0)!,
    blood = particles.find((p) => p.profileIndex === 2)!;
  expect(data.profiles[0].blend).toBe(3);
  expect(fluid.uv.cell).toEqual([0, 0]);
  expect(fluid.uv.cellSize).toEqual([0.5, 0.5]);
  expect(blood.uv.cell).toEqual([0.75, 0.75]);
  expect(data.profiles[2].uv.frameRate).toBe(1);
});
test('bound-size flex changes particle spawn offset without changing size or indexed life', () => {
  const a = primaryHitParticles(91, 1 / 60, 'attack1', 30),
    b = primaryHitParticles(91, 1 / 60, 'attack1', 60);
  for (let i = 0; i < a.length; i++) {
    expect(a[i].size).toEqual(b[i].size);
    expect(a[i].life).toBe(b[i].life);
    if (data.profiles[a[i].profileIndex].boundOffset !== null)
      a[i].offset.forEach((x, axis) => expect(b[i].offset[axis]).toBeCloseTo(x * 2, 10));
  }
});
test.each([NaN, Infinity, -1])('invalid sample time %s produces no particles', (time) =>
  expect(primaryHitParticles(1, time, 'attack1', 30)).toEqual([])
);
test('spatial drag affects only particles within its authored radius', () => {
  const field = { position: [0, 0, 0], radius: 1, strength: 30 };
  expect(spatialDragTravel([60, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], 1 / 60, field)).toEqual({
    position: [0.5, 0, 0],
    travel: [30, 0, 0],
  });
  expect(spatialDragTravel([60, 0, 0], [0, 0, 0], [0, 0, 0], [2, 0, 0], 1 / 60, field)).toEqual({
    position: [1, 0, 0],
    travel: [60, 0, 0],
  });
});
test('excess drag stops motion without reversing it and fractional seeks interpolate endpoints', () => {
  const field = { position: [0, 0, 0], radius: 100, strength: 600 };
  expect(
    spatialDragTravel([60, -60, 30], [0, 0, 0], [0, 0, 0], [0, 0, 0], 1 / 60, field).travel
  ).toEqual([0, -0, 0]);
  expect(
    spatialDragTravel([60, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], 1 / 120, null).position
  ).toEqual([0.5, 0, 0]);
  expect(
    spatialDragTravel([0, 0, 0], [0, -600, 0], [0, 0, 0], [0, 0, 0], 1 / 60, null).travel
  ).toEqual([0, -10, 0]);
});
test('fractional motion retains exact Float32 endpoints while entering and leaving a drag field', () => {
  const args = [
      [60, -2, 0.5],
      [0.1, -6, 1.5],
      [1, 2, 3],
      [0, 0, 0],
    ] as const,
    field = { position: [1, 0, 0], radius: 0.8, strength: 30 };
  expect(spatialDragTravel(...args, 5.25 / 60, field)).toEqual({
    position: [1.9647447168827057, -0.07394232973456383, 0.017885560169816017],
    travel: [6.78537654876709, -0.48184195160865784, 0.11277882009744644],
  });
  expect(spatialDragTravel(...args, 5 / 60, field)).toEqual({
    position: [1.9364722967147827, -0.07193465530872345, 0.017415648326277733],
    travel: [6.898716449737549, -0.39845719933509827, 0.09371455013751984],
  });
});
test('motion sampling leaves all caller-owned vectors and the spatial field untouched', () => {
  const vectors = [
      [60, -2, 0.5],
      [0.1, -6, 1.5],
      [1, 2, 3],
      [0, 0, 0],
    ] as const,
    field = Object.freeze({ position: Object.freeze([1, 0, 0]), radius: 0.8, strength: 30 }),
    before = structuredClone(vectors);
  vectors.forEach(Object.freeze);
  for (const age of [1, 5.25 / 60, 0, 0.5]) spatialDragTravel(...vectors, age, field);
  expect(vectors).toEqual(before);
});
test.each([NaN, Infinity, -1])('invalid force age %s rejects', (age) =>
  expect(() => spatialDragTravel([1, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], age, null)).toThrow()
);
test.each([undefined, 'ahri', 'leona'] as const)(
  'target %s captures poses and exact saved future through movement',
  (champion) => {
    const f = fixture(false, champion),
      hit = contact(f);
    expect(hit.frames).toHaveLength(1);
    expect(hit.frames[0].tick).toBe(hit.tick);
    f.w.setOrder(f.target, { type: 'move', point: { x: 600, y: 50 } });
    f.w.step(4);
    expect(hit.frames).toHaveLength(5);
    if (champion) expect(hit.frames.at(-1)!.x).toBeGreaterThan(hit.point.x);
    else expect(hit.frames.at(-1)!.x).toBe(hit.point.x);
    if (champion) expect(hit.frames.at(-1)!.animationTimeline?.tick).toBe(f.w.tick);
    resume(f.w, 35);
  }
);
test('cancelled windup never gains target particles or a target pose history', () => {
  const f = fixture();
  f.w.setOrder(f.yi, { type: 'idle' });
  f.w.step(30);
  expect(f.record.impact).toBeNull();
  resume(f.w, 10);
});
test('critical contact retains its separate kind and complete finite target history', () => {
  const f = fixture(true, 'ahri'),
    hit = contact(f);
  expect(f.record.kind).toBe('crit');
  f.w.step(20);
  expect(hit.frames).toHaveLength(21);
  resume(f.w, 20);
});
test('target removal freezes the last admitted endpoint and survives save/load', () => {
  const f = fixture(),
    hit = contact(f);
  f.w.step(2);
  f.w.units = f.w.units.filter((u) => u.id !== f.target.id);
  f.w.step();
  expect(hit.detachedTick).toBe(f.w.tick);
  const pose = structuredClone(hit.frames.at(-1)!);
  f.w.step(3);
  expect(hit.frames.at(-1)).toEqual({ ...pose, tick: f.w.tick });
  resume(f.w, 15);
});
test('source death preserves accepted target history through finite expiry', () => {
  const f = fixture(),
    hit = contact(f);
  f.w.damage(f.target, f.yi, 1e9, 'true');
  f.w.step(5);
  expect(hit.frames).toHaveLength(6);
  resume(f.w, 10);
  f.w.step(hit.tick + PRIMARY_HIT_HISTORY_TICKS - f.w.tick);
  expect(f.state.masterYiAAAudio).not.toContain(f.record);
});
test.each([
  'missing',
  'gap',
  'future',
  'rig-pose',
  'radius',
  'transform',
  'detach',
  'audience',
  'latest-pose',
])('decoder rejects forged %s primary hit pose', (change) => {
  const f = fixture(false, 'ahri');
  contact(f);
  f.w.step(2);
  const saved = JSON.parse(f.w.snapshot()),
    state = saved.otherChampions.find((s: any) => s.id === f.yi.id),
    hit = state.masterYiAAAudio[0].impact;
  if (change === 'missing') hit.frames.pop();
  if (change === 'gap') hit.frames[1].tick++;
  if (change === 'future') hit.frames.at(-1).tick++;
  if (change === 'rig-pose') hit.frames[0].animationTimeline.primary.clip = 'invented';
  if (change === 'radius') hit.radius++;
  if (change === 'transform') hit.targetTransform = Array(16).fill(0);
  if (change === 'detach') hit.detachedTick = hit.tick - 1;
  if (change === 'audience') hit.frames[1].audience = ['blue'];
  if (change === 'latest-pose') hit.frames.at(-1).x++;
  expect(() => World.fromSnapshot(JSON.stringify(saved), f.w.battlefield)).toThrow();
});

test('sampling and arbitrary seeking leave simulation RNG, IDs and saved state untouched', () => {
  const f = fixture(),
    hit = contact(f),
    saved = f.w.snapshot(),
    rng = f.w.random.state,
    id = f.w.nextId;
  for (const time of [0.8, 0.1, 1 / 60, 0.4, 0.8])
    primaryHitParticles(f.yi.id, time, f.record.kind, hit.radius);
  expect(f.w.random.state).toBe(rng);
  expect(f.w.nextId).toBe(id);
  expect(f.w.snapshot()).toBe(saved);
});
test('target death freezes the finalized corpse pose, with exact later save futures', () => {
  const f = fixture(false, 'ahri'),
    hit = contact(f),
    deathTick = f.w.tick;
  f.w.damage(f.yi, f.target, 1e9, 'true');
  f.w.step();
  expect(f.target.hp).toBe(0);
  expect(hit.detachedTick).toBe(deathTick);
  const last = structuredClone(hit.frames.at(-1)!);
  f.w.step(3);
  expect(hit.frames.at(-1)).toEqual({ ...last, tick: f.w.tick });
  resume(f.w, 20);
});

test.each([
  { seed: 312, ordinal: 5, profile: 0, age: 0, cell: [0.5, 0] },
  { seed: 47, ordinal: 3, profile: 3, age: 0, cell: [0.5, 0.5] },
  { seed: 144, ordinal: 1, profile: 2, age: 0.998, cell: [0, 1] },
])('quad atlas boundary at seed $seed follows half packing before shader flooring', (f) => {
  const particle = primaryHitParticles(f.seed, 1 / 60 + f.age, 'attack1', 30).find(
    (p) => p.profileIndex === f.profile && p.ordinal === f.ordinal
  )!;
  expect(particle).toBeDefined();
  expect(particle.age).toBeLessThan(particle.life);
  expect(particle.uv.cell).toEqual(f.cell);
});

test('the retained quad profiles satisfy the exact unit-corner and float32 atlas specialization', () => {
  for (const profile of data.profiles.filter((p) => p.kind !== 'ray')) {
    for (const [field, value] of [
      ['scale', [1, 1]],
      ['offset', [0, 0]],
      ['birthScroll', [0, 0]],
      ['scroll', [0, 0]],
    ] as const) {
      expect(profile.uv[field].values).toEqual([value]);
      expect(profile.uv[field].times).toEqual([0]);
      expect(profile.uv[field].probabilities).toEqual([]);
    }
    expect(Number.isInteger(profile.uv.frames) && profile.uv.frames > 0).toBe(true);
    expect(profile.uv.frames & (profile.uv.frames - 1)).toBe(0);
    if (profile.uv.randomStart) expect(profile.uv.frameRate).toBe(0);
  }
});

test('quad lookup UVs use binary16 while the untraced ray preserves its coordinate precision', () => {
  const quads = primaryHitParticles(91, 0.08, 'attack1', 30),
    ray = primaryHitParticles(91, 0.08, 'crit', 30).find((p) => p.profileIndex === 9)!;
  // Independent binary16 reference values for the four retained source profiles.
  expect(quads.filter((p) => p.ordinal === 1).map((p) => p.lookup)).toEqual([
    [0.1453857421875, 0.62353515625],
    [0.2110595703125, 1],
    [0.243896484375, 0.994140625],
    [0.071044921875, 0.7578125],
  ]);
  expect(ray.lookup).toEqual([ray.phase, 1]);
  expect(ray.lookup[0]).not.toBe(0.422119140625);
});
