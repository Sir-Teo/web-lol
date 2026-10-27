import { expect, test } from 'vitest';
import {
  appendActorRoot,
  actorRootAt,
  actorRootPose,
  actorRootKnown,
  validateActorRoots,
  type ActorRootFrame,
  type ActorRootRun,
} from '../src/simulation/actor-root-history';
const frame = (
  tick: number,
  x = 0,
  facing = 0,
  audience: ActorRootFrame['audience'] = ['blue']
): ActorRootFrame => ({ tick, x, y: x * 2, facing, audience });
test('four seconds of constant endpoints occupy one exact run', () => {
  const runs: ActorRootRun[] = [];
  for (let tick = 10; tick <= 250; tick++) appendActorRoot(runs, frame(tick));
  expect(runs).toEqual([{ ...frame(10), endTick: 250 }]);
  validateActorRoots(runs, 10, 250);
  for (const tick of [10, 11, 40, 249, 250]) expect(actorRootAt(runs, tick).x).toBe(0);
});
test('movement and visibility changes reconstruct the dense endpoints and every half-step', () => {
  const runs: ActorRootRun[] = [],
    dense: ActorRootFrame[] = [];
  for (let tick = 0; tick < 100; tick++) {
    const x = tick < 30 ? 0 : tick < 60 ? (tick - 30) * 0.3 : 8.7,
      f = frame(tick, x, tick < 50 ? 3.1 : -3.1, tick < 40 ? ['blue'] : []);
    dense.push(f);
    appendActorRoot(runs, f);
  }
  validateActorRoots(runs, 0, 99);
  for (let tick = 0; tick < 99; tick++) {
    expect(actorRootAt(runs, tick)).toMatchObject({
      x: dense[tick].x,
      y: dense[tick].y,
      facing: dense[tick].facing,
      audience: dense[tick].audience,
    });
    const a = dense[tick],
      b = dense[tick + 1],
      turn = Math.atan2(Math.sin(b.facing - a.facing), Math.cos(b.facing - a.facing));
    expect(actorRootPose(runs, tick + 0.5)).toEqual({
      x: (a.x + b.x) * 0.5,
      y: (a.y + b.y) * 0.5,
      facing: a.facing + turn * 0.5,
    });
    expect(actorRootKnown(runs, tick + 0.5, 'blue')).toBe(
      a.audience.includes('blue') && b.audience.includes('blue')
    );
  }
});
test('same-tick replacement splits a constant span and merges back canonically', () => {
  const runs: ActorRootRun[] = [];
  for (let tick = 0; tick <= 10; tick++) appendActorRoot(runs, frame(tick));
  appendActorRoot(runs, frame(10, 5));
  expect(runs).toHaveLength(2);
  expect(runs[0].endTick).toBe(9);
  appendActorRoot(runs, frame(10));
  expect(runs).toEqual([{ ...frame(0), endTick: 10 }]);
  validateActorRoots(runs, 0, 10);
});
test('past/future presentation clamps to known endpoints without changing history', () => {
  const runs: ActorRootRun[] = [];
  appendActorRoot(runs, frame(10, 2));
  appendActorRoot(runs, frame(11, 3));
  const before = JSON.stringify(runs);
  expect(actorRootPose(runs, 0)).toEqual({ x: 2, y: 4, facing: 0 });
  expect(actorRootPose(runs, 1000)).toEqual({ x: 3, y: 6, facing: 0 });
  expect(JSON.stringify(runs)).toBe(before);
});
test('capture gaps, missing coverage and redundant adjacent runs reject', () => {
  const runs: ActorRootRun[] = [];
  appendActorRoot(runs, frame(10));
  expect(() => appendActorRoot(runs, frame(12))).toThrow('contiguous');
  expect(() => validateActorRoots(runs, 10, 11)).toThrow('coverage');
  expect(() =>
    validateActorRoots(
      [
        { ...frame(10), endTick: 10 },
        { ...frame(11), endTick: 11 },
      ],
      10,
      11
    )
  ).toThrow('canonical');
});
