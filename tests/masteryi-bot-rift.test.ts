import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRift } from '../src/content/rift';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { NavGrid } from '../src/simulation/navgrid';
import { createLaneMatch } from '../src/simulation/lane-match';
import { World } from '../src/simulation/world';
import { distance } from '../src/simulation/math';

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
  developmentMasterYiRift: true as const,
  developmentMasterYiBots: true as const,
};
const fresh = (player: 'ashe' | 'lux' | 'masteryi' = 'ashe') =>
  createLaneMatch(
    trial,
    player,
    player === 'masteryi' ? { d: 'smite', f: 'flash' } : { d: 'flash', f: 'heal' }
  );

for (const player of ['ashe', 'lux', 'masteryi'] as const)
  test(`${player} human keeps manual control while bot junglers receive paid own companions`, () => {
    const w = fresh(player),
      champions = w.units.filter((u) => u.kind === 'champion');
    expect(w.hero.champion).toBe(player);
    expect(w.hero.ai).toBe(false);
    expect(w.hero.lane).toBeNull();
    expect(w.player.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
    expect(champions).toHaveLength(10);
    expect(champions.filter((u) => u.ai)).toHaveLength(9);
    expect(champions.filter((u) => u.champion === 'masteryi')).toHaveLength(2);
    for (const team of ['blue', 'red'] as const) {
      const members = champions.filter((u) => u.team === team);
      expect(members.map((u) => w.championState(u.id)!.role).sort()).toEqual([
        'carry',
        'jungle',
        'mid',
        'support',
        'top',
      ]);
      const jungler = members.find((u) => w.championState(u.id)!.role === 'jungle')!;
      expect(jungler.champion).toBe('masteryi');
      expect(jungler.lane).toBeNull();
      const state = w.championState(jungler.id)!;
      expect(state.summoners).toEqual({ d: 'smite', f: 'flash' });
      if (jungler.ai) {
        expect(state.gold).toBe(50);
        expect(state.inventory).toEqual(['mosstomper']);
        expect(w.companions.find((c) => c.ownerId === jungler.id)).toMatchObject({
          kind: 'mosstomper',
          fed: 0,
        });
      } else {
        expect(state.gold).toBe(500);
        expect(state.inventory).toEqual([]);
        expect(w.companions.some((c) => c.ownerId === jungler.id)).toBe(false);
      }
    }
    expect(w.units.filter((u) => u.kind === 'turret')).toHaveLength(22);
    expect(w.battlefield.findPath).toBe(rift.findPath);
    expect(rift.developmentMasterYiBots).toBeUndefined();
    expect(World.fromSnapshot(w.snapshot(), trial).snapshot()).toBe(w.snapshot());
  });

test('the bot selector alone and edited save flags cannot authorize a Yi Rift state', () => {
  const saved = fresh().snapshot();
  for (const context of [
    rift,
    { ...rift, developmentMasterYi: true as const },
    { ...rift, developmentMasterYiBots: true as const },
    { ...rift, developmentAhriRift: true as const },
  ])
    expect(() => World.fromSnapshot(saved, context)).toThrow(/Master Yi/);
  expect(() => createLaneMatch({ ...rift, developmentMasterYiBots: true }, 'ashe')).toThrow(
    /trusted/
  );
  expect(() =>
    createLaneMatch({ ...PRACTICE_FIXTURE, developmentMasterYiBots: true }, 'ashe')
  ).toThrow(/Rift/);
  const raw = JSON.parse(saved);
  raw.developmentMasterYiBots = raw.developmentMasterYiRift = true;
  expect(() => World.fromSnapshot(JSON.stringify(raw), rift)).toThrow();
  expect(saved).not.toContain('developmentMasterYiBots');
});

test('both Yi junglers walk the source grid and learn Q while the human remains manual', () => {
  const w = fresh(),
    bots = w.units.filter((u) => u.champion === 'masteryi');
  const starts = bots.map((u) => ({ x: u.x, y: u.y })),
    hero = { x: w.hero.x, y: w.hero.y };
  for (let i = 0; i < 300; i++) {
    w.step();
    for (const bot of bots)
      expect(grid.lineWalkable(bot.previous, bot, bot.radius, bot.team as 'blue' | 'red')).toBe(
        true
      );
  }
  expect(distance(w.hero, hero)).toBe(0);
  expect(w.player.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  for (const [i, bot] of bots.entries()) {
    expect(distance(bot, starts[i])).toBeGreaterThan(300);
    expect(w.championState(bot.id)!.spellRanks).toEqual({ q: 1, w: 0, e: 0, r: 0 });
    expect(w.championState(bot.id)!.eCharges).toBe(0);
  }
  const copy = World.fromSnapshot(w.snapshot(), trial);
  w.step(180);
  copy.step(180);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('normal jungle calendars lead both paid Yi bots into real Alpha clears and exact saved continuations', () => {
  const w = fresh(),
    bots = w.units.filter((u) => u.champion === 'masteryi'),
    casts = new Set<number>();
  for (let i = 0; i < 7200 && casts.size < 2; i++) {
    w.step();
    for (const bot of bots) if (w.championState(bot.id)!.alphaStrike) casts.add(bot.id);
  }
  expect(casts.size).toBe(2);
  for (const bot of bots) {
    expect(w.alive(bot)).toBe(true);
    expect(w.championState(bot.id)!.role).toBe('jungle');
  }
  const copy = World.fromSnapshot(w.snapshot(), trial);
  w.step(180);
  copy.step(180);
  expect(copy.snapshot()).toBe(w.snapshot());
}, 30000);

test('ordinary, original human-Yi and Ahri bot rosters retain their previous identities', () => {
  for (const player of ['ashe', 'lux'] as const)
    expect(createLaneMatch(rift, player).units.some((u) => u.champion === 'masteryi')).toBe(false);
  const original = createLaneMatch({ ...rift, developmentMasterYiRift: true }, 'masteryi', {
    d: 'smite',
    f: 'flash',
  });
  expect(original.units.filter((u) => u.champion === 'masteryi')).toHaveLength(1);
  expect(
    original.units.find((u) => u.team === 'red' && original.championState(u.id)?.role === 'jungle')!
      .champion
  ).toBe('ashe');
  const ahri = createLaneMatch(
    { ...rift, developmentAhriRift: true, developmentAhriBots: true },
    'ashe'
  );
  expect(ahri.units.some((u) => u.champion === 'masteryi')).toBe(false);
});
