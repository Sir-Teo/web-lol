import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRift } from '../src/content/rift';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { NavGrid } from '../src/simulation/navgrid';
import { createLaneMatch } from '../src/simulation/lane-match';
import { World } from '../src/simulation/world';
import { distance } from '../src/simulation/math';

const metadata = JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8'));
const bytes = readFileSync('public/assets/maps/rift-nav.bin');
const rift = createRift(
  new NavGrid(metadata, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);

test('lane match preserves the authored structures and creates a human with nine independent bots', () => {
  const original = JSON.stringify(rift.initialUnits);
  const world = createLaneMatch(rift);
  const champions = world.units.filter((u) => u.kind === 'champion');
  expect(world.matchMode).toBe('lanes');
  expect(champions).toHaveLength(10);
  expect(champions.filter((u) => u.ai)).toHaveLength(9);
  expect(champions.filter((u) => u.champion === 'lux')).toHaveLength(2);
  expect(world.hero.ai).toBe(false);
  expect(world.hero.lane).toBeNull();
  expect(world.units.some((u) => u.kind === 'dummy')).toBe(false);
  for (const team of ['blue', 'red'] as const) {
    const roster = champions.filter((u) => u.team === team);
    expect(roster).toHaveLength(5);
    for (const unit of roster) {
      expect(distance(unit, rift.spawns[team])).toBeLessThan(300);
      expect(rift.reachable(unit, unit.radius, team)).toEqual({ x: unit.x, y: unit.y });
    }
    expect(roster.filter((u) => u.lane === 0)).toHaveLength(2);
    expect(roster.filter((u) => u.lane === 1 && u.champion === 'lux')).toHaveLength(1);
    expect(roster.filter((u) => u.lane === 2)).toHaveLength(team === 'blue' ? 1 : 2);
  }
  const structures = (w: World) =>
    w.units
      .filter((u) => u.structure)
      .map((u) => ({
        kind: u.kind,
        team: u.team,
        x: u.x,
        y: u.y,
        hp: u.hp,
        structure: u.structure,
        transform: u.structureTransform,
      }));
  expect(structures(world)).toEqual(structures(new World(true, rift)));
  expect(JSON.stringify(rift.initialUnits)).toBe(original);
});

test('bots leave their fountains while the human remains idle, with exact saved continuation', () => {
  const world = createLaneMatch(rift);
  const starts = new Map(
    world.units.filter((u) => u.kind === 'champion').map((u) => [u.id, { x: u.x, y: u.y }])
  );
  world.step(300);
  expect(distance(world.hero, starts.get(world.hero.id)!)).toBe(0);
  for (const bot of world.units.filter((u) => u.kind === 'champion' && u.ai))
    expect(distance(bot, starts.get(bot.id)!)).toBeGreaterThan(300);
  const saved = world.snapshot();
  const restored = World.fromSnapshot(saved, rift);
  expect(restored.snapshot()).toBe(saved);
  world.step(120);
  restored.step(120);
  expect(restored.snapshot()).toBe(world.snapshot());
});

test('invalid lane configuration and incompatible saved modes are rejected', () => {
  expect(() => createLaneMatch(PRACTICE_FIXTURE)).toThrow('Summoner');
  expect(() =>
    createLaneMatch({ ...rift, lanes: rift.lanes.filter((l) => l.name !== 'top') })
  ).toThrow('top');
  const state = JSON.parse(new World(true, PRACTICE_FIXTURE).snapshot());
  state.matchMode = 'lanes';
  expect(() => World.fromSnapshot(JSON.stringify(state), PRACTICE_FIXTURE)).toThrow('Summoner');
  state.matchMode = 'unknown';
  expect(() => World.fromSnapshot(JSON.stringify(state), PRACTICE_FIXTURE)).toThrow();
});

test('human Lux replaces the allied mid bot and preserves the ten-champion lane roster', () => {
  const world = createLaneMatch(rift, 'lux');
  expect(world.hero.champion).toBe('lux');
  expect(world.hero.name).toBe('Lux');
  expect(world.hero.lane).toBeNull();
  expect(world.hero.ai).toBe(false);
  const champions = world.units.filter((u) => u.kind === 'champion');
  expect(champions).toHaveLength(10);
  expect(champions.filter((u) => u.champion === 'lux')).toHaveLength(2);
  expect(champions.filter((u) => u.ai)).toHaveLength(9);
  expect(champions.filter((u) => u.team === 'blue' && u.lane === 1)).toHaveLength(0);
  expect(champions.filter((u) => u.team === 'blue' && u.lane === 2)).toHaveLength(2);
  expect(world.hero.hp).toBe(580);
  expect(world.hero.mana).toBe(440);
  expect(world.player.qStacks).toBe(0);
  expect(world.player.eCharges).toBe(0);
  world.step(300);
  const saved = world.snapshot();
  const restored = World.fromSnapshot(saved, rift);
  expect(restored.snapshot()).toBe(saved);
  world.step(120);
  restored.step(120);
  expect(restored.snapshot()).toBe(world.snapshot());
});

test('practice constructor initializes Lux with her own resources and spell state', () => {
  const world = new World(true, rift, 'lux');
  expect(world.matchMode).toBe('practice');
  expect(world.hero.name).toBe('Lux');
  expect(world.hero.range).toBe(550);
  expect(world.hero.speed).toBe(330);
  expect(world.player.skillPoints).toBe(1);
  expect(world.player.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(world.units.filter((u) => u.kind === 'dummy')).toHaveLength(1);
  expect(world.units.filter((u) => u.kind === 'champion')).toHaveLength(2);
  expect(World.fromSnapshot(world.snapshot(), rift).hero.champion).toBe('lux');
});
