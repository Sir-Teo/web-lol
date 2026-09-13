import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function setup(team: 'blue' | 'red' = 'blue') {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  Object.assign(w.hero, { x: -2000, y: 0, previous: { x: -2000, y: 0 } });
  const source = w.spawn('champion', team, { x: 0, y: 0 });
  const enemies = [200, 500, 800].map((x) =>
    w.spawn('champion', team === 'blue' ? 'red' : 'blue', { x, y: 0 })
  );
  return { w, source, enemies };
}

for (const team of ['blue', 'red'] as const)
  test(`${team} binding continues after one hit through save and caster death`, () => {
    const { w, source, enemies } = setup(team);
    w.releaseLightBinding(source, { x: 1300, y: 0 }, 100);
    w.step(5);
    expect(w.projectiles[0].bindingHits).toEqual([enemies[0].id]);
    w.damage(enemies[0], source, 10000, 'true');
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, restored]) {
      world.step(30);
      expect(world.projectiles.some((p) => p.type === 'binding')).toBe(false);
      for (const enemy of enemies.slice(0, 2)) {
        const u = world.unit(enemy.id)!;
        expect(u.hp).toBeLessThan(u.maxHp);
        expect(u.rootUntil).toBeGreaterThan(world.tick);
        expect(u.slowUntil).toBe(0);
        expect(u.stunUntil).toBe(0);
      }
      expect(world.unit(enemies[2].id)!.hp).toBe(enemies[2].maxHp);
    }
    expect(restored.snapshot()).toBe(w.snapshot());
  });

test('a single fast sweep resolves two closest contacts rather than array order', () => {
  const { w, source, enemies } = setup();
  w.releaseLightBinding(source, { x: 1300, y: 0 }, 100);
  w.projectiles[0].speed = 60000;
  w.units.reverse();
  w.step();
  expect(enemies.map((u) => u.rootUntil > w.tick)).toEqual([true, true, false]);
  expect(w.projectiles).toHaveLength(0);
});

test('allies and structures do not consume hits, while lane minions do', () => {
  const { w, source, enemies } = setup();
  const ally = w.spawn('champion', 'blue', { x: 50, y: 0 });
  const tower = w.spawn('turret', 'red', { x: 70, y: 0 });
  tower.ai = false;
  tower.stunUntil = 10000;
  const minion = w.spawn('melee', 'red', { x: 90, y: 0 });
  minion.ai = false;
  w.releaseLightBinding(source, { x: 1300, y: 0 }, 100);
  w.step(40);
  expect(ally.hp).toBe(ally.maxHp);
  expect(tower.hp).toBe(tower.maxHp);
  expect(minion.hp).toBeLessThan(minion.maxHp);
  expect(enemies[0].hp).toBeLessThan(enemies[0].maxHp);
  expect(enemies[1].hp).toBe(enemies[1].maxHp);
});

test('a target already hit is not damaged repeatedly while the missile overlaps it', () => {
  const { w, source, enemies } = setup();
  w.releaseLightBinding(source, { x: 1300, y: 0 }, 100);
  w.step(12);
  const hits = w.events.filter((e) => e.type === 'damage' && e.unit === enemies[0].id);
  expect(hits).toHaveLength(1);
  expect(hits[0].value).toBe(Math.round((100 * 100) / 133));
  const saved = JSON.parse(w.snapshot());
  for (const bad of [
    undefined,
    [enemies[0].id, enemies[1].id],
    [source.id],
    [w.nextId],
    [saved.projectiles[0].id],
  ]) {
    saved.projectiles[0].bindingHits = bad;
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
  }
  saved.projectiles[0].bindingHits = [enemies[0].id];
  saved.projectiles[0].team = 'red';
  expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
});
