import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRift } from '../src/content/rift';
import { NavGrid } from '../src/simulation/navgrid';
import { createLaneMatch } from '../src/simulation/lane-match';
import {
  assertMatchResources,
  assertMatchVictory,
  observeStructureDamage,
  structureExposed,
} from '../tools/qa/match-contract';
const bytes = readFileSync('public/assets/maps/rift-nav.bin');
const rift = createRift(
  new NavGrid(
    JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  ),
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);
const fresh = () => createLaneMatch(rift);

test('audit accepts real role initialization and rejects missing or duplicated champions', () => {
  const world = fresh();
  assertMatchResources(world);
  assertMatchVictory(world);
  const unit = world.units.find((unit) => unit.kind === 'champion' && unit.id !== world.hero.id)!;
  world.units = world.units.filter((other) => other !== unit);
  expect(() => assertMatchResources(world)).toThrow(/roster/);
  world.units.push(world.hero);
  expect(() => assertMatchResources(world)).toThrow(/roster/);
});

for (const field of ['x', 'y', 'hp', 'maxHp', 'mana', 'maxMana'] as const)
  test(`audit catches nonfinite ${field} at the actual offending tick`, () => {
    const world = fresh();
    world.tick = 1;
    world.hero[field] = NaN;
    expect(() => assertMatchResources(world)).toThrow(/tick 1/);
  });

test('audit rejects bounded resources and invalid champion economy', () => {
  for (const mutate of [
    (world: ReturnType<typeof fresh>) => {
      world.hero.hp = world.hero.maxHp + 1;
    },
    (world: ReturnType<typeof fresh>) => {
      world.hero.mana = -1;
    },
    (world: ReturnType<typeof fresh>) => {
      world.player.gold = -1;
    },
    (world: ReturnType<typeof fresh>) => {
      world.player.level = 19;
    },
  ]) {
    const world = fresh();
    mutate(world);
    expect(() => assertMatchResources(world)).toThrow(/Invalid/);
  }
});

test('independent gate catches protected damage even if the gameplay predicate is wrong', () => {
  const world = fresh();
  const inner = world.units.find((u) => u.team === 'red' && u.structure?.role === 'inner-turret')!;
  expect(structureExposed(inner, world.units)).toBe(false);
  observeStructureDamage(world, () => {});
  world.vulnerable = () => true;
  expect(() => world.damage(world.hero, inner, 1000, 'true')).toThrow(/Protected structure/);
});

test('passive damage observation preserves world snapshots, allocation and random state', () => {
  const first = fresh(),
    second = fresh(),
    hits: number[] = [];
  observeStructureDamage(first, (unit) => hits.push(unit.id));
  expect(first.snapshot()).toBe(second.snapshot());
  for (const world of [first, second]) {
    const outer = world.units.find(
      (u) => u.team === 'red' && u.structure?.role === 'outer-turret'
    )!;
    world.damage(world.hero, outer, 100, 'true');
    world.step(120);
  }
  expect(hits).toHaveLength(1);
  expect(first.snapshot()).toBe(second.snapshot());
});

test('victory audit requires one losing Nexus, an open inhibitor and both Nexus turrets', () => {
  const world = fresh();
  world.winner = 'blue';
  expect(() => assertMatchVictory(world)).toThrow(/Winner/);
  world.winner = null;
  const nexus = world.units.find((u) => u.team === 'red' && u.kind === 'nexus')!;
  nexus.hp = 0;
  expect(() => assertMatchVictory(world)).toThrow(/without/);
  world.winner = 'blue';
  expect(() => assertMatchVictory(world)).toThrow(/impossible/);
  for (const unit of world.units)
    if (
      unit.team === 'red' &&
      (unit.kind === 'inhibitor' || unit.structure?.role === 'nexus-turret')
    )
      unit.hp = 0;
  assertMatchVictory(world);
  world.units.find((u) => u.team === 'blue' && u.kind === 'nexus')!.hp = 0;
  expect(() => assertMatchVictory(world)).toThrow(/Winner/);
});
