import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRift } from '../src/content/rift';
import { NavGrid } from '../src/simulation/navgrid';
import { createLaneMatch } from '../src/simulation/lane-match';
import { World } from '../src/simulation/world';
import { assignRole } from '../src/simulation/bot-jungle';
import { distance } from '../src/simulation/math';
import { selectableChampion } from '../src/content/champion-profiles';

const bytes = readFileSync('public/assets/maps/rift-nav.bin');
const grid = new NavGrid(
  JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
);
const rift = createRift(
  grid,
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);
const trial = { ...rift, developmentLeona: true as const };

test('an explicit development Rift context permits a human Leona support match', () => {
  const world = createLaneMatch(trial, 'leona');
  expect(world.battlefield.id).toBe('rift');
  expect(world.battlefield.findPath).toBe(rift.findPath);
  expect(world.battlefield.lineWalkable).toBe(rift.lineWalkable);
  expect(world.battlefield.lineOfSight).toBe(rift.lineOfSight);
  expect(world.battlefield.inBrush).toBe(rift.inBrush);
  expect(rift.developmentLeona).toBeUndefined();
  expect(world.hero).toMatchObject({ champion: 'leona', ai: false, lane: null });
  expect(world.player.role).toBe('support');
  const champions = world.units.filter((u) => u.kind === 'champion');
  expect(champions).toHaveLength(10);
  expect(champions.filter((u) => u.ai)).toHaveLength(9);
  expect(champions.filter((u) => u.champion === 'leona')).toHaveLength(1);
  for (const team of ['blue', 'red'] as const) {
    const roster = champions.filter((u) => u.team === team);
    expect(roster.map((u) => world.championState(u.id)!.role).sort()).toEqual([
      'carry',
      'jungle',
      'mid',
      'support',
      'top',
    ]);
    expect(roster.filter((u) => u.lane === 2)).toHaveLength(team === 'blue' ? 1 : 2);
  }
  expect(world.units.filter((u) => u.kind === 'turret')).toHaveLength(22);
  expect(world.units.some((u) => u.kind === 'dummy')).toBe(false);
});

test('a development Rift context can spawn and restore an independent Leona bot', () => {
  const world = createLaneMatch(trial);
  const support = world.units.find(
    (u) => u.team === 'red' && world.championState(u.id)?.role === 'support'
  )!;
  world.units = world.units.filter((u) => u.id !== support.id);
  const leona = world.spawn('champion', 'red', support, 'leona');
  leona.ai = true;
  leona.lane = support.lane;
  assignRole(world.championState(leona.id)!, 'support');
  world.step(300);
  expect(distance(leona, support)).toBeGreaterThan(300);
  expect(world.championState(leona.id)!.spellRanks.q).toBe(1);
  const saved = world.snapshot();
  const copy = World.fromSnapshot(saved, trial);
  expect(copy.snapshot()).toBe(saved);
  world.step(180);
  copy.step(180);
  expect(copy.snapshot()).toBe(world.snapshot());
  expect(() => World.fromSnapshot(saved, rift)).toThrow(/Leona.*development/);
});

test('trial permission cannot be carried in a save or granted by ordinary Rift selection', () => {
  expect(() => createLaneMatch(rift, 'leona')).toThrow(/development/);
  expect(() => new World(false, rift, 'leona')).toThrow(/development/);
  const ordinary = createLaneMatch(rift);
  expect(() => ordinary.spawn('champion', 'blue', ordinary.hero, 'leona')).toThrow(/development/);
  expect(() => selectableChampion('leona')).toThrow(/development/);
  expect(() => new World(false, trial, 'garen')).toThrow(/development/);
  const world = createLaneMatch(trial, 'leona');
  const saved = world.snapshot();
  expect(saved).not.toContain('developmentLeona');
  expect(() => World.fromSnapshot(saved, rift)).toThrow(/Leona.*development/);
  const raw = JSON.parse(saved);
  raw.developmentLeona = true;
  expect(() => World.fromSnapshot(JSON.stringify(raw), rift)).toThrow();
  delete raw.developmentLeona;
  raw.matchMode = 'practice';
  expect(() => World.fromSnapshot(JSON.stringify(raw), trial)).toThrow(/Leona/);
});

test('the support starts unlearned and pays for learned spells on the real map', () => {
  const world = createLaneMatch(trial, 'leona', { d: 'heal', f: 'flash' });
  expect(world.player.summoners).toEqual({ d: 'heal', f: 'flash' });
  expect(world.player.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(world.player.skillPoints).toBe(1);
  world.enqueue({ type: 'cast', unit: world.hero.id, ability: 'q', point: world.hero });
  world.step();
  expect(world.player.leonaQ).toBeNull();
  expect(world.learnSpell('q')).toBeNull();
  world.enqueue({ type: 'cast', unit: world.hero.id, ability: 'q', point: world.hero });
  world.step();
  expect(world.player.leonaQ).not.toBeNull();
  expect(world.hero.mana).toBeLessThan(world.hero.maxMana - 29);
  expect(world.player.cooldowns.q).toBeGreaterThan(world.tick);
  const saved = world.snapshot();
  const copy = World.fromSnapshot(saved, trial);
  world.step(400);
  copy.step(400);
  expect(copy.snapshot()).toBe(world.snapshot());
});

test('support navigation and all nine bot paths use the source Rift terrain', () => {
  const world = createLaneMatch(trial, 'leona');
  const origin = { ...world.hero };
  const botLane = rift.lanes.find((l) => l.name === 'bot')!;
  const destination = botLane.points[Math.min(2, botLane.points.length - 1)];
  world.setOrder(world.hero, { type: 'move', point: destination });
  for (let tick = 0; tick < 360; tick++) {
    world.step();
    for (const u of world.units.filter((u) => u.kind === 'champion'))
      expect(grid.lineWalkable(u.previous, u, u.radius, u.team as 'blue' | 'red')).toBe(true);
  }
  expect(distance(world.hero, origin)).toBeGreaterThan(1000);
  const saved = world.snapshot();
  const copy = World.fromSnapshot(saved, trial);
  world.step(180);
  copy.step(180);
  expect(copy.snapshot()).toBe(world.snapshot());
});

test('human support remains idle while lane teammates advance without allocating her skills', () => {
  const world = createLaneMatch(trial, 'leona');
  const starts = new Map(
    world.units.filter((u) => u.kind === 'champion').map((u) => [u.id, { x: u.x, y: u.y }])
  );
  world.step(300);
  expect(distance(world.hero, starts.get(world.hero.id)!)).toBe(0);
  expect(world.player.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(world.player.skillPoints).toBe(1);
  for (const bot of world.units.filter((u) => u.kind === 'champion' && u.ai))
    expect(distance(bot, starts.get(bot.id)!)).toBeGreaterThan(300);
  expect(world.teamPlans).not.toBeNull();
  expect(World.fromSnapshot(world.snapshot(), trial).snapshot()).toBe(world.snapshot());
});
