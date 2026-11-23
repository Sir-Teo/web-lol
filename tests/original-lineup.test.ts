import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { PLAYABLE_CHAMPIONS, PUBLIC_SELECTABLE_CHAMPIONS } from '../src/content/champion-profiles';
import {
  ORIGINAL_CHAMPIONS,
  ORIGINAL_LINEUP,
  ORIGINAL_SLOTS,
} from '../src/content/original-lineup';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { createRift } from '../src/content/rift';
import { instantSpell } from '../src/input/spell-controls';
import {
  MatchReplayPlayer,
  MatchReplayRecorder,
  parseMatchReplayLog,
} from '../src/replay/match-replay';
import { createLaneMatch } from '../src/simulation/lane-match';
import { NavGrid } from '../src/simulation/navgrid';
import {
  originalBasicAttackBonus,
  ORIGINAL_RING_INNER,
} from '../src/simulation/original-champions';
import { World } from '../src/simulation/world';

const arena = {
  ...PRACTICE_FIXTURE,
  publicRift: true as const,
  initialUnits: [],
  reachable: (point: { x: number; y: number }) => ({ ...point }),
  lineWalkable: () => true,
};

function setup(champion: (typeof ORIGINAL_CHAMPIONS)[number]) {
  const world = new World(false, arena, champion);
  world.nextWaveTick = 1e8;
  Object.assign(world.hero, { x: 0, y: 0, previous: { x: 0, y: 0 }, ai: false });
  world.gainExperience(9000);
  for (const slot of ORIGINAL_SLOTS) expect(world.learnSpell(slot)).toBeNull();
  return world;
}

function publicRift() {
  const raw = readFileSync('public/assets/maps/rift-nav.bin');
  const grid = new NavGrid(
    JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
  );
  return {
    ...createRift(grid, JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))),
    publicRift: true as const,
  };
}

describe('original five-role lineup', () => {
  test('every original selection starts its own position with ten distinct champions', () => {
    expect(PLAYABLE_CHAMPIONS).toHaveLength(15);
    const battlefield = publicRift();
    for (const id of ORIGINAL_CHAMPIONS) {
      const world = createLaneMatch(battlefield, id);
      const roster = world.units.filter((unit) => unit.kind === 'champion');
      expect(world.hero.champion).toBe(id);
      expect(world.player.role).toBe(ORIGINAL_LINEUP[id].role);
      expect(
        roster
          .filter((unit) => unit.team === 'blue')
          .map((unit) => unit.champion)
          .sort()
      ).toEqual([...ORIGINAL_CHAMPIONS].sort());
      expect(new Set(roster.map((unit) => unit.champion)).size).toBe(10);
      expect(World.fromSnapshot(world.snapshot(), battlefield).snapshot()).toBe(world.snapshot());
    }
    const previous = createLaneMatch(battlefield);
    expect(
      previous.units
        .filter((unit) => unit.kind === 'champion')
        .map((unit) => unit.champion)
        .sort()
    ).toEqual([...PUBLIC_SELECTABLE_CHAMPIONS].sort());
  });

  for (const id of ORIGINAL_CHAMPIONS) {
    for (const slot of ORIGINAL_SLOTS) {
      test(id + ' ' + slot + ' commits its published windup and restores through impact', () => {
        const world = setup(id);
        const spell = ORIGINAL_LINEUP[id].spells[slot];
        const point = { x: spell.shape === 'self' ? 0 : Math.min(180, spell.range), y: 0 };
        const targetPosition = {
          x:
            point.x + (spell.shape === 'ring' ? (spell.radius * (1 + ORIGINAL_RING_INNER)) / 2 : 0),
          y: 0,
        };
        const foe = world.spawn('dummy', 'red', targetPosition);
        const ally = world.spawn('champion', 'blue', { ...point }, 'lux');
        ally.ai = false;
        ally.hp -= 200;
        world.hero.hp -= 120;
        const beforeMana = world.hero.mana;
        const beforeHealth = foe.hp;
        world.enqueue({ type: 'cast', unit: world.hero.id, ability: slot, point });
        world.step();
        const pending = world.player.original!.casts[0];
        expect(instantSpell(world, slot)).toBe(spell.shape === 'self');
        expect(pending.phase).toBe('windup');
        expect(pending.releaseTick - pending.startTick).toBe(spell.windup);
        expect(world.hero.mana).toBeLessThan(beforeMana);
        const saved = world.snapshot();
        const imported = World.fromSnapshot(saved, arena);
        expect(imported.snapshot()).toBe(saved);
        imported.step(spell.windup);
        world.step(spell.windup);
        expect(imported.snapshot()).toBe(world.snapshot());
        expect(pending.phase).toBe('impact');
        expect(world.events.some((event) => event.type === 'original-impact')).toBe(true);
        if (spell.damage) expect(foe.hp).toBeLessThan(beforeHealth);
        if (spell.root) expect(foe.rootUntil).toBeGreaterThan(world.tick);
        if (spell.slow) expect(foe.slows.some((slow) => slow.kind === 'original')).toBe(true);
        if (spell.shield)
          expect((spell.shape === 'disk' ? ally : world.hero).shields.length).toBeGreaterThan(0);
        if (spell.heal) expect(ally.hp).toBeGreaterThan(ally.maxHp - 200);
        if (spell.shape === 'dash') expect(world.hero.x).toBe(point.x);
        if (slot === 'r' && spell.shape === 'ring')
          expect(foe.rootUntil).toBeGreaterThan(world.tick);
      });
    }
  }

  test('first-target line stops on its first contact and a ring leaves its center clear', () => {
    const marksman = setup('vess');
    const near = marksman.spawn('dummy', 'red', { x: 240, y: 0 });
    const far = marksman.spawn('dummy', 'red', { x: 445, y: 0 });
    marksman.enqueue({
      type: 'cast',
      unit: marksman.hero.id,
      ability: 'q',
      point: { x: 900, y: 0 },
    });
    marksman.step(30);
    expect(near.hp).toBeLessThan(near.maxHp);
    expect(far.hp).toBe(far.maxHp);

    const top = setup('brannic');
    const safe = top.spawn('dummy', 'red', { x: 280, y: 0 });
    top.enqueue({ type: 'cast', unit: top.hero.id, ability: 'r', point: { x: 280, y: 0 } });
    top.step(35);
    expect(safe.hp).toBe(safe.maxHp);
    expect(safe.rootUntil).toBe(0);
  });

  test('passives are consumed on the third qualifying attack', () => {
    for (const id of ORIGINAL_CHAMPIONS) {
      const world = setup(id);
      const attacker = world.hero;
      const target =
        id === 'taviq'
          ? world.spawnMonster({ x: 200, y: 0 })
          : world.spawn('champion', 'red', { x: 200, y: 0 }, 'lux');
      target.ai = false;
      attacker.hp -= 160;
      world.player.cooldowns.q = 200;
      expect(originalBasicAttackBonus(world, attacker, target, world.player)).toBe(0);
      expect(originalBasicAttackBonus(world, attacker, target, world.player)).toBe(0);
      const bonus = originalBasicAttackBonus(world, attacker, target, world.player);
      expect(world.player.original).toMatchObject({ hits: 0, hitExpiry: 0 });
      if (id === 'brannic') expect(attacker.shields).toHaveLength(1);
      if (id === 'taviq' || id === 'oona')
        expect(attacker.hp).toBeGreaterThan(attacker.maxHp - 160);
      if (id === 'irielle') expect(world.player.cooldowns.q).toBe(110);
      if (id === 'vess') expect(bonus).toBeGreaterThan(0);
    }
  });

  test('root stops dash before spending mana and pending casts replay with their complete lineup', async () => {
    const world = setup('taviq');
    world.hero.rootUntil = 12;
    world.enqueue({ type: 'cast', unit: world.hero.id, ability: 'e', point: { x: 230, y: 0 } });
    world.step();
    expect(world.player.original!.casts).toEqual([]);
    world.step(15);
    const recorder = new MatchReplayRecorder(world, 12);
    world.enqueue({ type: 'cast', unit: world.hero.id, ability: 'e', point: { x: 230, y: 0 } });
    recorder.step(55);
    const replay = await parseMatchReplayLog(JSON.stringify(await recorder.exportLog()), arena);
    const player = new MatchReplayPlayer(replay, arena, 12);
    const result = await player.verifyCompleteDeterminism();
    expect(result.verifiedCheckpoints).toBe(replay.checkpoints.length);
    expect(player.world.snapshot()).toBe(world.snapshot());
  });

  test('Milestone 7 match checkpoints upgrade without accepting a foreign ruleset', () => {
    const battlefield = publicRift();
    const expected = createLaneMatch(battlefield).snapshot();
    const checkpoint = JSON.parse(expected);
    checkpoint.version = 186;
    checkpoint.ruleset = '3627a2c16eda1293133601d28228f0cf913af54fd1f2a72aee0349e78ea39e56';
    expect(World.fromSnapshot(JSON.stringify(checkpoint), battlefield).snapshot()).toBe(expected);
    checkpoint.ruleset = '0'.repeat(64);
    expect(() => World.fromSnapshot(JSON.stringify(checkpoint), battlefield)).toThrow(
      /game version/
    );
  });
});
