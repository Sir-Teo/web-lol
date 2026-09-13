import { describe, expect, it } from 'vitest';
import { World } from '../src/simulation/world';
import { distance, sweepCircle } from '../src/simulation/math';
import { findPath, lineWalkable, reachable } from '../src/simulation/navigation';
import { OBSTACLES } from '../src/content/map';

function duel() {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const hero = w.hero;
  hero.x = 0;
  hero.y = 0;
  const target = w.spawn('dummy', 'red', { x: 400, y: 0 });
  return { w, hero, target };
}
describe('attack state ownership', () => {
  it('cancels an attack before release without damage', () => {
    const { w, hero, target } = duel();
    w.enqueue({ type: 'order', unit: hero.id, order: { type: 'attack', target: target.id } });
    w.step(10);
    w.enqueue({ type: 'order', unit: hero.id, order: { type: 'move', point: { x: -300, y: 0 } } });
    w.step(50);
    expect(target.hp).toBe(target.maxHp);
    expect(hero.x).toBeLessThan(0);
  });
  it('moving after release preserves the missile and does not reset attack cooldown', () => {
    const { w, hero, target } = duel();
    w.enqueue({ type: 'order', unit: hero.id, order: { type: 'attack', target: target.id } });
    w.step(22);
    expect(w.projectiles).toHaveLength(1);
    const next = hero.nextAttackTick;
    w.enqueue({ type: 'order', unit: hero.id, order: { type: 'move', point: { x: -300, y: 0 } } });
    w.step();
    w.enqueue({ type: 'order', unit: hero.id, order: { type: 'attack', target: target.id } });
    w.step(40);
    expect(target.maxHp - target.hp).toBeCloseTo(hero.damage);
    expect(hero.nextAttackTick).toBe(next);
  });
});
describe('skillshot collision', () => {
  it('detects a target crossed entirely within a tick', () => {
    expect(sweepCircle({ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 500, y: 0 }, 10)).toBeCloseTo(0.49);
    expect(sweepCircle({ x: 0, y: 50 }, { x: 1000, y: 50 }, { x: 500, y: 0 }, 10)).toBeNull();
  });
  it('multiple volley arrows damage a target only once per cast', () => {
    const { w, hero, target } = duel();
    target.radius = 160;
    w.enqueue({ type: 'cast', unit: hero.id, ability: 'w', point: target });
    w.step(50);
    expect(target.maxHp - target.hp).toBeCloseTo(60);
    expect(hero.mana).toBeLessThan(hero.maxMana - 70);
  });
  it('ultimate passes through minions and strikes a champion', () => {
    const { w, hero, target } = duel();
    target.x = 900;
    const minion = w.spawn('melee', 'red', { x: 300, y: 0 });
    minion.ai = false;
    w.enqueue({ type: 'cast', unit: hero.id, ability: 'r', point: target });
    w.step(40);
    expect(minion.hp).toBe(minion.maxHp);
    expect(target.hp).toBeLessThan(target.maxHp);
    expect(target.stunUntil).toBeGreaterThan(w.tick);
  });
});
describe('navigation', () => {
  it('routes around obstacles with clearance on every segment', () => {
    const o = OBSTACLES[0],
      a = { x: o.x - 700, y: o.y },
      b = { x: o.x + 700, y: o.y };
    const start = reachable(a, 35),
      path = findPath(start, b, 35);
    expect(path.length).toBeGreaterThan(1);
    let previous = start;
    for (const point of path) {
      expect(lineWalkable(previous, point, 35)).toBe(true);
      previous = point;
    }
    expect(distance(previous, reachable(b, 35))).toBeLessThan(0.01);
  });
  it('projects an unreachable click outside inflated blockers', () => {
    const p = reachable(OBSTACLES[0], 35);
    expect(OBSTACLES.every((o) => distance(p, o) >= o.radius + 35)).toBe(true);
  });
});
describe('economy and determinism', () => {
  it('awards last-hit gold once even if two lethal hits resolve', () => {
    const { w, hero } = duel();
    const minion = w.spawn('melee', 'red', { x: 300, y: 0 });
    w.damage(hero, minion, 10000, 'true');
    w.damage(hero, minion, 10000, 'true');
    expect(w.player.cs).toBe(1);
    expect(w.player.gold).toBe(521);
  });
  it('does not partially purchase an unaffordable item', () => {
    const w = new World(false),
      before = w.snapshot();
    expect(w.buy('pickaxe')).toBe('Not enough gold');
    expect(w.snapshot()).toBe(before);
  });
  it('identical inputs reproduce the same simulation', () => {
    const a = new World(),
      b = new World();
    for (const world of [a, b]) {
      world.enqueue({
        type: 'order',
        unit: world.hero.id,
        order: { type: 'attackMove', point: { x: 500, y: -375 } },
      });
      world.step(3600);
    }
    expect(a.snapshot()).toBe(b.snapshot());
    expect(a.units.every((u) => Number.isFinite(u.x) && Number.isFinite(u.hp) && u.hp >= 0)).toBe(
      true
    );
  });
});
