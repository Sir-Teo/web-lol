import { expect, test } from 'vitest';
import type { AhriWVisualHistory, WVisualAnchor } from '../src/simulation/ahri-w-visual-history';
import {
  wVisualGroups,
  wVisualPose,
  wVisualKnown,
  wVisualDistance,
} from '../src/render/ahri-w-history';

function fixture(): AhriWVisualHistory {
  const anchor = (tick: number, x: number, y = 0, visible = false): WVisualAnchor => ({
    tick,
    point: { x, y },
    audience: visible ? ['blue', 'red'] : ['red'],
  });
  return {
    id: 50,
    sourceId: 7,
    team: 'red',
    startTick: 1,
    releaseTick: 3,
    facing: 0,
    origin: { x: 0, y: 0 },
    fires: [0, 1, 2].map((index) => ({
      index,
      birth: anchor(1, index * 100),
      dispatch: index === 0 ? { ...anchor(3, 15), targetId: 9, sourcePoint: { x: 0, y: 0 } } : null,
      end: index === 0 ? { ...anchor(4, 45, 15, true), reason: 'hit' } : null,
      frames:
        index === 0
          ? [
              { ...anchor(1, 0), phase: 'orbit', sourcePoint: { x: 0, y: 0 }, targetPoint: null },
              {
                ...anchor(2, 10, 0, true),
                phase: 'orbit',
                sourcePoint: { x: 0, y: 0 },
                targetPoint: null,
              },
              {
                ...anchor(3, 30, 0, true),
                phase: 'flight',
                sourcePoint: { x: 0, y: 0 },
                targetPoint: { x: 45, y: 15 },
              },
              {
                ...anchor(4, 45, 15, true),
                phase: 'flight',
                sourcePoint: { x: 0, y: 0 },
                targetPoint: { x: 45, y: 15 },
              },
            ]
          : [],
    })),
  };
}

test('W groups dispatch only orbit, flight and genuine hit resources with stable distinct seeds', () => {
  const r = fixture(),
    groups = wVisualGroups(r);
  expect(groups.map((g) => g.role)).toEqual(['orbit', 'flight', 'hit', 'orbit', 'orbit']);
  expect(new Set(groups.map((g) => g.key)).size).toBe(5);
  expect(new Set(groups.map((g) => g.seed)).size).toBe(5);
  expect(groups[0]).toMatchObject({ startTick: 1, stopTick: 3 });
  expect(groups[1]).toMatchObject({ startTick: 3, stopTick: 4 });
  expect(groups[2]).toMatchObject({ startTick: 4, stopTick: Infinity });
  expect(wVisualGroups(r).map((g) => g.seed)).toEqual(groups.map((g) => g.seed));
  r.fires[0].end!.reason = 'lost-target';
  expect(wVisualGroups(r).some((g) => g.role === 'hit')).toBe(false);
});

test('W poses retain the distinct dispatch root and terminal flight direction', () => {
  const [orbit, flight, hit] = wVisualGroups(fixture());
  expect(wVisualPose(orbit, 3)?.x).toBe(15);
  expect(wVisualPose(flight, 2)?.x).toBe(15);
  expect(wVisualPose(flight, 3)?.x).toBe(30);
  expect(wVisualPose(flight, 2.5)?.x).toBe(22.5);
  expect(wVisualPose(hit, 100)).toEqual({ x: 45, y: 15, facing: Math.PI / 4 });
  expect(wVisualPose(flight, NaN)).toBeNull();
});

test('W visibility admits exact visible samples while rejecting interpolation across hidden neighbours', () => {
  const [orbit, flight, hit] = wVisualGroups(fixture());
  expect(wVisualKnown(orbit, 1)).toBe(false);
  expect(wVisualKnown(orbit, 1.5)).toBe(false);
  expect(wVisualKnown(orbit, 2)).toBe(true);
  expect(wVisualKnown(orbit, 2.5)).toBe(false);
  expect(wVisualKnown(flight, 2)).toBe(false);
  expect(wVisualKnown(flight, 2.5)).toBe(false);
  expect(wVisualKnown(flight, 3)).toBe(true);
  expect(wVisualKnown(hit, 4)).toBe(true);
  expect(wVisualKnown(orbit, 1, 'red')).toBe(true);
  expect(wVisualKnown(orbit, Infinity, 'red')).toBe(false);
});

test('W phase distance is independent of seek order and clamps to saved endpoints', () => {
  const [orbit, flight, hit] = wVisualGroups(fixture());
  expect(wVisualDistance(orbit, 100)).toBe(15);
  expect(wVisualDistance(flight, 2)).toBe(0);
  expect(wVisualDistance(flight, 3)).toBe(15);
  expect(wVisualDistance(flight, 4)).toBeCloseTo(15 + Math.hypot(15, 15));
  expect(wVisualDistance(flight, 2.5)).toBe(7.5);
  expect(wVisualDistance(hit, 100)).toBe(0);
  expect(wVisualDistance(flight, NaN)).toBe(0);
});

test('W cached paths follow appended frames, dispatch and refreshed birth visibility', () => {
  const r = fixture(),
    orbit = wVisualGroups(r)[3],
    f = r.fires[1];
  expect(wVisualPose(orbit, 1)?.x).toBe(100);
  expect(wVisualKnown(orbit, 0)).toBe(false);
  f.birth.audience = ['blue', 'red'];
  expect(wVisualKnown(orbit, 0)).toBe(true);
  f.frames.push({
    tick: 1,
    point: { x: 110, y: 0 },
    audience: ['red'],
    phase: 'orbit',
    sourcePoint: { x: 0, y: 0 },
    targetPoint: null,
  });
  expect(wVisualPose(orbit, 1)?.x).toBe(110);
  expect(wVisualDistance(orbit, 1)).toBe(10);
  f.frames[0].audience = ['blue', 'red'];
  expect(wVisualKnown(orbit, 1)).toBe(true);
  f.dispatch = {
    tick: 2,
    point: { x: 120, y: 0 },
    audience: ['red'],
    targetId: 9,
    sourcePoint: { x: 0, y: 0 },
  };
  f.frames.push({
    tick: 2,
    point: { x: 140, y: 0 },
    audience: ['red'],
    phase: 'flight',
    sourcePoint: { x: 0, y: 0 },
    targetPoint: { x: 200, y: 0 },
  });
  expect(wVisualPose(orbit, 2)?.x).toBe(120);
  expect(wVisualDistance(orbit, 2)).toBe(20);
  const flight = wVisualGroups(r).find((g) => g.fire.index === 1 && g.role === 'flight')!;
  expect(wVisualPose(flight, 1)?.x).toBe(120);
  f.dispatch.audience = ['blue', 'red'];
  expect(wVisualKnown(flight, 1)).toBe(true);
});
