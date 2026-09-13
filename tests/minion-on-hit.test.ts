import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import type { Team, UnitKind } from '../src/simulation/types';
import type { RiftLayout } from '../src/content/rift';

const layout: RiftLayout = JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'));
const battlefield = {
  ...PRACTICE_FIXTURE,
  unitStats: layout.unitStats,
  minionCurrentHealthDamage: layout.minionCurrentHealthDamage,
  minionTurretDamage: layout.minionTurretDamage,
  lineOfSight: () => true,
};

function setup(kind: UnitKind, team: Team, victim: UnitKind, hp = 800, armor = 0) {
  const world = new World(false, battlefield);
  world.nextWaveTick = Infinity;
  const source = world.spawn(kind, team, { x: 0, y: 0 });
  const target = world.spawn(victim, team === 'blue' ? 'red' : 'blue', {
    x: source.missileSpeed ? 450 : 100,
    y: 0,
  });
  source.ai = false;
  source.damage = 80;
  source.range = 600;
  target.hp = hp;
  target.maxHp = 2000;
  target.armor = armor;
  target.stunUntil = Infinity;
  function release() {
    world.enqueue({ type: 'order', unit: source.id, order: { type: 'attack', target: target.id } });
    world.step();
    expect(source.releaseTick).not.toBeNull();
    world.step(source.releaseTick! - world.tick);
    source.nextAttackTick = Infinity;
  }
  return { world, source, target, release };
}

for (const team of ['blue', 'red'] as const)
  for (const [kind, ratio] of [
    ['melee', 0.02],
    ['caster', 0.035],
    ['siege', 0.05],
  ] as const)
    test(`${team} ${kind} on-hit uses current health against every lane-minion class`, () => {
      for (const victim of ['melee', 'caster', 'siege', 'super'] as const)
        for (const [hp, armor, mitigation] of [
          [800, 0, 1],
          [400, 100, 0.5],
          [200, -100, 1.5],
        ]) {
          const { world, source, target, release } = setup(kind, team, victim, hp, armor);
          release();
          if (source.missileSpeed) world.step(60);
          expect(hp - target.hp).toBeCloseTo((80 + hp * ratio) * mitigation, 4);
          expect(
            world.events.filter((e) => e.type === 'damage' && e.unit === target.id)
          ).toHaveLength(1);
        }
    });

for (const kind of ['caster', 'siege'] as const)
  test(`${kind} missile samples impact HP while retaining release AD after source death`, () => {
    const { world, source, target, release } = setup(kind, 'blue', 'melee');
    release();
    expect(target.hp).toBe(800);
    expect(world.projectiles.filter((p) => p.source === source.id)).toHaveLength(1);
    world.damage(world.hero, target, 400, 'true');
    source.damage = 900;
    world.damage(target, source, 1e6, 'true');
    world.step(60);
    expect(target.hp).toBeCloseTo(400 - 80 - 400 * (kind === 'caster' ? 0.035 : 0.05), 4);
    expect(world.projectiles).toHaveLength(0);
  });

test('later attacks recalculate the bonus instead of retaining the first hit’s health', () => {
  const { world, source, target, release } = setup('melee', 'red', 'siege');
  release();
  expect(target.hp).toBeCloseTo(704, 4);
  source.nextAttackTick = world.tick;
  release();
  expect(target.hp).toBeCloseTo(704 - 80 - 704 * 0.02, 4);
});

test('ordinary minion on-hit does not leak into other victims, super attacks, or direct damage', () => {
  for (const kind of ['melee', 'caster', 'siege'] as const)
    for (const victim of ['champion', 'dummy', 'inhibitor', 'nexus', 'turret'] as const) {
      const { world, source, target, release } = setup(kind, 'red', victim);
      release();
      if (source.missileSpeed) world.step(60);
      const multiplier = victim === 'turret' ? (kind === 'siege' ? 0.84 : 0.6) : 1;
      if (victim === 'champion')
        expect(
          world.events.find((event) => event.type === 'damage' && event.unit === target.id)?.value
        ).toBe(80);
      else expect(800 - target.hp).toBeCloseTo(80 * multiplier, 4);
    }
  for (const kind of ['champion', 'super'] as const) {
    const { world, source, target, release } = setup(kind, 'blue', 'melee');
    release();
    if (source.missileSpeed) world.step(60);
    expect(target.hp).toBe(720);
  }
  const { world, source, target } = setup('siege', 'blue', 'melee');
  world.damage(source, target, 80, 'physical');
  expect(target.hp).toBe(720);
});

test('lethal combined attack emits one death and consumes the missile once', () => {
  const { world, source, target, release } = setup('siege', 'blue', 'caster', 50);
  release();
  world.step(60);
  expect(target.hp).toBe(0);
  expect(world.events.filter((e) => e.type === 'death' && e.unit === target.id)).toHaveLength(1);
  expect(world.projectiles.filter((p) => p.source === source.id)).toHaveLength(0);
});
