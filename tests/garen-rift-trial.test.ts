import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRift } from '../src/content/rift';
import { NavGrid } from '../src/simulation/navgrid';
import { createLaneMatch } from '../src/simulation/lane-match';
import { World } from '../src/simulation/world';
import { distance } from '../src/simulation/math';
import { selectableChampion } from '../src/content/champion-profiles';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

const bytes = readFileSync('public/assets/maps/rift-nav.bin'),
  grid = new NavGrid(
    JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  ),
  rift = createRift(grid, JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))),
  trial = { ...rift, developmentGaren: true as const };

test('the trusted Garen Rift trial gives the human top and preserves all ten role assignments', () => {
  const w = createLaneMatch(trial, 'garen');
  expect(w.hero).toMatchObject({ champion: 'garen', ai: false, lane: null, mana: 0, maxMana: 0 });
  expect(w.player.role).toBe('top');
  expect(w.player.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(w.player.skillPoints).toBe(1);
  expect(w.battlefield.findPath).toBe(rift.findPath);
  expect(w.battlefield.lineWalkable).toBe(rift.lineWalkable);
  expect(w.battlefield.lineOfSight).toBe(rift.lineOfSight);
  expect(w.battlefield.inBrush).toBe(rift.inBrush);
  const champions = w.units.filter((u) => u.kind === 'champion');
  expect(champions).toHaveLength(10);
  expect(champions.filter((u) => u.ai)).toHaveLength(9);
  expect(champions.filter((u) => u.champion === 'garen')).toHaveLength(1);
  expect(champions.filter((u) => u.champion === 'ashe')).toHaveLength(5);
  expect(champions.filter((u) => u.champion === 'lux')).toHaveLength(4);
  for (const team of ['blue', 'red'] as const) {
    const roster = champions.filter((u) => u.team === team);
    expect(roster.map((u) => w.championState(u.id)!.role).sort()).toEqual([
      'carry',
      'jungle',
      'mid',
      'support',
      'top',
    ]);
    expect(roster.filter((u) => u.lane === 0)).toHaveLength(team === 'blue' ? 0 : 1);
  }
  expect(w.units.filter((u) => u.kind === 'turret')).toHaveLength(22);
  expect(w.units.some((u) => u.kind === 'dummy')).toBe(false);
  expect(rift.developmentGaren).toBeUndefined();
});

test('ordinary Rift selection and saved bytes cannot grant the Garen trial context', () => {
  expect(() => createLaneMatch(rift, 'garen')).toThrow(/development practice fixture/);
  expect(() => new World(false, rift, 'garen')).toThrow(/development practice fixture/);
  expect(() => selectableChampion('garen')).toThrow(/development/);
  expect(() => new World(false, { ...rift, developmentLeona: true }, 'garen')).toThrow(
    /development practice fixture/
  );
  expect(() => new World(false, trial, 'leona')).toThrow(/development/);
  const w = createLaneMatch(trial, 'garen'),
    saved = w.snapshot();
  expect(saved).not.toContain('developmentGaren');
  expect(World.fromSnapshot(saved, trial).snapshot()).toBe(saved);
  expect(() => World.fromSnapshot(saved, rift)).toThrow(/Garen.*development/);
  const raw = JSON.parse(saved);
  raw.developmentGaren = true;
  expect(() => World.fromSnapshot(JSON.stringify(raw), rift)).toThrow();
  delete raw.developmentGaren;
  raw.matchMode = 'practice';
  expect(() => World.fromSnapshot(JSON.stringify(raw), trial)).toThrow(/Garen/);
});

test('the human Garen remains idle and unlearned while all nine lane bots advance', () => {
  const w = createLaneMatch(trial, 'garen'),
    starts = new Map(
      w.units.filter((u) => u.kind === 'champion').map((u) => [u.id, { x: u.x, y: u.y }])
    );
  w.step(300);
  expect(distance(w.hero, starts.get(w.hero.id)!)).toBe(0);
  expect(w.player.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(w.player.skillPoints).toBe(1);
  for (const bot of w.units.filter((u) => u.kind === 'champion' && u.ai))
    expect(distance(bot, starts.get(bot.id)!)).toBeGreaterThan(300);
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, trial);
  expect(copy.snapshot()).toBe(saved);
  w.step(180);
  copy.step(180);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('Garen and every lane bot follow the source Rift navigation rather than fixture paths', () => {
  const w = createLaneMatch(trial, 'garen'),
    origin = { x: w.hero.x, y: w.hero.y },
    lane = rift.lanes.find((l) => l.name === 'top')!;
  w.setOrder(w.hero, { type: 'move', point: lane.points[Math.min(2, lane.points.length - 1)] });
  for (let i = 0; i < 360; i++) {
    w.step();
    for (const u of w.units.filter((u) => u.kind === 'champion'))
      expect(grid.lineWalkable(u.previous, u, u.radius, u.team as 'blue' | 'red')).toBe(true);
  }
  expect(distance(w.hero, origin)).toBeGreaterThan(1000);
  const copy = World.fromSnapshot(w.snapshot(), trial);
  w.step(180);
  copy.step(180);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('learned resource-free Garen Q W and E retain exact active continuation on the real map', () => {
  const w = createLaneMatch(trial, 'garen', { d: 'heal', f: 'flash' });
  expect(w.player.summoners).toEqual({ d: 'heal', f: 'flash' });
  w.gainExperience(1e6);
  for (const a of ['q', 'w', 'e', 'r'] as const) expect(w.learnSpell(a)).toBeNull();
  for (const ability of ['q', 'w', 'e'] as const)
    w.enqueue({ type: 'cast', unit: w.hero.id, ability, point: w.hero });
  w.step(20);
  expect(w.player.garenQ).not.toBeNull();
  expect(w.player.garenW).not.toBeNull();
  expect(w.player.garenE).not.toBeNull();
  expect(w.hero.mana).toBe(0);
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, trial);
  expect(copy.snapshot()).toBe(saved);
  w.step(400);
  copy.step(400);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('ordinary Ashe and Lux roles and the original Garen practice context remain available', () => {
  for (const [champion, role] of [
    ['ashe', 'carry'],
    ['lux', 'mid'],
  ] as const) {
    const w = createLaneMatch(rift, champion);
    expect(w.player.role).toBe(role);
    expect(w.units.filter((u) => u.kind === 'champion')).toHaveLength(10);
    expect(World.fromSnapshot(w.snapshot(), rift).snapshot()).toBe(w.snapshot());
  }
  const practice = new World(false, PRACTICE_FIXTURE, 'garen');
  expect(World.fromSnapshot(practice.snapshot(), PRACTICE_FIXTURE).snapshot()).toBe(
    practice.snapshot()
  );
});
