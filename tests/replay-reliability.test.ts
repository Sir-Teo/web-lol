import { expect, test } from 'vitest';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { MatchReplayPlayer, MatchReplayRecorder } from '../src/replay/match-replay';
import { World } from '../src/simulation/world';

test('replay export captures one tick even if the world advances while hashing', async () => {
  const world = new World(true, PRACTICE_FIXTURE, 'ashe');
  const recorder = new MatchReplayRecorder(world, 30);
  recorder.step(30);
  const exported = recorder.exportLog();
  world.enqueue({ type: 'recall', unit: world.hero.id });
  recorder.step(60);

  const log = await exported;
  expect(log.endTick).toBe(30);
  expect(log.entries).toHaveLength(0);
  expect(log.checkpoints.map(({ tick }) => tick)).toEqual([0, 30]);
  const player = new MatchReplayPlayer(log, PRACTICE_FIXTURE);
  await expect(player.verifyCompleteDeterminism()).resolves.toMatchObject({ finalTick: 30 });
});

test('repeated seeks count each checkpoint once and cannot clear an integrity failure', async () => {
  const world = new World(true, PRACTICE_FIXTURE, 'ashe');
  const recorder = new MatchReplayRecorder(world, 30);
  recorder.step(75);
  const log = await recorder.exportLog();
  const player = new MatchReplayPlayer(log, PRACTICE_FIXTURE, 15);
  for (let i = 0; i < 3; i++) {
    player.seek(0);
    player.seek(75);
    await player.flushVerifications();
    expect(player.verifiedCheckpoints).toBe(log.checkpoints.length);
  }

  const corrupt = new MatchReplayPlayer({ ...log, finalSha256: '0'.repeat(64) }, PRACTICE_FIXTURE);
  corrupt.step(75);
  await expect(corrupt.flushVerifications()).rejects.toThrow(/tick 75/);
  corrupt.seek(0);
  expect(corrupt.world.tick).toBe(75);
  expect(corrupt.step()).toBe(0);
  await expect(corrupt.flushVerifications()).rejects.toThrow(/tick 75/);
});
