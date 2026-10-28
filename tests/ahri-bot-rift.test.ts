import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRift } from '../src/content/rift';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { createLaneMatch } from '../src/simulation/lane-match';
import { NavGrid } from '../src/simulation/navgrid';
import { distance } from '../src/simulation/math';
import { World } from '../src/simulation/world';

const bytes = readFileSync('public/assets/maps/rift-nav.bin');
const grid = new NavGrid(
  JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
);
const rift = createRift(
  grid,
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);
const trial = { ...rift, developmentAhriRift: true as const, developmentAhriBots: true as const };

for (const player of ['ashe', 'lux', 'ahri'] as const)
  test(`${player} human keeps manual control while trusted mid slots select Ahri bots`, () => {
    const w = createLaneMatch(trial, player);
    const champions = w.units.filter((u) => u.kind === 'champion');
    expect(w.hero.champion).toBe(player);
    expect(w.hero.ai).toBe(false);
    expect(w.hero.lane).toBeNull();
    expect(w.player.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
    expect(champions).toHaveLength(10);
    expect(champions.filter((u) => u.ai)).toHaveLength(9);
    expect(champions.filter((u) => u.champion === 'ahri')).toHaveLength(player === 'lux' ? 1 : 2);
    for (const team of ['blue', 'red'] as const) {
      const members = champions.filter((u) => u.team === team);
      expect(members.map((u) => w.championState(u.id)!.role).sort()).toEqual([
        'carry',
        'jungle',
        'mid',
        'support',
        'top',
      ]);
      const mid = members.find((u) => w.championState(u.id)!.role === 'mid')!;
      if (mid.ai) {
        expect(mid.champion).toBe('ahri');
        expect(w.battlefield.lanes[mid.lane!].name).toBe('mid');
      }
      const jungler = members.find((u) => w.championState(u.id)!.role === 'jungle')!;
      expect(w.championState(jungler.id)!.summoners).toEqual({ d: 'smite', f: 'flash' });
    }
    expect(w.units.filter((u) => u.kind === 'turret')).toHaveLength(22);
    expect(w.battlefield.findPath).toBe(rift.findPath);
    expect(rift.developmentAhriBots).toBeUndefined();
    expect(World.fromSnapshot(w.snapshot(), trial).snapshot()).toBe(w.snapshot());
  });

test('the bot selector cannot authorize an ordinary Rift or forged saved permission', () => {
  const w = createLaneMatch(trial, 'ashe');
  for (const context of [
    rift,
    { ...rift, developmentAhri: true as const },
    { ...rift, developmentAhriBots: true as const },
  ]) {
    expect(() => World.fromSnapshot(w.snapshot(), context)).toThrow(/Ahri/);
  }
  expect(() => createLaneMatch({ ...rift, developmentAhriBots: true }, 'ashe')).toThrow(/trusted/);
  expect(() => createLaneMatch({ ...PRACTICE_FIXTURE, developmentAhriBots: true }, 'ashe')).toThrow(
    /Rift/
  );
  const raw = JSON.parse(w.snapshot());
  raw.developmentAhriRift = raw.developmentAhriBots = true;
  expect(() => World.fromSnapshot(JSON.stringify(raw), rift)).toThrow();
  expect(w.snapshot()).not.toContain('developmentAhriBots');
});

test('both AI mids follow the source grid, learn their own Q and restore exact independent futures', () => {
  const w = createLaneMatch(trial, 'ashe');
  const bots = w.units.filter((u) => u.champion === 'ahri');
  const starts = bots.map((u) => ({ x: u.x, y: u.y }));
  const hero = { x: w.hero.x, y: w.hero.y };
  for (let i = 0; i < 300; i++) {
    w.step();
    for (const bot of bots)
      expect(grid.lineWalkable(bot.previous, bot, bot.radius, bot.team as 'blue' | 'red')).toBe(
        true
      );
  }
  expect(distance(w.hero, hero)).toBe(0);
  expect(w.player.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  for (const [index, bot] of bots.entries()) {
    expect(distance(bot, starts[index])).toBeGreaterThan(300);
    const state = w.championState(bot.id)!;
    expect(state.spellRanks).toEqual({ q: 1, w: 0, e: 0, r: 0 });
    expect(state.eCharges).toBe(0);
    expect(state.inventory).toContain('tome');
    expect(state.inventory).not.toContain('blade');
  }
  const copy = World.fromSnapshot(w.snapshot(), trial);
  w.step(180);
  copy.step(180);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('normal mid bots meet and cast their own Q without replacing navigation or team sight', () => {
  const w = createLaneMatch(trial, 'ashe');
  const bots = w.units.filter((u) => u.champion === 'ahri');
  const casts = new Set<number>();
  for (let i = 0; i < 6000 && casts.size < 2; i++) {
    w.step();
    for (const bot of bots)
      if (w.championState(bot.id)!.pendingCast?.ability === 'q') casts.add(bot.id);
  }
  expect(casts.size).toBe(2);
  expect(bots.every((bot) => w.alive(bot))).toBe(true);
  expect(w.battlefield.lineOfSight).toBe(rift.lineOfSight);
  const copy = World.fromSnapshot(w.snapshot(), trial);
  w.step(180);
  copy.step(180);
  expect(copy.snapshot()).toBe(w.snapshot());
}, 30000);

test('ordinary and original human-Ahri trials retain their existing rosters', () => {
  for (const player of ['ashe', 'lux'] as const) {
    const w = createLaneMatch(rift, player);
    expect(w.units.some((u) => u.champion === 'ahri')).toBe(false);
  }
  const original = createLaneMatch({ ...rift, developmentAhriRift: true }, 'ahri');
  expect(original.units.filter((u) => u.champion === 'ahri')).toHaveLength(1);
  expect(
    original.units.find((u) => u.team === 'red' && original.championState(u.id)?.role === 'mid')!
      .champion
  ).toBe('lux');
});
