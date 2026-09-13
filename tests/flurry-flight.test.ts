import { expect, test } from 'vitest';
import { flurryFlight } from '../src/render/flurry-flight';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import type { Projectile } from '../src/simulation/types';

const referenceArrow: Projectile = {
  id: 1,
  source: 1,
  team: 'blue',
  type: 'attack',
  x: 250,
  y: 0,
  previous: { x: 240, y: 0 },
  origin: { x: 0, y: 0 },
  direction: { x: 1, y: 0 },
  target: 2,
  damage: 1,
  speed: 2500,
  radius: 8,
  remaining: 1000,
  volleyId: null,
  empowered: true,
  flurryShot: 4,
};

test('flurry facing meets the straight path smoothly at launch and contact', () => {
  const target = { x: 550, y: 0, radius: 30 };
  for (const x of [0.000001, 550 - 30 - 8 - 0.000001]) {
    const arrow = { ...referenceArrow, x, previous: { x, y: 0 } };
    const path = flurryFlight(arrow, target, 1);
    expect(Math.abs(path.y)).toBeLessThan(0.000001);
    expect(Math.abs(path.facing - Math.PI / 2)).toBeLessThan(0.000001);
  }
});

test('moving target presentation uses the same interpolation phase as the projectile', () => {
  const arrow = { ...referenceArrow, previous: { x: referenceArrow.x, y: referenceArrow.y } };
  const moving = { x: 600, y: 100, previous: { x: 550, y: 0 }, radius: 30 };
  expect(flurryFlight(arrow, moving, 0)).toEqual(
    flurryFlight(arrow, { ...moving.previous, radius: moving.radius }, 1)
  );
  expect(flurryFlight(arrow, moving, 0.5)).toEqual(
    flurryFlight(arrow, { x: 575, y: 50, radius: moving.radius }, 1)
  );
});

test('flurry presentation separates arrows, converges at contact and leaves gameplay untouched', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
  w.nextWaveTick = Infinity;
  const target = w.spawn('dummy', 'red', { x: w.hero.x + 550, y: w.hero.y });
  w.player.qUntil = 360;
  w.setOrder(w.hero, { type: 'attack', target: target.id });
  for (let i = 0; i < 60 && !w.projectiles.length; i++) w.step();
  w.setOrder(w.hero, { type: 'idle' });
  w.step(8);
  const before = w.snapshot();
  const restored = World.fromSnapshot(before, w.battlefield);
  const paths = w.projectiles.map((p) => flurryFlight(p, target, 1));
  expect(paths[0].y).toBe(w.hero.y);
  expect(paths[1].y).toBeLessThan(w.hero.y);
  expect(paths[2].y).toBeGreaterThan(w.hero.y);
  expect(restored.projectiles.map((p) => flurryFlight(p, restored.unit(target.id), 1))).toEqual(
    paths
  );
  expect(w.snapshot()).toBe(before);

  const p = structuredClone(w.projectiles[1]);
  p.x = p.previous.x = target.x - target.radius - p.radius;
  p.y = p.previous.y = target.y;
  expect(flurryFlight(p, target, 1)).toEqual({ x: p.x, y: p.y, facing: Math.PI / 2 });
  p.x = p.previous.x = p.origin!.x;
  expect(flurryFlight(p, target, 1).y).toBe(p.origin!.y);
  delete p.origin;
  expect(flurryFlight(p, target, 1)).toEqual({ x: p.x, y: p.y, facing: Math.PI / 2 });
});

test('flurry presentation rotates with travel direction and stays bounded for distant targets', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
  w.nextWaveTick = Infinity;
  const target = w.spawn('dummy', 'red', { x: w.hero.x, y: w.hero.y + 550 });
  w.player.qUntil = 360;
  w.setOrder(w.hero, { type: 'attack', target: target.id });
  for (let i = 0; i < 60 && !w.projectiles.length; i++) w.step();
  const p = w.pendingAttackProjectiles[0];
  p.y = p.previous.y += 250;
  const visual = flurryFlight(p, target, 1);
  expect(visual.x).toBeGreaterThan(p.x);
  expect(Number.isFinite(visual.facing)).toBe(true);
  target.y += 100000;
  expect(Math.abs(flurryFlight(p, target, 1).x - p.x)).toBeLessThanOrEqual(60);
  p.empowered = false;
  expect(flurryFlight(p, target, 1)).toEqual({ x: p.x, y: p.y, facing: 0 });
});
