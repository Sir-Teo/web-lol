import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { BOT_DIFFICULTIES } from '../src/content/bot-difficulty';
import {
  PUBLIC_SELECTABLE_CHAMPIONS,
  publicSelectableChampion,
} from '../src/content/champion-profiles';
import { PLAYER_CHAMPION_ROLES } from '../src/content/champion-roles';
import { RIFT_BARON } from '../src/content/baron';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { createRift } from '../src/content/rift';
import { createLaneMatch } from '../src/simulation/lane-match';
import { distance } from '../src/simulation/math';
import { NavGrid } from '../src/simulation/navgrid';
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
const publicRift = { ...rift, publicRift: true as const };

test('public Summoner’s Rift admits all ten champions in 5v5 with live Baron and in practice without Baron', () => {
  expect(PUBLIC_SELECTABLE_CHAMPIONS).toEqual([
    'ashe',
    'lux',
    'garen',
    'masteryi',
    'leona',
    'ahri',
    'darius',
    'vi',
    'ezreal',
    'morgana',
  ]);
  for (const champion of PUBLIC_SELECTABLE_CHAMPIONS) {
    expect(publicSelectableChampion(champion)).toBe(champion);
    const lanes = createLaneMatch(
      publicRift,
      champion,
      champion === 'masteryi' || champion === 'vi'
        ? { d: 'smite', f: 'flash' }
        : { d: 'flash', f: 'heal' }
    );
    expect(lanes.hero).toMatchObject({ champion, ai: false, lane: null });
    expect(lanes.player.role).toBe(PLAYER_CHAMPION_ROLES[champion]);
    expect(lanes.riftBaron).toEqual({ unitId: null, lastClear: null, holders: [] });
    expect(lanes.units.filter((u) => u.kind === 'champion')).toHaveLength(10);
    expect(lanes.units.filter((u) => u.kind === 'champion' && u.ai)).toHaveLength(9);
    const savedLanes = lanes.snapshot();
    expect(savedLanes).not.toContain('publicRift');
    expect(savedLanes).not.toContain('botDifficulty');
    const restoredLanes = World.fromSnapshot(savedLanes, publicRift);
    expect(restoredLanes.snapshot()).toBe(savedLanes);
    lanes.step(120);
    restoredLanes.step(120);
    expect(restoredLanes.snapshot()).toBe(lanes.snapshot());

    const practice = new World(true, publicRift, champion);
    expect(practice.matchMode).toBe('practice');
    expect(practice.hero).toMatchObject({ champion, ai: false });
    expect(practice.riftBaron).toBeNull();
    expect(practice.units.filter((u) => u.kind === 'dummy')).toHaveLength(1);
    const savedPractice = practice.snapshot();
    const restoredPractice = World.fromSnapshot(savedPractice, publicRift);
    expect(restoredPractice.snapshot()).toBe(savedPractice);
    practice.step(120);
    restoredPractice.step(120);
    expect(restoredPractice.snapshot()).toBe(practice.snapshot());
  }

  const baronMatch = createLaneMatch(publicRift, 'ashe', { d: 'flash', f: 'smite' });
  baronMatch.nextWaveTick = 1_000_000_000;
  for (const u of baronMatch.units) u.ai = false;
  baronMatch.tick = RIFT_BARON.firstReadyTick - 1;
  baronMatch.step();
  expect(baronMatch.riftBaron?.unitId).not.toBeNull();
});

test('configurable bot difficulty adjusts reaction cadence and bounded skillshot aim while obeying sight boundaries', () => {
  const field = {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (p: { x: number; y: number }) => ({ x: p.x, y: p.y }),
    findPath: (_a: unknown, b: { x: number; y: number }) => [{ x: b.x, y: b.y }],
  };

  for (const difficulty of ['standard', 'intro'] as const) {
    let visible = false;
    const w = new World(false, { ...field, lineOfSight: () => visible }, 'ashe', difficulty);
    w.nextWaveTick = Infinity;
    w.random.state = 42;
    w.hero.x = -3000;
    w.hero.y = -3000;
    const bot = w.spawn('champion', 'red', { x: 0, y: 0 }, 'ashe');
    bot.ai = true;
    bot.nextThink = 1;
    w.gainExperience(5000, bot.id);
    expect(w.learnSpell('w', bot.id)).toBeNull();
    const target = w.spawn('champion', 'blue', { x: 850, y: 0 }, 'lux');
    target.ai = false;

    // Hidden enemy must never trigger a cast or alter movement toward the unseen target.
    w.step();
    expect(bot.nextThink).toBe(1 + BOT_DIFFICULTIES[difficulty].thinkTicks);
    expect(w.commands).toEqual([]);

    // Once revealed, the bot aims within the configured dispersion radius and round-trips deterministically.
    visible = true;
    bot.nextThink = w.tick + 1;
    w.step();
    const cast = w.commands.find(
      (c): c is Extract<(typeof w.commands)[number], { type: 'cast' }> =>
        c.type === 'cast' && c.unit === bot.id && c.ability === 'w'
    );
    expect(cast).toBeDefined();
    if (difficulty === 'standard') {
      expect(cast!.point).toEqual({ x: target.x, y: target.y });
      expect(w.snapshot()).not.toContain('botDifficulty');
    } else {
      const offset = distance(cast!.point, target);
      expect(offset).toBeGreaterThan(0);
      expect(offset).toBeLessThanOrEqual(BOT_DIFFICULTIES.intro.aimSpreadUnits);
      const saved = w.snapshot();
      expect(JSON.parse(saved).botDifficulty).toBe('intro');
      const copy = World.fromSnapshot(saved, { ...field, lineOfSight: () => visible });
      expect(copy.botDifficulty).toBe('intro');
      expect(copy.snapshot()).toBe(saved);
      w.step(90);
      copy.step(90);
      expect(copy.snapshot()).toBe(w.snapshot());
    }
  }
});
