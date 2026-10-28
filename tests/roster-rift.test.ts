import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRift } from '../src/content/rift';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { NavGrid } from '../src/simulation/navgrid';
import { createLaneMatch } from '../src/simulation/lane-match';
import { World } from '../src/simulation/world';
import { distance } from '../src/simulation/math';
import type { Battlefield } from '../src/simulation/battlefield';

const bytes = readFileSync('public/assets/maps/rift-nav.bin');
const grid = new NavGrid(
  JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
);
const rift = createRift(
  grid,
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);
const trial = {
  ...rift,
  developmentRosterBots: true as const,
  developmentGaren: true as const,
  developmentLeona: true as const,
  developmentMasterYiRift: true as const,
  developmentMasterYiBots: true as const,
  developmentAhriRift: true as const,
  developmentAhriBots: true as const,
};
const roles = { top: 'garen', jungle: 'masteryi', mid: 'ahri', carry: 'ashe', support: 'leona' };

for (const player of ['ashe', 'lux', 'garen', 'leona', 'masteryi', 'ahri'] as const)
  test(`the combined roster keeps ${player} manual in their own role and pays for NPC companions`, () => {
    const w = createLaneMatch(
      trial,
      player,
      player === 'masteryi' ? { d: 'smite', f: 'flash' } : { d: 'flash', f: 'heal' }
    );
    const champions = w.units.filter((u) => u.kind === 'champion');
    expect(w.hero).toMatchObject({ champion: player, ai: false, lane: null });
    expect(champions).toHaveLength(10);
    expect(champions.filter((u) => u.ai)).toHaveLength(9);
    expect(w.player.gold).toBe(500);
    expect(w.player.inventory).toEqual([]);
    expect(w.player.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
    for (const team of ['blue', 'red'] as const) {
      const members = champions.filter((u) => u.team === team);
      expect(members.map((u) => w.championState(u.id)!.role).sort()).toEqual(
        Object.keys(roles).sort()
      );
      for (const bot of members.filter((u) => u.ai)) {
        const state = w.championState(bot.id)!;
        expect(bot.champion).toBe(roles[state.role!]);
        if (state.role === 'jungle') {
          expect(bot.lane).toBeNull();
          expect(state.summoners).toEqual({ d: 'smite', f: 'flash' });
          expect(state.inventory).toEqual(['mosstomper']);
          expect(state.gold).toBe(50);
          expect(w.companions.find((p) => p.ownerId === bot.id)).toMatchObject({
            kind: 'mosstomper',
            acquisition: { kind: 'purchase', consumedTick: null },
          });
        } else expect(state.summoners).toEqual({ d: 'flash', f: 'heal' });
      }
    }
    expect(w.companions.some((p) => p.ownerId === w.hero.id)).toBe(false);
    expect(w.units.filter((u) => u.kind === 'turret')).toHaveLength(22);
    expect(w.battlefield.findPath).toBe(rift.findPath);
    expect(World.fromSnapshot(w.snapshot(), trial).snapshot()).toBe(w.snapshot());
  });

test('the combined selector requires every existing trusted admission and NPC selection', () => {
  expect(() => createLaneMatch({ ...rift, developmentRosterBots: true })).toThrow(/trusted/);
  for (const flag of [
    'developmentGaren',
    'developmentLeona',
    'developmentMasterYiRift',
    'developmentMasterYiBots',
    'developmentAhriRift',
    'developmentAhriBots',
  ] as const) {
    const missing: Battlefield = { ...trial };
    delete missing[flag];
    expect(() => createLaneMatch(missing)).toThrow(/trusted/);
  }
  expect(() => createLaneMatch({ ...PRACTICE_FIXTURE, developmentRosterBots: true })).toThrow(
    /Rift/
  );
});

test('saved identities require trusted hosts and are not reconstructed from a roster selector', () => {
  const w = createLaneMatch(trial, 'lux'),
    saved = w.snapshot();
  for (const context of [
    rift,
    { ...rift, developmentRosterBots: true as const },
    { ...rift, developmentLeona: true as const },
    { ...rift, developmentMasterYiRift: true as const },
    { ...rift, developmentAhriRift: true as const },
  ])
    expect(() => World.fromSnapshot(saved, context)).toThrow();
  const admitted: Battlefield = { ...trial };
  delete admitted.developmentRosterBots;
  expect(World.fromSnapshot(saved, admitted).snapshot()).toBe(saved);
  const forged = JSON.parse(saved);
  for (const key of Object.keys(trial).filter((key) => key.startsWith('development')))
    forged[key] = true;
  expect(() => World.fromSnapshot(JSON.stringify(forged), rift)).toThrow();
  expect(saved).not.toContain('developmentRosterBots');
});

test('nine mixed bots walk the source grid, learn their own kit and retain independent saved futures', () => {
  const w = createLaneMatch(trial, 'lux'),
    bots = w.units.filter((u) => u.ai && u.kind === 'champion');
  const starts = bots.map((u) => ({ x: u.x, y: u.y })),
    hero = { x: w.hero.x, y: w.hero.y };
  for (let tick = 0; tick < 300; tick++) {
    w.step();
    for (const bot of bots)
      expect(grid.lineWalkable(bot.previous, bot, bot.radius, bot.team as 'blue' | 'red')).toBe(
        true
      );
  }
  for (const [i, bot] of bots.entries()) {
    expect(distance(bot, starts[i])).toBeGreaterThan(100);
    expect(w.championState(bot.id)!.spellRanks, bot.champion).toEqual(
      bot.champion === 'ashe' ? { q: 0, w: 1, e: 0, r: 0 } : { q: 1, w: 0, e: 0, r: 0 }
    );
  }
  expect({ x: w.hero.x, y: w.hero.y }).toEqual(hero);
  expect(w.player.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, trial);
  expect(copy.snapshot()).toBe(saved);
  w.step(600);
  copy.step(600);
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(copy.hero).not.toBe(w.hero);
});

test('ordinary and separate Ahri/Yi trials keep their top and support assignments', () => {
  for (const context of [
    rift,
    { ...rift, developmentAhriRift: true as const, developmentAhriBots: true as const },
    { ...rift, developmentMasterYiRift: true as const, developmentMasterYiBots: true as const },
  ]) {
    const w = createLaneMatch(context);
    for (const bot of w.units.filter((u) => u.kind === 'champion')) {
      const role = w.championState(bot.id)!.role;
      if (role === 'top') expect(bot.champion).toBe('ashe');
      if (role === 'support') expect(bot.champion).toBe('lux');
    }
  }
  expect(rift.developmentRosterBots).toBeUndefined();
});
