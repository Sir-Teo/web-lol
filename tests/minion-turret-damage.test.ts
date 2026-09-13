import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import type { LaneMinionKind, Team, UnitKind } from '../src/simulation/types';
import type { RiftLayout } from '../src/content/rift';
const layout: RiftLayout = JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'));
const battlefield = {
  ...PRACTICE_FIXTURE,
  unitStats: layout.unitStats,
  minionTurretDamage: layout.minionTurretDamage,
  lineOfSight: () => true,
};

function attack(
  kind: UnitKind,
  team: Team,
  targetKind: UnitKind = 'turret',
  killAfterRelease = false
) {
  const world = new World(false, battlefield);
  world.nextWaveTick = Infinity;
  const source = world.spawn(kind, team, { x: 0, y: 0 });
  const target = world.spawn(targetKind, team === 'blue' ? 'red' : 'blue', {
    x: source.missileSpeed ? 450 : 100,
    y: 0,
  });
  source.ai = false;
  source.damage = 160;
  source.range = 600;
  target.hp = target.maxHp = 10000;
  target.armor = 60;
  target.stunUntil = Infinity;
  world.enqueue({ type: 'order', unit: source.id, order: { type: 'attack', target: target.id } });
  world.step();
  expect(source.releaseTick).not.toBeNull();
  world.step(source.releaseTick! - world.tick);
  source.nextAttackTick = Infinity;
  if (source.missileSpeed) {
    expect(target.hp).toBe(10000);
    expect(world.projectiles.filter((p) => p.source === source.id)).toHaveLength(1);
    source.damage = 999; // A launched attack keeps its original AD.
    if (killAfterRelease) world.damage(target, source, 1e6, 'true');
    world.step(60);
  }
  return { world, source, target, loss: 10000 - target.hp };
}

for (const team of ['blue', 'red'] as const)
  for (const [kind, loss] of [
    ['melee', 60],
    ['caster', 60],
    ['siege', 84],
    ['super', 60],
  ] as const)
    test(`${team} ${kind} applies its turret modifier once, followed by armor`, () => {
      const result = attack(kind, team);
      expect(result.loss).toBeCloseTo(loss);
      expect(
        result.world.events.filter((e) => e.type === 'damage' && e.unit === result.target.id)
      ).toHaveLength(1);
    });

for (const kind of ['caster', 'siege'] as LaneMinionKind[])
  test(`${kind} missile retains turret damage and release AD after its source dies`, () => {
    const result = attack(kind, 'blue', 'turret', true);
    expect(result.source.hp).toBe(0);
    expect(result.loss).toBeCloseTo(kind === 'siege' ? 84 : 60);
    expect(result.world.projectiles).toHaveLength(0);
  });

test('turret modifiers do not affect champions, other victims, or non-attack damage', () => {
  expect(attack('champion', 'blue').loss).toBeCloseTo(100);
  for (const target of ['champion', 'melee', 'inhibitor', 'nexus'] as const)
    expect(attack('siege', 'red', target).loss).toBeCloseTo(100);
  const { world, source, target } = attack('siege', 'blue');
  const before = target.hp;
  world.damage(source, target, 160, 'physical');
  expect(before - target.hp).toBeCloseTo(100);
});
