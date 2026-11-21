import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { createRift, type RiftLayout } from '../src/content/rift';
import { applyImmediatePracticeTool } from '../src/practice/practice-tools';
import {
  MAX_REPLAY_BYTES,
  MatchReplayPlayer,
  MatchReplayRecorder,
  digestSnapshotSha256,
  parseMatchReplayLog,
} from '../src/replay/match-replay';
import { createLaneMatch } from '../src/simulation/lane-match';
import { NavGrid } from '../src/simulation/navgrid';
import { SNAPSHOT_RULESET, SNAPSHOT_VERSION } from '../src/simulation/snapshot';
import { swapTrinket } from '../src/simulation/trinkets';
import { World } from '../src/simulation/world';
import {
  DEFAULT_SOUND_MIX,
  SOUND_MIX_KEY,
  SOUND_PREFERENCE_KEY,
  normalizeSoundMix,
  readSoundEnabled,
  readSoundMix,
  writeSoundEnabled,
  writeSoundMix,
} from '../src/storage/sound-preference';

function loadRiftFromDisk() {
  const layout = JSON.parse(
    readFileSync('public/assets/maps/rift-layout.json', 'utf8')
  ) as RiftLayout;
  const nav = JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8'));
  const raw = readFileSync('public/assets/maps/rift-nav.bin');
  const bytes = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  return { ...createRift(new NavGrid(nav, bytes), layout), publicRift: true as const };
}

describe('Milestone 5 deterministic command-log replay', () => {
  test('digestSnapshotSha256 matches node:crypto SHA-256 exactly', async () => {
    for (const sample of [
      '',
      'rift',
      'Summoner’s Rift · 5v5',
      new World(true, PRACTICE_FIXTURE).snapshot(),
    ]) {
      const expected = createHash('sha256').update(sample, 'utf8').digest('hex');
      expect(await digestSnapshotSha256(sample)).toBe(expected);
    }
  });

  test('replays a 6-champion 5v5 Rift match with interleaved commands, shop, trinket swap, and exact checkpoint hashes', async () => {
    const rift = loadRiftFromDisk();
    const world = createLaneMatch(rift, 'lux', { d: 'flash', f: 'heal' }, 'standard');
    const recorder = new MatchReplayRecorder(world, 120);

    // Tick 0: learn Q, buy Doran's Ring / Amplifying Tome, issue move order.
    world.enqueue({ type: 'learn', unit: world.player.id, ability: 'q' });
    expect(world.buy('tome')).toBeNull();
    world.enqueue({
      type: 'order',
      unit: world.player.id,
      order: { type: 'move', point: { x: -4200, y: 4200 } },
    });

    recorder.step(180);

    // Cast Q skillshot and place a Stealth Ward.
    world.enqueue({
      type: 'cast',
      unit: world.player.id,
      ability: 'q',
      point: { x: -3400, y: 3400 },
    });
    world.enqueue({
      type: 'ward',
      unit: world.player.id,
      point: { x: -3900, y: 3900 },
    });

    recorder.step(180);

    // Return to fountain via recall or step at fountain: test item move & sell after recall.
    world.enqueue({ type: 'recall', unit: world.player.id });
    recorder.step(500);

    // Back at fountain: swap trinket to Oracle Lens, reorder slots, sell tome, then buy boots.
    expect(swapTrinket(world, 'oracle')).toBeNull();
    recorder.recordTrinketSwap('oracle', world.player.id);
    expect(world.moveItem(0, 2)).toBeNull();
    expect(world.sell(2)).toBeNull();
    expect(world.buy('boots')).toBeNull();

    recorder.step(220);

    const expectedFinalSnapshot = world.snapshot();
    const log = await recorder.exportLog();
    recorder.detach();

    expect(log.version).toBe(SNAPSHOT_VERSION);
    expect(log.ruleset).toBe(SNAPSHOT_RULESET);
    expect(log.battlefieldId).toBe('rift');
    expect(log.checkpoints.length).toBeGreaterThanOrEqual(9);
    expect(log.entries.length).toBeGreaterThanOrEqual(8);

    const serialized = JSON.stringify(log);
    const parsed = await parseMatchReplayLog(serialized, rift);
    const player = new MatchReplayPlayer(parsed, rift, 150);
    const verification = await player.verifyCompleteDeterminism();

    expect(verification.finalTick).toBe(world.tick);
    expect(verification.verifiedCheckpoints).toBe(log.checkpoints.length);
    expect(player.world.snapshot()).toBe(expectedFinalSnapshot);

    // Verify forward/backward keyframe seeking reproduces intermediate states byte-for-byte.
    player.seek(240);
    await player.flushVerifications();
    const at240 = player.world.snapshot();
    expect(await digestSnapshotSha256(at240)).toBe(
      log.checkpoints.find((cp) => cp.tick === 240)!.sha256
    );
    player.seek(360);
    await player.flushVerifications();
    const at360 = player.world.snapshot();
    expect(player.world.commands.some((cmd) => cmd.type === 'recall')).toBe(true);
    player.seek(920);
    await player.flushVerifications();
    player.seek(360);
    await player.flushVerifications();
    expect(player.world.snapshot()).toBe(at360);
  });

  test('mid-flight projectile save, restore, and replay match uninterrupted simulation', async () => {
    const world = new World(true, PRACTICE_FIXTURE, 'ashe');
    world.gainExperience(10_000);
    for (const ability of ['q', 'w', 'e', 'r'] as const) world.learnSpell(ability);
    world.enqueue({
      type: 'cast',
      unit: world.player.id,
      ability: 'r',
      point: { x: world.hero.x + 900, y: world.hero.y },
    });
    world.enqueue({
      type: 'cast',
      unit: world.player.id,
      ability: 'w',
      point: { x: world.hero.x + 700, y: world.hero.y + 80 },
    });
    world.step(20);
    expect(world.projectiles.length).toBeGreaterThan(0);

    // Save mid-projectile flight, restore into two independent worlds, and record replay on one.
    const midFlightSnapshot = world.snapshot();
    const restoredLive = World.fromSnapshot(midFlightSnapshot, PRACTICE_FIXTURE);
    const recorder = new MatchReplayRecorder(restoredLive, 30);

    // Uninterrupted original continues with identical follow-up move order at tick + 15.
    world.step(15);
    world.enqueue({
      type: 'order',
      unit: world.player.id,
      order: { type: 'move', point: { x: world.hero.x - 250, y: world.hero.y + 120 } },
    });
    world.step(90);

    recorder.step(15);
    restoredLive.enqueue({
      type: 'order',
      unit: restoredLive.player.id,
      order: {
        type: 'move',
        point: { x: restoredLive.hero.x - 250, y: restoredLive.hero.y + 120 },
      },
    });
    recorder.step(90);

    expect(restoredLive.snapshot()).toBe(world.snapshot());

    const log = await recorder.exportLog();
    const player = new MatchReplayPlayer(log, PRACTICE_FIXTURE, 25);
    await player.verifyCompleteDeterminism();
    expect(player.world.snapshot()).toBe(world.snapshot());
  });

  test('zero-tick recordings with immediate practice and shop actions verify cleanly', async () => {
    const world = new World(true, PRACTICE_FIXTURE, 'garen');
    const recorder = new MatchReplayRecorder(world, 60);
    applyImmediatePracticeTool(world, 'gold');
    recorder.recordPractice('gold');
    applyImmediatePracticeTool(world, 'level-up');
    recorder.recordPractice('level-up');
    expect(world.buy('cloth')).toBeNull();

    const log = await recorder.exportLog();
    expect(log.startTick).toBe(0);
    expect(log.endTick).toBe(0);

    const parsed = await parseMatchReplayLog(JSON.stringify(log), PRACTICE_FIXTURE);
    const player = new MatchReplayPlayer(parsed, PRACTICE_FIXTURE);
    await player.flushVerifications();
    expect(player.world.snapshot()).toBe(world.snapshot());
    const result = await player.verifyCompleteDeterminism();
    expect(result.finalSha256).toBe(log.finalSha256);
  });

  test('rejects incompatible versions, rulesets, battlefields, oversized logs, and tampered checkpoints', async () => {
    const world = new World(true, PRACTICE_FIXTURE, 'ashe');
    const recorder = new MatchReplayRecorder(world, 30);
    recorder.step(60);
    const valid = await recorder.exportLog();
    const rift = loadRiftFromDisk();

    await expect(parseMatchReplayLog('{', PRACTICE_FIXTURE)).rejects.toThrow(/could not be read/);
    await expect(
      parseMatchReplayLog(' '.repeat(MAX_REPLAY_BYTES + 1), PRACTICE_FIXTURE)
    ).rejects.toThrow(/too large/);
    await expect(
      parseMatchReplayLog(
        JSON.stringify({ ...valid, version: SNAPSHOT_VERSION - 1 }),
        PRACTICE_FIXTURE
      )
    ).rejects.toThrow(/different game version/);
    await expect(
      parseMatchReplayLog(JSON.stringify({ ...valid, ruleset: '0'.repeat(64) }), PRACTICE_FIXTURE)
    ).rejects.toThrow(/different ruleset/);
    await expect(parseMatchReplayLog(JSON.stringify(valid), rift)).rejects.toThrow(
      /different battlefield/
    );

    const tamperedInitial = {
      ...valid,
      checkpoints: [{ tick: 0, sha256: 'a'.repeat(64) }, ...valid.checkpoints.slice(1)],
    };
    await expect(
      parseMatchReplayLog(JSON.stringify(tamperedInitial), PRACTICE_FIXTURE)
    ).rejects.toThrow(/initial checkpoint digest/);

    const tamperedStep = {
      ...valid,
      checkpoints: [
        valid.checkpoints[0],
        { tick: valid.checkpoints[1].tick, sha256: 'b'.repeat(64) },
        ...valid.checkpoints.slice(2),
      ],
    };
    const parsedTampered = await parseMatchReplayLog(
      JSON.stringify(tamperedStep),
      PRACTICE_FIXTURE
    );
    const player = new MatchReplayPlayer(parsedTampered, PRACTICE_FIXTURE);
    await expect(player.verifyCompleteDeterminism()).rejects.toThrow(/Replay checkpoint mismatch/);
  });
});

describe('Milestone 5 sound mix preferences and expanded practice tools', () => {
  test('persists sound mix preferences independently of mute toggle and normalizes invalid inputs', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    expect(readSoundEnabled(storage)).toBe(true);
    expect(readSoundMix(storage)).toEqual(DEFAULT_SOUND_MIX);

    writeSoundMix({ master: 0.75, combat: 0.5, feedback: 0.25, dynamicLimiter: false }, storage);
    writeSoundEnabled(false, storage);

    expect(store.get(SOUND_PREFERENCE_KEY)).toBe('muted');
    expect(readSoundEnabled(storage)).toBe(false);
    expect(readSoundMix(storage)).toEqual({
      master: 0.75,
      combat: 0.5,
      feedback: 0.25,
      dynamicLimiter: false,
    });

    expect(
      normalizeSoundMix({ master: 4, combat: -2, feedback: Number.NaN, dynamicLimiter: true })
    ).toEqual({
      master: 1,
      combat: 0,
      feedback: 1,
      dynamicLimiter: true,
    });

    store.set(SOUND_MIX_KEY, '{broken');
    expect(readSoundMix(storage)).toEqual(DEFAULT_SOUND_MIX);
  });

  test('expanded practice tools preserve snapshot round-trip invariants across champions', () => {
    for (const champion of ['ashe', 'lux', 'garen', 'masteryi', 'leona', 'ahri'] as const) {
      const battlefield =
        champion === 'ashe' || champion === 'lux'
          ? PRACTICE_FIXTURE
          : {
              ...PRACTICE_FIXTURE,
              developmentGaren: true as const,
              developmentLeona: true as const,
              developmentAhri: true as const,
              developmentMasterYi: true as const,
            };
      const world = new World(true, battlefield, champion);
      world.hero.hp = 120;
      const enemy = world.units.find((u) => u.kind === 'champion' && u.team === 'red');
      if (enemy) enemy.hp = 100;

      expect(applyImmediatePracticeTool(world, 'level-up')).toBe('Reached level 2');
      expect(world.player.level).toBe(2);
      expect(applyImmediatePracticeTool(world, 'restore')).toBe('Health and mana restored');
      expect(world.hero.hp).toBe(world.hero.maxHp);
      expect(applyImmediatePracticeTool(world, 'reset-enemy')).toBe(
        'Opponent health and mana restored'
      );
      if (enemy) expect(enemy.hp).toBe(enemy.maxHp);
      expect(applyImmediatePracticeTool(world, 'max-level')).toBe('Reached level 18');
      expect(world.player.level).toBe(18);
      expect(applyImmediatePracticeTool(world, 'max-level')).toBe('Already at maximum level');

      const snap = world.snapshot();
      expect(World.fromSnapshot(snap, battlefield).snapshot()).toBe(snap);
    }
  });
});
