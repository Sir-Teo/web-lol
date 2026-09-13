import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

test('rank-one Volley fires seven source-speed arrows and scales only with bonus AD', () => {
  for (const level of [1, 18])
    for (const item of [false, true]) {
      const w = new World(false);
      w.nextWaveTick = Infinity;
      if (level === 18) w.gainExperience(1e6);
      if (item) expect(w.buy('blade')).toBeNull();
      w.enqueue({
        type: 'cast',
        unit: w.hero.id,
        ability: 'w',
        point: { x: w.hero.x + 1200, y: w.hero.y },
      });
      w.step();
      expect(w.projectiles).toHaveLength(7);
      for (const arrow of w.projectiles) {
        expect(arrow.speed).toBe(1500);
        expect(arrow.damage).toBeCloseTo(item ? 70 : 60);
        expect(arrow.remaining).toBeCloseTo(1175);
      }
      expect(w.projectiles[3].direction).toEqual({ x: 1, y: 0 });
    }
});

test('saved Volley retains cast damage through leveling and applies it only once per victim', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  w.buy('blade');
  const target = w.spawn('dummy', 'red', { x: w.hero.x + 400, y: w.hero.y });
  target.radius = 160;
  target.armor = 100;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: target });
  w.step();
  w.gainExperience(1e6);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(60);
  restored.step(60);
  expect(target.maxHp - target.hp).toBeCloseTo(35);
  expect(restored.snapshot()).toBe(w.snapshot());
});
