import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import type { Vec2 } from '../src/simulation/math';

function fixture() {
  const w = new World(false, { ...PRACTICE_FIXTURE, lineOfSight: () => false });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = 0;
  return w;
}
function cast(w: World, point: Vec2) {
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point });
  w.step();
}

test('saved Hawkshot flight requires a finite launch tick for its source animation phase', () => {
  const w = fixture();
  w.step(500);
  cast(w, { x: 4200, y: 0 });
  expect(w.projectiles[0].launchTick).toBe(501);
  for (const launchTick of [undefined, null, -1, 1.5, 'Infinity']) {
    const saved = JSON.parse(w.snapshot());
    saved.projectiles[0].launchTick = launchTick;
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
  }
});

test('Hawkshot travels at 1400 through terrain and units, then reveals its endpoint for five seconds', () => {
  const w = fixture();
  const target = w.spawn('dummy', 'red', { x: 700, y: 0 });
  const hp = target.hp;
  cast(w, { x: 4200, y: 0 });
  expect(w.projectiles[0].type).toBe('hawkshot');
  expect(w.projectiles[0].speed).toBe(1400);
  expect(w.projectiles[0].x).toBeCloseTo(1400 / 60);
  expect(w.pointVisible({ x: 4200, y: 0 })).toBe(false);
  expect(w.visionAreas).toHaveLength(0);
  w.step(59);
  expect(w.projectiles[0].x).toBeCloseTo(1400);
  expect(w.projectiles[0].remaining).toBeCloseTo(2800);
  expect(target.hp).toBe(hp);
  expect(target.slowUntil).toBe(0);
  w.step(119);
  expect(w.projectiles).toHaveLength(1);
  expect(w.visionAreas).toHaveLength(0);
  w.step();
  expect(w.projectiles).toHaveLength(0);
  expect(w.visionAreas[0]).toMatchObject({ kind: 'scout', endTick: 480, team: 'blue' });
  expect(w.visionAreas[0].x).toBeCloseTo(4200);
  w.step(299);
  expect(w.pointVisible({ x: 4200, y: 0 })).toBe(true);
  w.step();
  expect(w.pointVisible({ x: 4200, y: 0 })).toBe(false);
  expect(w.visionAreas).toHaveLength(0);
});

test('Hawkshot clamps a distant target to 25000 without overshooting and supports a zero-length cast', () => {
  const w = fixture();
  cast(w, { x: 30000, y: 0 });
  w.step(1070);
  expect(w.projectiles).toHaveLength(1);
  expect(w.projectiles[0].x).toBeCloseTo(24990);
  w.step();
  expect(w.projectiles).toHaveLength(0);
  expect(w.visionAreas[0].x).toBeCloseTo(25000);
  expect(w.visionAreas[0].y).toBe(0);
  cast(w, { x: 0, y: 0 });
  expect(w.projectiles).toHaveLength(0);
  expect(w.visionAreas.at(-1)).toMatchObject({ x: 0, y: 0, endTick: w.tick + 300 });
});

test('moving and endpoint sight belong to the caster team and count independently of attack reveals', () => {
  for (const team of ['blue', 'red'] as const) {
    const w = fixture();
    w.hero.team = team;
    cast(w, { x: 4200, y: 0 });
    w.step(89);
    const p = w.projectiles[0];
    const edge = { x: p.x, y: 650 };
    expect(w.pointVisible(edge, team)).toBe(true);
    expect(w.pointVisible({ ...edge, y: 650.01 }, team)).toBe(false);
    expect(w.pointVisible(edge, team === 'blue' ? 'red' : 'blue')).toBe(false);
    expect(w.visionSources(team, false).some((s) => s.unobstructed && s.x === p.x)).toBe(true);
    w.step(90);
    expect(
      w.visionSources(team, false).some((s) => s.unobstructed && Math.abs(s.x - 4200) < 1e-7)
    ).toBe(true);
    expect(w.pointVisible({ x: 4200, y: 0 }, team === 'blue' ? 'red' : 'blue')).toBe(false);
  }
});

test('multiple scouts and destination areas survive caster death and saved continuation independently', () => {
  const w = fixture();
  cast(w, { x: 14000, y: 0 });
  w.step(299);
  cast(w, { x: 0, y: 7000 });
  expect(w.projectiles).toHaveLength(2);
  w.damage(w.hero, w.hero, 1e6, 'true');
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step(299); // Both reach their respective endpoints at tick 600.
    expect(world.hero.hp).toBe(0);
    expect(world.projectiles).toHaveLength(0);
    expect(world.visionAreas.filter((a) => a.kind === 'scout')).toHaveLength(2);
    expect(world.pointVisible({ x: 14000, y: 0 })).toBe(true);
    expect(world.pointVisible({ x: 0, y: 7000 })).toBe(true);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
  const endpointSave = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(300);
  endpointSave.step(300);
  expect(endpointSave.snapshot()).toBe(w.snapshot());
  expect(w.visionAreas.filter((a) => a.kind === 'scout')).toHaveLength(0);
});
