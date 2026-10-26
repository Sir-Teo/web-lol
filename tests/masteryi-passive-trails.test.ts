import data from '../src/content/masteryi-passive-trail-particles.json';
import primaryData from '../src/content/masteryi-primary-trail-particles.json';
import { passiveTrailParticles } from '../src/render/masteryi-passive-trail-particles';
import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import {
  passiveTrailMarkerTick,
  passiveTrailExpiry,
  advancePassiveTrails,
} from '../src/simulation/masteryi-passive-trails';
import { PASSIVE_TRAIL_MARKERS } from '../src/content/masteryi-passive-trail-timing';
import { actorRootKnown } from '../src/simulation/actor-root-history';
function fixture(ability?: 'w' | 'q') {
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
  const owner = w.championState(yi.id)!;
  if (ability) expect(w.learnSpell(ability, yi.id)).toBeNull();
  for (let i = 0; i < 4; i++) {
    w.setOrder(yi, { type: 'attack', target: target.id });
    w.step(Math.max(1, yi.nextAttackTick - w.tick + 1));
    w.step(yi.releaseTick! - w.tick);
    w.setOrder(yi, { type: 'idle' });
  }
  const record = owner.passiveTrailVisuals[0];
  expect(record).toBeDefined();
  expect(record.startTick).toBe(owner.doubleStrike!.strike!.startTick);
  return { w, yi, target, owner, record };
}
function resume(w: World, ticks = 90) {
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, w.battlefield);
  expect(copy.snapshot()).toBe(saved);
  w.step(ticks);
  copy.step(ticks);
  expect(copy.snapshot()).toBe(w.snapshot());
}
test.each([0, 1] as const)('event %s crosses the exact rendered sample clock', (event) => {
  for (const duration of [3, 7, 17, 55, 58, 89, 1000, 1000000]) {
    const startTick = 29,
      marker = PASSIVE_TRAIL_MARKERS[event],
      tick = passiveTrailMarkerTick({ startTick, endTick: startTick + duration }, event),
      rate = marker.renderedDuration / (duration / 60),
      offset = tick - startTick;
    expect((offset / 60) * rate).toBeGreaterThanOrEqual(marker.renderedSeconds);
    expect(((offset - 1) / 60) * rate).toBeLessThan(marker.renderedSeconds);
  }
});
test('four real primary contacts capture one child history with two distinct decisions', () => {
  const { w, owner, record } = fixture();
  expect(owner.passiveTrailVisuals).toHaveLength(1);
  expect(record.events).toEqual([null, null]);
  w.step(passiveTrailMarkerTick(record, 0) - w.tick);
  expect(record.events).toEqual([true, null]);
  resume(w, 2);
  w.step(Math.max(0, passiveTrailMarkerTick(record, 1) - w.tick));
  expect(record.events).toEqual([true, true]);
  resume(w);
});
test('movement suppresses its marker and a resumed pose admits only the later event', () => {
  const { w, yi, record } = fixture();
  w.setOrder(yi, { type: 'move', point: { x: 1000, y: 0 } });
  w.step(passiveTrailMarkerTick(record, 0) - w.tick);
  expect(record.events).toEqual([false, null]);
  w.setOrder(yi, { type: 'idle' });
  w.step(passiveTrailMarkerTick(record, 1) - w.tick);
  expect(record.events).toEqual([false, true]);
  resume(w);
});
test.each(['w', 'q'] as const)(
  '%s interruption suppresses future markers while the accepted child survives',
  (ability) => {
    const { w, yi, target, owner, record } = fixture(ability);
    w.enqueue({
      type: 'cast',
      unit: yi.id,
      ability,
      point: target,
      targetId: ability === 'q' ? target.id : undefined,
    });
    w.step();
    expect(owner.doubleStrike!.strike).not.toBeNull();
    expect(record.stopTick).toBe(owner.doubleStrike!.strike!.poseStopTick);
    w.step(passiveTrailMarkerTick(record, 1) - w.tick);
    expect(record.events).toEqual([false, false]);
    if (ability === 'q') expect(actorRootKnown(record.frames, w.tick, 'blue')).toBe(false);
    resume(w);
  }
);
test('a mid-update death of another Yi does not suppress this current-pose marker', () => {
  const { w, record } = fixture(),
    marker = passiveTrailMarkerTick(record, 0);
  w.step(marker - w.tick - 2);
  const other = w.spawn('champion', 'blue', { x: 1000, y: 0 }, 'masteryi'),
    enemy = w.spawn('melee', 'red', { x: 1000, y: 0 });
  other.ai = enemy.ai = false;
  other.hp = 1;
  enemy.windupTicks = 1;
  w.setOrder(enemy, { type: 'attack', target: other.id });
  w.step(2);
  expect(other.deadAt).toBe(marker);
  expect(record.events).toEqual([true, null]);
  resume(w);
});
test('death before the markers suppresses both and retains valid finite corpse roots', () => {
  const { w, yi, target, record } = fixture();
  w.step();
  w.damage(target, yi, 1e6, 'true');
  expect(record.stopTick).toBe(yi.deadAt);
  w.step(passiveTrailMarkerTick(record, 1) - w.tick);
  expect(record.events).toEqual([false, false]);
  resume(w);
});
test('victory cannot resolve future markers or mutate saved state through extra steps', () => {
  const { w, yi, owner, record } = fixture();
  w.step(passiveTrailMarkerTick(record, 0) - w.tick);
  const nexus = w.spawn('nexus', 'red', { x: 500, y: 0 });
  w.damage(yi, nexus, 1e9, 'true');
  expect(record.events).toEqual([true, null]);
  expect(owner.doubleStrike!.strike).toBeNull();
  const saved = w.snapshot();
  w.step(1000);
  expect(w.snapshot()).toBe(saved);
  expect(World.fromSnapshot(saved, w.battlefield).snapshot()).toBe(saved);
});
test('histories roll, expire and never consume gameplay random values or IDs', () => {
  const { w, owner, record } = fixture();
  const before = w.snapshot(),
    random = w.random.state,
    id = w.nextId;
  advancePassiveTrails(w);
  expect(w.random.state).toBe(random);
  expect(w.nextId).toBe(id);
  expect(w.snapshot()).toBe(before);
  w.step(passiveTrailExpiry(record) - w.tick - 1);
  expect(record.frames[0].tick).toBe(Math.max(record.startTick, w.tick - 15));
  expect(record.frames.at(-1)!.endTick).toBe(w.tick);
  w.step();
  expect(owner.passiveTrailVisuals).toHaveLength(0);
  resume(w);
});
test.each([
  'missing',
  'future',
  'pending',
  'coverage',
  'endpoint',
  'audience',
  'link',
  'duplicate',
])('malformed %s histories reject', (kind) => {
  const { w, yi, record } = fixture();
  if (kind === 'pending') w.step(passiveTrailMarkerTick(record, 0) - w.tick);
  const saved = JSON.parse(w.snapshot()),
    owner = saved.otherChampions.find((r: any) => r.id === yi.id),
    r = owner.passiveTrailVisuals[0];
  if (kind === 'missing') owner.passiveTrailVisuals = [];
  if (kind === 'future') r.events[0] = true;
  if (kind === 'pending') r.events[0] = null;
  if (kind === 'coverage') r.frames[0].tick++;
  if (kind === 'endpoint') r.frames.at(-1).x++;
  if (kind === 'audience') r.frames.at(-1).audience = [];
  if (kind === 'link') r.endTick++;
  if (kind === 'duplicate') owner.passiveTrailVisuals.push(structuredClone(r));
  expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
});

test('both source systems retain all 25 mips and reuse the exact primary geometry', () => {
  expect(data.profiles.map((p) => p.system)).toEqual(['MasterYi_P_Trail_1', 'MasterYi_P_Trail_2']);
  expect(data.profiles.map((p) => p.rawFlags.blendMode)).toEqual([4, 4]);
  expect(data.textures.reduce((n, t) => n + t.rectangles.length, 0)).toBe(25);
  expect(data.mesh.url).toBe(primaryData.mesh.url);
  expect(data.mesh.sha256).toBe(primaryData.mesh.sha256);
  expect(
    data.textures.filter((t) => primaryData.textures.some((p) => p.url === t.url))
  ).toHaveLength(2);
});
test.each([0, 1])(
  'event %s has one finite first-update particle with literal source offset and scroll',
  (event) => {
    expect(passiveTrailParticles(17, 0, event)).toEqual([]);
    const birth = passiveTrailParticles(17, 1 / 60, event);
    expect(birth).toHaveLength(1);
    expect(birth[0].age).toBe(0);
    expect(birth[0].profileIndex).toBe(event);
    expect(birth[0].offset).toEqual([0, -40, -20]);
    expect(birth[0].rotation).toEqual([0, 0, 0]);
    expect(birth[0].size).toEqual([1, 1, 1]);
    const particle = passiveTrailParticles(17, 0.1, event)[0],
      rate = event === 0 ? 1.399999976158142 : -3.0999999046325684;
    expect(particle.uv.offset[0]).toBeCloseTo((((rate * particle.age) % 1) + 1) % 1, 12);
    expect(passiveTrailParticles(17, 1 / 60 + birth[0].naturalLife, event)).toEqual([]);
    expect(passiveTrailParticles(17, 1e9, event)).toEqual([]);
  }
);
test.each([-1, NaN, Infinity, -Infinity])(
  'invalid particle time %s produces no passive particles',
  (time) => {
    expect(passiveTrailParticles(1, time)).toEqual([]);
  }
);
