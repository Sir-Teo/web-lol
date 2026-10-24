import { expect, test } from 'vitest';
import {
  eclipseBirthFrame,
  eclipseDrawGroups,
  eclipsePoseAt,
} from '../src/render/leona-eclipse-history';
import type { EclipseFrame, EclipseVisual } from '../src/simulation/leona-w-visuals';

const frame = (tick: number, audience: EclipseFrame['audience'] = ['blue']): EclipseFrame => ({
  tick,
  x: tick * 10,
  y: -tick * 5,
  facing: 0,
  audience,
  animationTimeline: null,
  structurePose: null,
});
function visual(): EclipseVisual {
  return {
    startTick: 1,
    rank: 1,
    radius: 35,
    stopTick: null,
    endReason: null,
    detachedTick: null,
    frames: Array.from({ length: 185 }, (_, i) => frame(i + 1)),
    detonation: null,
  };
}
test('dispatches the armed, missed and extended phases with independent contact and pre-movement burst origins', () => {
  const r = visual();
  expect(eclipseDrawGroups(3, r).map((g) => [g.role, g.startTick, g.stopTick])).toEqual([
    ['buff-initial', 1, Infinity],
  ]);
  r.detonation = {
    tick: 181,
    result: 'hit',
    point: { x: 71, y: 32 },
    facing: 2,
    radius: 35,
    audience: ['blue'],
    contacts: [
      {
        targetId: 4,
        targetTeam: 'red',
        targetKind: 'dummy',
        targetRig: null,
        radius: 44,
        audience: ['blue'],
        detachedTick: null,
        frames: [frame(181)],
      },
    ],
  };
  const groups = eclipseDrawGroups(3, r);
  expect(groups.map((g) => [g.role, g.startTick, g.stopTick])).toEqual([
    ['buff-initial', 1, 181],
    ['buff-extended', 181, Infinity],
    ['cast-hit', 181, Infinity],
    ['target', 181, Infinity],
  ]);
  expect(groups[2].origin).toEqual({ x: 71, y: 32, facing: 2 });
  expect(groups[3].radius).toBe(44);
  expect(new Set(groups.map((g) => g.seed)).size).toBe(4);
  r.stopTick = 181;
  r.endReason = 'miss';
  r.detonation.result = 'miss';
  r.detonation.contacts = [];
  expect(eclipseDrawGroups(3, r).map((g) => g.role)).toEqual(['buff-initial', 'cast-miss']);
  r.detonation = null;
  r.stopTick = 20;
  r.endReason = 'death';
  expect(eclipseDrawGroups(3, r)[0].stopTick).toBe(20);
});
test('per-birth and creation audiences prevent replay of hidden particles; terminal fallback is finite-burst only', () => {
  const r = visual(),
    g = eclipseDrawGroups(3, r)[0];
  r.frames[1].audience = ['red'];
  expect(eclipseBirthFrame(g, 1, false)).toBeNull();
  expect(eclipseBirthFrame(g, 2, false)?.tick).toBe(3);
  expect(eclipseBirthFrame(g, 1000, true)).toBeNull();
  g.role = 'cast-hit';
  g.audience = ['blue'];
  expect(eclipseBirthFrame(g, 1000, false)).toBeNull();
  expect(eclipseBirthFrame(g, 1000, true)?.tick).toBe(185);
  g.audience = ['red'];
  expect(eclipseBirthFrame(g, 2, false)).toBeNull();
  expect(eclipseBirthFrame(g, 1000, true)).toBeNull();
});
test('history samples interpolate placement and shortest facing while frozen detached timeline clocks remain frozen', () => {
  const frames = [frame(10), frame(11)];
  frames[0].facing = Math.PI - 0.1;
  frames[1].facing = -Math.PI + 0.1;
  expect(eclipsePoseAt(frames, 10.5)).toMatchObject({ x: 105, y: -52.5, poseTick: 10.5 });
  expect(eclipsePoseAt(frames, 10.5).facing).toBeCloseTo(Math.PI, 12);
  expect(eclipsePoseAt(frames, 100).x).toBe(110);
  expect(eclipsePoseAt(frames, -5).x).toBe(100);
  frames[1].animationTimeline = {
    tick: 10,
    primary: {
      kind: 'death',
      clip: 'death',
      time: 0,
      unclampedTime: 0,
      rate: 1,
      loop: false,
      cut: true,
      settled: true,
    },
    transition: null,
  };
  expect(eclipsePoseAt(frames, 100).poseTick).toBe(10);
});
