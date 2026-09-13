import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import type { RiftLayout } from '../src/content/rift';
import type { Team, UnitKind, StructureState } from '../src/simulation/types';

const layout: RiftLayout = JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'));
const battlefield = {
  ...PRACTICE_FIXTURE,
  turretMinionHealthDamage: layout.turretMinionHealthDamage,
  lineOfSight: () => true,
};
function setup(team: Team, victim: UnitKind, role: StructureState['role'] = 'outer-turret') {
  const world = new World(false, battlefield);
  world.nextWaveTick = Infinity;
  const source = world.spawn('turret', team, { x: 0, y: 0 });
  source.structure = {
    role,
    lane: role === 'nexus-turret' ? null : 'mid',
    regenPerSecond: 0,
    healthBarHeight: 100,
  };
  source.ai = false;
  source.damage = 123;
  const target = world.spawn(victim, team === 'blue' ? 'red' : 'blue', { x: 400, y: 0 });
  target.stunUntil = Infinity;
  target.hp = target.maxHp = 1000;
  target.armor = 0;
  function release() {
    world.enqueue({ type: 'order', unit: source.id, order: { type: 'attack', target: target.id } });
    world.step();
    expect(source.releaseTick).not.toBeNull();
    world.step(source.releaseTick! - world.tick);
    source.nextAttackTick = Infinity;
    expect(world.projectiles.filter((p) => p.source === source.id)).toHaveLength(1);
  }
  return { world, source, target, release };
}

for (const team of ['blue', 'red'] as const)
  for (const role of ['outer-turret', 'inner-turret', 'inhibitor-turret', 'nexus-turret'] as const)
    test(`${team} ${role} uses class-specific maximum-health damage`, () => {
      for (const [kind, ratio] of [
        ['melee', 0.45],
        ['caster', 0.7],
        ['super', 0.07],
        ['siege', role === 'outer-turret' ? 0.14 : role === 'inner-turret' ? 0.11 : 0.08],
      ] as const) {
        for (const [maxHp, armor, mitigation] of [
          [1000, 0, 1],
          [2000, 100, 0.5],
          [500, -100, 1.5],
        ]) {
          const { world, target, release } = setup(team, kind, role);
          target.maxHp = target.hp = maxHp;
          target.armor = armor;
          release();
          world.step(60);
          expect(target.hp).toBeCloseTo(Math.max(0, maxHp - maxHp * ratio * mitigation));
          expect(
            world.events.filter((e) => e.type === 'damage' && e.unit === target.id)
          ).toHaveLength(1);
        }
      }
    });

test('turret shots sample maximum health on contact, independent of current health and release AD', () => {
  const { world, source, target, release } = setup('blue', 'siege');
  release();
  target.hp = 400;
  target.maxHp = 2000;
  source.damage = 9999;
  world.damage(target, source, 1e6, 'true');
  world.step(60);
  expect(target.hp).toBeCloseTo(120);
  expect(world.projectiles).toHaveLength(0);
});

test('unarmored melee and caster minions retain fixed turret last-hit windows', () => {
  for (const [kind, first, second] of [
    ['melee', 550, 100],
    ['caster', 300, 0],
  ] as const) {
    const { world, source, target, release } = setup('red', kind);
    release();
    world.step(60);
    expect(target.hp).toBe(first);
    source.nextAttackTick = world.tick;
    release();
    world.step(60);
    expect(target.hp).toBe(second);
    expect(world.events.filter((e) => e.type === 'death' && e.unit === target.id)).toHaveLength(
      kind === 'caster' ? 1 : 0
    );
  }
});

test('unknown turret roles, champion victims, and direct damage retain their ordinary damage path', () => {
  const { world, target, release } = setup('blue', 'champion');
  release();
  world.step(60);
  expect(
    world.events.find((event) => event.type === 'damage' && event.unit === target.id)?.value
  ).toBe(123);
  const unknown = setup('red', 'melee');
  delete unknown.source.structure;
  unknown.release();
  unknown.world.step(60);
  expect(unknown.target.hp).toBe(877);
  const direct = setup('blue', 'caster');
  direct.world.damage(direct.source, direct.target, 123, 'physical');
  expect(direct.target.hp).toBe(877);
});
