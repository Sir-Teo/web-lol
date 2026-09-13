import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function arrow() {
  const w = new World(false, { ...PRACTICE_FIXTURE, lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  w.enqueue({
    type: 'cast',
    unit: w.hero.id,
    ability: 'r',
    point: { x: w.hero.x + 10000, y: w.hero.y },
  });
  w.step();
  w.projectiles[0].x = w.hero.x + 3000;
  return w;
}

test('crystal arrow grants only its own team sight within 750 units', () => {
  for (const team of ['blue', 'red'] as const) {
    const w = arrow(),
      p = w.projectiles[0];
    p.team = team;
    const edge = { x: p.x, y: p.y + 750 };
    expect(w.pointVisible(edge, team)).toBe(true);
    expect(w.pointVisible({ ...edge, y: edge.y + 0.01 }, team)).toBe(false);
    expect(w.pointVisible(edge, team === 'blue' ? 'red' : 'blue')).toBe(false);
    p.type = 'volley';
    expect(w.pointVisible(edge, team)).toBe(false);
  }
});

test('missile sight follows its position, survives caster death/save, and ends on removal', () => {
  const w = arrow(),
    p = w.projectiles[0];
  const point = { x: p.x, y: p.y + 600 };
  w.damage(w.hero, w.hero, 1e6, 'true');
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    expect(world.pointVisible(point)).toBe(true);
    world.projectiles[0].x += 1000;
    expect(world.pointVisible(point)).toBe(false);
    const next = { x: world.projectiles[0].x, y: point.y };
    expect(world.pointVisible(next)).toBe(true);
    world.projectiles.length = 0;
    expect(world.pointVisible(next)).toBe(false);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('default projectile sight obeys the battlefield occlusion policy', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, lineOfSight: () => false });
  w.enqueue({
    type: 'cast',
    unit: w.hero.id,
    ability: 'r',
    point: { x: w.hero.x + 10000, y: w.hero.y },
  });
  w.step();
  expect(w.visionSources().some((source) => source.radius === 750)).toBe(true);
  expect(w.pointVisible(w.projectiles[0])).toBe(false);
});
