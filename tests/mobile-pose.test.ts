import { expect, it } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import durations from '../src/content/champion-clip-durations.json';
import { mobilePose } from '../src/render/mobile-pose';
import { RECALL_DURATION_TICKS } from '../src/content/rules';
it.each([
  [0, 0, 'idle'],
  [0.01, 0, 'idle'],
  [-0.01, 0, 'idle'],
  [0.006, 0.008, 'idle'],
  [0.010000000001, 0, 'run'],
  [0, 0.010000000001, 'run'],
] as const)('fixed-step movement reuse keeps the exact pose boundary at (%s,%s)', (x, y, kind) => {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
  const u = w.hero;
  u.previous = { x: 0, y: 0 };
  u.x = x;
  u.y = y;
  w.tick = 1;
  (w as any).advanceAnimationClocks();
  expect(u.animationTimeline!.primary.kind).toBe(kind);
  const sampled = mobilePose(u, w.player, w.tick, 1, durations.ashe);
  expect(u.animationTimeline!.primary).toEqual(sampled);
});
it('selects death, cast, recall, attacks and locomotion with explicit source clip time', () => {
  const w = new World(false, PRACTICE_FIXTURE, 'lux'),
    u = w.hero,
    s = w.player;
  const pose = (tick = 100, alpha = 1) => mobilePose(u, s, tick, alpha, durations.lux);
  u.previous = { x: u.x, y: u.y };
  u.idleClock = { startTick: 80, previous: 0.3, current: 0.4 };
  expect(pose(100, 0.5)).toMatchObject({
    kind: 'idle',
    clip: 'idle1',
    time: 0.35,
    loop: true,
    settled: true,
  });
  u.x += 10;
  u.runClock = { startTick: 90, previous: 0.2, current: 0.225 };
  expect(pose()).toMatchObject({ kind: 'run', clip: 'run', time: 0.225 });
  u.previous.x = u.x;
  u.attackCycle = { startTick: 90, endTick: 180, empowered: false, critical: true };
  expect(pose()).toMatchObject({ kind: 'attack', clip: 'crit', loop: false, cut: false });
  expect(pose().time).toBeCloseTo((durations.lux.crit * 10) / 90, 12);
  s.recallEnd = 90 + RECALL_DURATION_TICKS;
  expect(pose()).toMatchObject({ kind: 'recall', clip: 'idle3', cut: true });
  s.castAnimation = { ability: 'q', startTick: 95 };
  expect(pose()).toMatchObject({ kind: 'cast', clip: 'spell1', cut: true });
  u.deadAt = 98;
  expect(pose()).toMatchObject({ kind: 'death', clip: 'death' });
  expect(pose().time).toBeCloseTo(2 / 60, 12);
});
it('holds recall endings, preserves weighted run rate and reports missing clips', () => {
  const w = new World(false, PRACTICE_FIXTURE),
    u = w.hero,
    s = w.player;
  s.recallEnd = RECALL_DURATION_TICKS;
  const p = mobilePose(u, s, 10000, 1, durations.ashe);
  expect(p).toMatchObject({ kind: 'recall', clip: 'idle2', time: durations.ashe.idle2 });
  s.recallEnd = null;
  u.x += 10;
  u.runClock = { startTick: 10, previous: 2, current: 2.025 };
  const run = mobilePose(u, s, 20, 0.5, durations.ashe);
  expect(run.rate).toBeCloseTo(1.5, 12);
  expect(run.time).toBeCloseTo(2.0125 % durations.ashe.run, 12);
  expect(() => mobilePose(u, s, 20, 1, {})).toThrow('Missing mobile pose clip');
});
