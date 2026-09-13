import { describe, expect, it } from 'vitest';
import { BRUSH, OBSTACLES } from '../src/content/map';
import { World } from '../src/simulation/world';

function fixture() {
  const world = new World(false);
  world.nextWaveTick = Infinity;
  Object.assign(world.hero, { x: -820, y: 450 });
  const hidden = world.spawn('champion', 'red', BRUSH[0]);
  return { world, hero: world.hero, hidden };
}

describe('authoritative team vision', () => {
  it('hides occupants from outside brush but allows occupants to see out', () => {
    const { world, hero, hidden } = fixture();
    expect(world.visible(hidden)).toBe(false);
    expect(world.visible(hero, 'red')).toBe(true);
    Object.assign(hero, { x: -800, y: -50 });
    expect(world.visible(hidden)).toBe(true);
  });

  it('blocks sight behind terrain, while sharing an unobstructed ally viewpoint', () => {
    const { world, hero, hidden } = fixture();
    const wall = OBSTACLES[6];
    Object.assign(hero, { x: wall.x - 500, y: wall.y });
    Object.assign(hidden, { x: wall.x + 500, y: wall.y });
    expect(world.visible(hidden)).toBe(false);
    const ally = world.spawn('melee', 'blue', { x: hidden.x, y: hidden.y + 200 });
    expect(world.visible(hidden)).toBe(true);
    ally.hp = 0;
    expect(world.visible(hidden)).toBe(false);
  });

  it('does not let an attack order or AI acquire a hidden unit', () => {
    const { world, hero, hidden } = fixture();
    world.enqueue({ type: 'order', unit: hero.id, order: { type: 'attack', target: hidden.id } });
    world.step();
    expect(hero.order.type).toBe('idle');
    expect(hero.releaseTick).toBeNull();
    const turret = world.spawn('turret', 'blue', hero);
    world.step(30);
    expect(turret.releaseTick).toBeNull();
    expect(hidden.hp).toBe(hidden.maxHp);
  });

  it('cancels an unreleased attack when its target enters brush', () => {
    const { world, hero, hidden } = fixture();
    hidden.y = 220;
    world.enqueue({ type: 'order', unit: hero.id, order: { type: 'attack', target: hidden.id } });
    world.step(5);
    expect(hero.releaseTick).not.toBeNull();
    Object.assign(hidden, BRUSH[0]);
    world.step(30);
    expect(world.projectiles).toHaveLength(0);
    expect(hidden.hp).toBe(hidden.maxHp);
  });

  it('reveals a fixed 300-unit area for two seconds only after a hidden attack releases', () => {
    const { world, hero, hidden } = fixture();
    world.enqueue({ type: 'order', unit: hidden.id, order: { type: 'attack', target: hero.id } });
    world.step(20);
    expect(world.visible(hidden)).toBe(false);
    world.step();
    expect(world.visible(hidden)).toBe(true);
    expect(world.visionAreas).toHaveLength(1);
    const area = world.visionAreas[0];
    expect(area.radius).toBe(300);
    expect(area.endTick - world.tick).toBe(120);
    world.setOrder(hidden, { type: 'idle' });
    world.step(119);
    expect(world.visible(hidden)).toBe(true);
    world.step();
    expect(world.visible(hidden)).toBe(false);
    expect(world.visionAreas).toHaveLength(0);
  });

  it('Hawkshot sees across terrain and brush, and expires on the exact tick', () => {
    const { world, hidden } = fixture();
    world.reveal = { point: { x: hidden.x, y: hidden.y }, endTick: 2 };
    expect(world.visible(hidden)).toBe(true);
    world.step(2);
    expect(world.visible(hidden)).toBe(false);
  });

  it('refreshes attack vision through repeated shots and leaves it at the release position', () => {
    const { world, hero, hidden } = fixture();
    world.enqueue({ type: 'order', unit: hidden.id, order: { type: 'attack', target: hero.id } });
    world.step(113);
    expect(world.visionAreas).toHaveLength(2);
    world.setOrder(hidden, { type: 'idle' });
    hidden.x = 3000;
    hidden.y = 3000;
    expect(world.visible(hidden)).toBe(false);
    world.step(28);
    expect(world.visionAreas).toHaveLength(1);
    expect(world.pointVisible(BRUSH[0])).toBe(true);
    world.step(91);
    expect(world.pointVisible(BRUSH[0])).toBe(false);
  });

  it('hides remote projectile positions and turret health from gameplay perception', () => {
    const { world, hero } = fixture();
    const remote = { x: 3000, y: 3000 };
    const turret = world.spawn('turret', 'red', remote);
    expect(world.visible(turret)).toBe(false);
    world.enqueue({ type: 'cast', unit: hero.id, ability: 'r', point: { x: 4000, y: 4000 } });
    world.step();
    const missile = world.projectiles[0];
    Object.assign(missile, remote, { team: 'red' });
    expect(world.projectileVisible(missile)).toBe(false);
    Object.assign(missile, { x: hero.x, y: hero.y });
    expect(world.projectileVisible(missile)).toBe(true);
  });

  it('freezes event audiences at emission, even after later vision or unit removal', () => {
    const { world, hidden } = fixture();
    world.emit('cast', hidden, { unit: hidden.id, team: hidden.team, text: 'r' });
    const event = world.events[0];
    expect(world.eventVisible(event)).toBe(false);
    expect(world.eventVisible(event, 'red')).toBe(true);
    world.reveal = { point: { ...hidden }, endTick: 100 };
    expect(world.visible(hidden)).toBe(true);
    expect(world.eventVisible(event)).toBe(false);
    world.units = world.units.filter((u) => u.id !== hidden.id);
    expect(world.eventVisible(event)).toBe(false);
  });
});
