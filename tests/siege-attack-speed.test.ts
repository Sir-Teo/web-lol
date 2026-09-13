import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import type { RiftLayout } from '../src/content/rift';
import type { Team, UnitKind, StructureState } from '../src/simulation/types';

const layout: RiftLayout = JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'));
function fixture(
  team: Team,
  kind: UnitKind = 'siege',
  lane: StructureState['lane'] = 'mid',
  victim: UnitKind = 'turret'
) {
  const world = new World(false, {
    ...PRACTICE_FIXTURE,
    siegeMidTurretAttackSpeedBonus: layout.siegeMidTurretAttackSpeedBonus,
    lineOfSight: () => true,
  });
  world.nextWaveTick = Infinity;
  const source = world.spawn(kind, team, { x: 0, y: 0 });
  source.ai = false;
  source.range = 600;
  source.attackPeriod = 130;
  source.windupTicks = 39;
  const target = world.spawn(victim, team === 'blue' ? 'red' : 'blue', { x: 400, y: 0 });
  target.structure = { role: 'outer-turret', lane, regenPerSecond: 0, healthBarHeight: 100 };
  target.stunUntil = Infinity;
  target.hp = target.maxHp = 10000;
  world.enqueue({ type: 'order', unit: source.id, order: { type: 'attack', target: target.id } });
  return { world, source, target };
}

for (const team of ['blue', 'red'] as const)
  test(`${team} siege attacks a mid turret with shorter windup and repeated cadence`, () => {
    const { world, source } = fixture(team);
    world.step();
    expect(source.releaseTick).toBe(31);
    expect(source.nextAttackTick).toBe(101);
    const releases: number[] = [];
    for (let i = 0; i < 330; i++) {
      world.step();
      if (
        world.events.some(
          (e) => e.type === 'attack' && e.unit === source.id && e.tick === world.tick
        )
      )
        releases.push(world.tick);
    }
    expect(releases).toEqual([31, 131, 231, 331]);
    expect(source.attackPeriod).toBe(130);
    expect(source.windupTicks).toBe(39);
  });

test('bonus depends on turret lane and siege class, not the attacker’s assigned lane', () => {
  for (const lane of ['top', 'bot', null] as const) {
    const { world, source } = fixture('blue', 'siege', lane);
    source.lane = 1;
    world.step();
    expect(source.releaseTick).toBe(40);
    expect(source.nextAttackTick).toBe(131);
  }
  for (const kind of ['melee', 'caster', 'super', 'champion'] as const) {
    const { world, source } = fixture('red', kind);
    world.step();
    expect(source.nextAttackTick).toBe(131);
  }
  for (const victim of ['inhibitor', 'nexus', 'melee', 'champion'] as const) {
    const { world, source } = fixture('blue', 'siege', 'mid', victim);
    world.step();
    expect(source.nextAttackTick).toBe(131);
  }
});

test('changing victims removes the bonus without rewriting the existing cooldown', () => {
  const { world, source } = fixture('blue');
  world.step(31);
  const next = world.spawn('turret', 'red', { x: 350, y: 0 });
  next.structure = { role: 'outer-turret', lane: 'top', regenPerSecond: 0, healthBarHeight: 100 };
  next.stunUntil = Infinity;
  world.enqueue({ type: 'order', unit: source.id, order: { type: 'attack', target: next.id } });
  world.step(69);
  expect(source.nextAttackTick).toBe(101);
  expect(source.releaseTick).toBeNull();
  world.step();
  expect(source.releaseTick).toBe(140);
  expect(source.nextAttackTick).toBe(231);
});
