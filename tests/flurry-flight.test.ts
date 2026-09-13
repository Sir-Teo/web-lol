import { expect, test } from 'vitest';
import { flurryFlight } from '../src/render/flurry-flight';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

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
